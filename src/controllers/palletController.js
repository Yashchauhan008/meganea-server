import asyncHandler from '../utils/asyncHandler.js';
import Pallet from '../models/palletModel.js';
import Tile from '../models/tileModel.js';
import PurchaseOrder from '../models/purchaseOrderModel.js';
import mongoose from 'mongoose';

/**
 * @desc    Get all pallets currently in factory stock, grouped by factory and tile.
 * @route   GET /api/pallets/factory-stock
 * @access  Private (India Staff, Admin)
 */
export const getFactoryStock = asyncHandler(async (req, res) => {
    const stock = await Pallet.aggregate([
        // 1. Filter for only the pallets that are physically in the factory.
        {
            $match: { status: 'InFactoryStock' }
        },
        // 2. Group pallets by their factory and tile type, and collect pallet docs.
        {
            $group: {
                _id: {
                    factory: '$factory',
                    tile: '$tile'
                },
                totalPallets: { $sum: { $cond: [{ $eq: ['$type', 'Pallet'] }, 1, 0] } },
                totalKhatlis: { $sum: { $cond: [{ $eq: ['$type', 'Khatli'] }, 1, 0] } },
                totalBoxes: { $sum: '$boxCount' },
            }
        },
        // 3. Populate the tile information (name, size).
        {
            $lookup: {
                from: 'tiles', // The actual name of the tiles collection in MongoDB
                localField: '_id.tile',
                foreignField: '_id',
                as: 'tileInfo'
            }
        },
        // 4. Deconstruct the tileInfo array to a single object.
        {
            $unwind: '$tileInfo'
        },
        // 5. Group the results by factory.
        {
            $group: {
                _id: '$_id.factory',
                tiles: {
                    $push: {
                        tile: '$tileInfo',
                        totalPallets: '$totalPallets',
                        totalKhatlis: '$totalKhatlis',
                        totalBoxes: '$totalBoxes',
                    }
                }
            }
        },
        // 6. Populate the factory information (name).
        {
            $lookup: {
                from: 'factories', // The actual name of the factories collection
                localField: '_id',
                foreignField: '_id',
                as: 'factoryInfo'
            }
        },
        // 7. Deconstruct the factoryInfo array.
        {
            $unwind: '$factoryInfo'
        },
        // 8. Project the final, clean structure for the frontend.
        {
            $project: {
                _id: 0, // Exclude the default _id
                factory: '$factoryInfo',
                tiles: '$tiles'
            }
        },
        // 9. Sort the final results by factory name.
        {
            $sort: { 'factory.name': 1 }
        }
    ]);

    res.status(200).json(stock);
});

/**
 * @desc    Manually create a single pallet and adjust stock.
 * @route   POST /api/pallets/manual-adjustment
 * @access  Private (Admin)
 */
export const createManualPallet = asyncHandler(async (req, res) => {
    const { factoryId, tileId, poId, type, boxCount } = req.body;

    if (!factoryId || !tileId || !poId || !type || !boxCount) {
        res.status(400);
        throw new Error('All fields are required: factory, tile, PO, type, and box count.');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const sourcePO = await PurchaseOrder.findById(poId).session(session);
        if (!sourcePO) {
            throw new Error('Source Purchase Order not found.');
        }

        const newPallet = new Pallet({
            factory: factoryId,
            tile: tileId,
            sourcePurchaseOrder: poId,
            type,
            boxCount,
            status: 'InFactoryStock',
            isManualAdjustment: true,
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
        throw new Error(error.message || 'Failed to create manual pallet.');
    } finally {
        session.endSession();
    }
});


/**
 * @desc    Delete a single pallet and revert stock.
 * @route   DELETE /api/pallets/pallet/:id
 * @access  Private (Admin)
 */
export const deletePallet = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const palletToDelete = await Pallet.findById(id).session(session);

        if (!palletToDelete) {
            throw new Error('Pallet not found.');
        }

        if (palletToDelete.status !== 'InFactoryStock') {
            throw new Error(`Cannot delete a pallet with status '${palletToDelete.status}'. It may already be allocated to a shipment.`);
        }

        await Tile.findByIdAndUpdate(
            palletToDelete.tile,
            { $inc: { 'stockDetails.inFactoryStock': -palletToDelete.boxCount } },
            { session }
        );

        await palletToDelete.deleteOne({ session });

        await session.commitTransaction();
        res.status(200).json({ message: 'Pallet deleted and stock reverted successfully.' });

    } catch (error) {
        await session.abortTransaction();
        res.status(400);
        throw new Error(error.message || 'Failed to delete pallet.');
    } finally {
        session.endSession();
    }
});

/**
 * @desc    Get detailed list of pallets for a specific tile at a specific factory.
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
    // --- THIS IS THE FIX ---
    // Populate the 'sourcePurchaseOrder' field to get the poId.
    // We only select the 'poId' field to keep the payload small.
    .populate('sourcePurchaseOrder', 'poId') 
    .sort({ createdAt: -1 });

    res.status(200).json(pallets);
});


// backend/src/controllers/palletController.js
// ... (keep all other controller functions)

/**
 * @desc    Update the box count of a single pallet and adjust stock.
 * @route   PUT /api/pallets/pallet/:id
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
            throw new Error('Pallet not found.');
        }
        if (palletToUpdate.status !== 'InFactoryStock') {
            throw new Error(`Cannot edit a pallet with status '${palletToUpdate.status}'.`);
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
        throw new Error(error.message || 'Failed to update pallet.');
    } finally {
        session.endSession();
    }
});

/**
 * @desc    Get all available pallets in stock for a specific factory
 * @route   GET /api/pallets/available-stock/:factoryId
 * @access  Private (Admin, India-Staff)
 */
export const getAvailablePalletsByFactory = asyncHandler(async (req, res) => {
    const { factoryId } = req.params;

    const availablePallets = await Pallet.find({
        factory: factoryId,
        status: 'InFactoryStock',
    })
    .populate('tile', 'name size')
    .sort({ createdAt: 1 }); // FIFO logic - oldest pallets first

    res.status(200).json(availablePallets);
});