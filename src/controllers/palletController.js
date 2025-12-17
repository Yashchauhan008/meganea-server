import asyncHandler from '../utils/asyncHandler.js';
import Pallet from '../models/palletModel.js';
import Tile from '../models/tileModel.js';
import PurchaseOrder from '../models/purchaseOrderModel.js';
import Factory from '../models/factoryModel.js';
import mongoose from 'mongoose';

/**
 * @desc    Get all factory stock (summary view of all factories combined)
 * @route   GET /api/pallets/all-factory-stock
 * @access  Private (India Staff, Admin)
 * NOTE: Separates Pallets and Khatlis by type
 */
export const getAllFactoryStock = asyncHandler(async (req, res) => {
    const allStock = await Pallet.aggregate([
        // 1. Filter for only pallets in factory stock
        {
            $match: { status: 'InFactoryStock' }
        },
        // 2. Lookup tile information
        {
            $lookup: {
                from: 'tiles',
                localField: 'tile',
                foreignField: '_id',
                as: 'tileInfo'
            }
        },
        // 3. Unwind tile info
        {
            $unwind: {
                path: '$tileInfo',
                preserveNullAndEmptyArrays: true
            }
        },
        // 4. Lookup factory information
        {
            $lookup: {
                from: 'factories',
                localField: 'factory',
                foreignField: '_id',
                as: 'factoryInfo'
            }
        },
        // 5. Unwind factory info
        {
            $unwind: {
                path: '$factoryInfo',
                preserveNullAndEmptyArrays: true
            }
        },
        // 6. Project the fields we need
        {
            $project: {
                palletId: 1,
                factory: '$factoryInfo',
                tile: '$tileInfo',
                boxCount: 1,
                type: 1, // 'Pallet' or 'Khatli'
                status: 1,
                createdAt: 1
            }
        },
        // 7. Sort by factory name, type, and tile name
        {
            $sort: { 'factory.name': 1, 'type': 1, 'tile.name': 1 }
        }
    ]);

    res.status(200).json(allStock);
});

/**
 * @desc    Get stock for a specific factory with detailed breakdown
 * @route   GET /api/pallets/factory-stock/:factoryId
 * @access  Private (India Staff, Admin)
 * NOTE: Returns all pallets and khatlis for the factory
 */
export const getFactoryStockByFactory = asyncHandler(async (req, res) => {
    const { factoryId } = req.params;

    // Validate factory ID
    if (!mongoose.Types.ObjectId.isValid(factoryId)) {
        res.status(400);
        throw new Error('Invalid factory ID');
    }

    const factoryStock = await Pallet.find({
        factory: factoryId,
        status: 'InFactoryStock'
    })
    .populate({
        path: 'tile',
        select: 'name size surface number'
    })
    .populate({
        path: 'factory',
        select: 'name address'
    })
    .populate({
        path: 'sourcePurchaseOrder',
        select: 'poId'
    })
    .sort({ type: 1, createdAt: -1 }); // Sort by type first (Khatli, then Pallet)

    res.status(200).json(factoryStock);
});

/**
 * @desc    Get aggregated stock summary for a specific factory
 * @route   GET /api/pallets/factory-stock-summary/:factoryId
 * @access  Private (India Staff, Admin)
 * NOTE: Separates summary by type (Pallet vs Khatli)
 */
export const getFactoryStockSummary = asyncHandler(async (req, res) => {
    const { factoryId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(factoryId)) {
        res.status(400);
        throw new Error('Invalid factory ID');
    }

    // Get summary by type
    const summaryByType = await Pallet.aggregate([
        {
            $match: {
                factory: new mongoose.Types.ObjectId(factoryId),
                status: 'InFactoryStock'
            }
        },
        {
            $group: {
                _id: '$type', // Group by type (Pallet or Khatli)
                count: { $sum: 1 },
                totalBoxes: { $sum: '$boxCount' }
            }
        },
        {
            $sort: { '_id': 1 }
        }
    ]);

    // Get detailed summary by tile and type
    const detailedSummary = await Pallet.aggregate([
        {
            $match: {
                factory: new mongoose.Types.ObjectId(factoryId),
                status: 'InFactoryStock'
            }
        },
        {
            $group: {
                _id: {
                    tile: '$tile',
                    boxCount: '$boxCount',
                    type: '$type'
                },
                count: { $sum: 1 },
                totalBoxes: { $sum: '$boxCount' }
            }
        },
        {
            $lookup: {
                from: 'tiles',
                localField: '_id.tile',
                foreignField: '_id',
                as: 'tileInfo'
            }
        },
        {
            $unwind: '$tileInfo'
        },
        {
            $project: {
                _id: 0,
                tile: '$tileInfo',
                boxCount: '$_id.boxCount',
                type: '$_id.type',
                itemCount: '$count',
                totalBoxes: '$totalBoxes'
            }
        },
        {
            $sort: { 'type': 1, 'tile.name': 1 }
        }
    ]);

    // Calculate overall statistics
    const totalItems = summaryByType.reduce((sum, item) => sum + item.count, 0);
    const totalBoxes = summaryByType.reduce((sum, item) => sum + item.totalBoxes, 0);

    // Separate by type
    const palletSummary = summaryByType.find(s => s._id === 'Pallet') || { _id: 'Pallet', count: 0, totalBoxes: 0 };
    const khatliSummary = summaryByType.find(s => s._id === 'Khatli') || { _id: 'Khatli', count: 0, totalBoxes: 0 };

    res.status(200).json({
        factory: factoryId,
        totalItems,
        totalBoxes,
        byType: {
            pallets: {
                count: palletSummary.count,
                totalBoxes: palletSummary.totalBoxes
            },
            khatlis: {
                count: khatliSummary.count,
                totalBoxes: khatliSummary.totalBoxes
            }
        },
        detailedSummary
    });
});

/**
 * @desc    Manually create a single pallet or khatli and adjust stock.
 * @route   POST /api/pallets/manual-adjustment
 * @access  Private (Admin)
 * UPDATED: Now supports custom pallets without PurchaseOrder (poId: 'CUSTOM')
 */
export const createManualPallet = asyncHandler(async (req, res) => {
    const { factoryId, tileId, poId, type, boxCount } = req.body;

    // poId is now optional - can be 'CUSTOM' for custom pallets
    if (!factoryId || !tileId || !type || !boxCount) {
        res.status(400);
        throw new Error('All fields are required: factory, tile, type, and box count.');
    }

    // Validate type
    if (!['Pallet', 'Khatli'].includes(type)) {
        res.status(400);
        throw new Error('Type must be either "Pallet" or "Khatli".');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        let sourcePurchaseOrderId = null;
        let isCustom = false;

        // Check if this is a custom pallet (poId === 'CUSTOM')
        if (poId && poId !== 'CUSTOM') {
            // Validate PO exists for non-custom pallets
            const sourcePO = await PurchaseOrder.findById(poId).session(session);
            if (!sourcePO) {
                throw new Error('Source Purchase Order not found.');
            }
            sourcePurchaseOrderId = poId;
            isCustom = false;
        } else if (poId === 'CUSTOM') {
            // This is a custom pallet without a PO
            sourcePurchaseOrderId = null;
            isCustom = true;
        }

        const newPallet = new Pallet({
            palletId: `PA-${Date.now()}`,
            factory: factoryId,
            tile: tileId,
            sourcePurchaseOrder: sourcePurchaseOrderId,
            type,
            boxCount,
            status: 'InFactoryStock',
            isManualAdjustment: true,
            isCustom: isCustom,
        });
        await newPallet.save({ session });

        await Tile.findByIdAndUpdate(
            tileId,
            { $inc: { 'stockDetails.inFactoryStock': boxCount } },
            { session }
        );

        await session.commitTransaction();
        res.status(201).json(newPallet);

    } catch (error) {
        await session.abortTransaction();
        res.status(400);
        throw new Error(error.message || 'Failed to create pallet/khatli.');
    } finally {
        session.endSession();
    }
});

/**
 * @desc    Delete a single pallet or khatli and revert stock.
 * @route   DELETE /api/pallets/:id
 * @access  Private (Admin)
 */
export const deletePallet = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const palletToDelete = await Pallet.findById(id).session(session);

        if (!palletToDelete) {
            throw new Error('Item not found.');
        }

        if (palletToDelete.status !== 'InFactoryStock') {
            throw new Error(`Cannot delete an item with status '${palletToDelete.status}'. It may already be allocated to a shipment.`);
        }

        await Tile.findByIdAndUpdate(
            palletToDelete.tile,
            { $inc: { 'stockDetails.inFactoryStock': -palletToDelete.boxCount } },
            { session }
        );

        await palletToDelete.deleteOne({ session });

        await session.commitTransaction();
        res.status(200).json({ message: 'Item deleted and stock reverted successfully.' });

    } catch (error) {
        await session.abortTransaction();
        res.status(400);
        throw new Error(error.message || 'Failed to delete item.');
    } finally {
        session.endSession();
    }
});

/**
 * @desc    Get detailed list of pallets/khatlis for a specific tile at a specific factory.
 * @route   GET /api/pallets/details/:factoryId/:tileId
 * @access  Private (Admin)
 */
export const getPalletDetailsForTile = asyncHandler(async (req, res) => {
    const { factoryId, tileId } = req.params;

    const pallets = await Pallet.find({
        factory: factoryId,
        tile: tileId,
        status: 'InFactoryStock'
    })
    .populate('sourcePurchaseOrder', 'poId')
    .sort({ type: 1, createdAt: -1 });

    res.status(200).json(pallets);
});

/**
 * @desc    Update the box count of a single pallet/khatli and adjust stock.
 * @route   PUT /api/pallets/:id
 * @access  Private (Admin)
 */
export const updatePalletBoxCount = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { newBoxCount } = req.body;

    if (!newBoxCount || newBoxCount <= 0) {
        res.status(400);
        throw new Error('A valid new box count is required.');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const palletToUpdate = await Pallet.findById(id).session(session);

        if (!palletToUpdate) {
            throw new Error('Item not found.');
        }
        if (palletToUpdate.status !== 'InFactoryStock') {
            throw new Error(`Cannot edit an item with status '${palletToUpdate.status}'.`);
        }

        const oldCount = palletToUpdate.boxCount;
        const newCount = Number(newBoxCount);
        const stockDifference = newCount - oldCount;

        // Update the tile stock by the difference
        await Tile.findByIdAndUpdate(
            palletToUpdate.tile,
            { $inc: { 'stockDetails.inFactoryStock': stockDifference } },
            { session }
        );

        // Update the pallet's box count
        palletToUpdate.boxCount = newCount;
        await palletToUpdate.save({ session });

        await session.commitTransaction();
        res.status(200).json(palletToUpdate);

    } catch (error) {
        await session.abortTransaction();
        res.status(400);
        throw new Error(error.message || 'Failed to update item.');
    } finally {
        session.endSession();
    }
});

/**
 * @desc    Get all available pallets from ALL factories
 * @route   GET /api/pallets/available-stock
 * @access  Private (Admin, India-Staff)
 */
export const getAllAvailablePallets = asyncHandler(async (req, res) => {
    const allAvailablePallets = await Pallet.find({
        status: 'InFactoryStock',
    })
    .populate({ path: 'tile', select: 'name size surface' })
    .populate({ path: 'factory', select: 'name' })
    .sort({ type: 1, 'factory.name': 1, createdAt: 1 });

    res.status(200).json(allAvailablePallets);
});

/**
 * @desc    Get available pallets for a specific factory
 * @route   GET /api/pallets/available/:factoryId
 * @access  Private (Admin, India-Staff)
 */
export const getAvailablePalletsByFactory = asyncHandler(async (req, res) => {
    const { factoryId } = req.params;

    const availablePallets = await Pallet.find({
        factory: factoryId,
        status: 'InFactoryStock',
    })
    .populate({ path: 'tile', select: 'name size surface' })
    .populate({ path: 'factory', select: 'name' })
    .sort({ type: 1, createdAt: 1 });

    res.status(200).json(availablePallets);
});
