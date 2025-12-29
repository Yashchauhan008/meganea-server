
import mongoose from 'mongoose';
import asyncHandler from '../utils/asyncHandler.js';
import PurchaseOrder from '../models/purchaseOrderModel.js';
import RestockRequest from '../models/restockRequestModel.js';
import Tile from '../models/tileModel.js';
import Pallet from '../models/palletModel.js';
import { generateId } from '../services/idGenerator.js';

export const createPurchaseOrder = asyncHandler(async (req, res) => {
    const {
        sourceRestockRequestId,
        factoryId,
        items,
        packingRules,
        notes
    } = req.body;

    if (!factoryId || !items || items.length === 0 || !packingRules) {
        res.status(400).throw(new Error('Factory, items, and packing rules are required fields.'));
    }

    const session = await mongoose.startSession();
    let savedPO;
    let finalRestockRequest; 

    try {
        session.startTransaction();
        
        const poId = await generateId('PO');
        
        for (const item of items) {
            const boxesFromPallets = (item.palletsOrdered || 0) * (packingRules.boxesPerPallet || 0);
            const boxesFromKhatlis = (item.khatlisOrdered || 0) * (packingRules.boxesPerKhatli || 0);
            const totalBoxes = boxesFromPallets + boxesFromKhatlis;

            if (totalBoxes <= 0) throw new Error(`Order for a tile must contain at least one box.`);

            await Tile.findByIdAndUpdate(
                item.tileId,
                { $inc: { 'stockDetails.restockingStock': totalBoxes } },
                { session }
            );
        }

        const newPO = new PurchaseOrder({
            poId,
            sourceRestockRequest: sourceRestockRequestId || null,
            factory: factoryId,
            items: items.map(item => ({
                tile: item.tileId,
                palletsOrdered: item.palletsOrdered,
                khatlisOrdered: item.khatlisOrdered,
            })),
            packingRules,
            notes,
            createdBy: req.user._id,
        });

        savedPO = await newPO.save({ session });

        if (sourceRestockRequestId) {
            const restockRequest = await RestockRequest.findById(sourceRestockRequestId).session(session);
            if (restockRequest) {
                for (const poItem of savedPO.items) {
                    const restockItemIndex = restockRequest.requestedItems.findIndex(
                        item => String(item.tile) === String(poItem.tile)
                    );

                    if (restockItemIndex > -1) {
                        const boxesFromPallets = (poItem.palletsOrdered || 0) * (savedPO.packingRules.boxesPerPallet || 0);
                        const boxesFromKhatlis = (poItem.khatlisOrdered || 0) * (savedPO.packingRules.boxesPerKhatli || 0);
                        const totalBoxesInThisPO = boxesFromPallets + boxesFromKhatlis;
                        
                        restockRequest.requestedItems[restockItemIndex].quantityInPO += totalBoxesInThisPO;
                        restockRequest.requestedItems[restockItemIndex].purchaseOrder = savedPO._id;
                    }
                }

                const allItemsFulfilled = restockRequest.requestedItems.every(
                    item => item.quantityInPO >= item.quantityRequested
                );

                if (allItemsFulfilled && restockRequest.status === 'Pending') {
                    restockRequest.status = 'Processing';
                }
                
                restockRequest.markModified('requestedItems');
                finalRestockRequest = await restockRequest.save({ session });
            }
        }

        await session.commitTransaction();

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(400);
        throw new Error(error.message || 'Failed to create Purchase Order during transaction.');
    } 
    
    session.endSession();

    try {
        const populatedPO = await PurchaseOrder.findById(savedPO._id)
            .populate('factory', 'name')
            .populate('items.tile', 'name');

        const responseRestockRequest = await finalRestockRequest.populate([
            { 
                path: 'requestedItems.tile', 
                select: 'name size manufacturingFactories',
                populate: {
                    path: 'manufacturingFactories',
                    model: 'Factory',
                    select: 'name'
                }
            },
            { 
                path: 'requestedItems.purchaseOrder', 
                select: 'poId' 
            }
        ]);
            
        if (!populatedPO) {
            throw new Error('Purchase Order created but could not be retrieved for response.');
        }

        res.status(201).json({
            purchaseOrder: populatedPO,
            restockRequest: responseRestockRequest
        });

    } catch (responseError) {
        console.error("Error preparing response after successful commit:", responseError);
        res.status(201).json({ 
            message: 'Purchase Order created successfully, but there was an error generating the full response.',
            poId: savedPO.poId 
        });
    }
});

export const getAllPurchaseOrders = asyncHandler(async (req, res) => {
    const purchaseOrders = await PurchaseOrder.find({})
        .populate('factory', 'name')
        .populate('createdBy', 'username')
        .populate({
            path: 'sourceRestockRequest',
            select: 'requestId'
        })
        .populate({
            path: 'items.tile',
            select: 'name'
        })
        .sort({ createdAt: -1 });

    res.status(200).json(purchaseOrders);
});

export const getPurchaseOrderById = asyncHandler(async (req, res) => {
    const po = await PurchaseOrder.findById(req.params.id)
        .populate('factory', 'name')
        .populate('createdBy', 'username')
        .populate({
            path: 'sourceRestockRequest',
            select: 'requestId'
        })
        .populate({
            path: 'items.tile',
            select: 'name'
        });

    if (!po) {
        res.status(404);
        throw new Error('Purchase Order not found');
    }

    res.status(200).json(po);
});

export const updatePurchaseOrderStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    const { id } = req.params;

    const validStatuses = ['Draft', 'SentToFactory', 'Manufacturing', 'QC_InProgress', 'QC_Completed', 'Packing', 'Completed', 'Cancelled'];
    if (!status || !validStatuses.includes(status)) {
        res.status(400);
        throw new Error('Invalid status provided.');
    }

    const po = await PurchaseOrder.findById(id);

    if (!po) {
        res.status(404);
        throw new Error('Purchase Order not found.');
    }

    if (po.status === 'Completed' || po.status === 'Cancelled') {
        res.status(400);
        throw new Error(`Cannot change status of a PO that is already ${po.status}.`);
    }

    po.status = status;
    const updatedPO = await po.save();

    const populatedPO = await PurchaseOrder.findById(updatedPO._id)
        .populate('factory', 'name')
        .populate('createdBy', 'username')
        .populate({ path: 'sourceRestockRequest', select: 'requestId' })
        .populate({ path: 'items.tile', select: 'name' });

    res.status(200).json(populatedPO);
});

export const recordQC = asyncHandler(async (req, res) => {
    const { poId, itemId } = req.params;
    const { quantityChecked, quantityPassed, quantityFailed, notes } = req.body;
    const userId = req.user._id;

    if (quantityPassed + quantityFailed !== quantityChecked) {
        res.status(400);
        throw new Error('Passed quantity and Failed quantity must sum up to the Checked quantity.');
    }

    const po = await PurchaseOrder.findById(poId);
    if (!po) {
        res.status(404);
        throw new Error('Purchase Order not found.');
    }

    const item = po.items.id(itemId);
    if (!item) {
        res.status(404);
        throw new Error('Item not found in this Purchase Order.');
    }

    item.qcHistory.push({
        quantityChecked,
        quantityPassed,
        quantityFailed,
        notes,
        checkedBy: userId,
    });

    item.quantityPassedQC += quantityPassed;

    if (po.status === 'Manufacturing') {
        po.status = 'QC_InProgress';
    }

    await po.save();

    const populatedPO = await PurchaseOrder.findById(po._id)
        .populate('factory', 'name')
        .populate('createdBy', 'username')
        .populate({ path: 'sourceRestockRequest', select: 'requestId' })
        .populate({ path: 'items.tile', select: 'name' });

    res.status(200).json(populatedPO);
});

// UPDATED: Generate pallets - supports both full generation and partial (per item)
export const generatePalletsFromPO = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { itemId } = req.body; // Optional: if provided, only generate for this item

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const po = await PurchaseOrder.findById(id).session(session);
        if (!po) {
            throw new Error('Purchase Order not found.');
        }

        // Allow generation during QC_InProgress, QC_Completed, or Packing
        const allowedStatuses = ['QC_InProgress', 'QC_Completed', 'Packing'];
        if (!allowedStatuses.includes(po.status)) {
            throw new Error(`Cannot generate pallets. PO status is '${po.status}'. Status must be one of: ${allowedStatuses.join(', ')}.`);
        }

        const palletsToCreate = [];
        const boxesPerPallet = po.packingRules.boxesPerPallet;
        const boxesPerKhatli = po.packingRules.boxesPerKhatli;

        // Determine which items to process
        const itemsToProcess = itemId 
            ? [po.items.id(itemId)]
            : po.items;

        if (itemId && !itemsToProcess[0]) {
            throw new Error('Item not found in this Purchase Order.');
        }

        for (const item of itemsToProcess) {
            if (!item) continue;

            // Calculate how many boxes are available to convert
            const qcPassed = item.quantityPassedQC || 0;
            const alreadyConverted = item.boxesConverted || 0;
            const availableBoxes = qcPassed - alreadyConverted;

            if (availableBoxes <= 0) {
                if (itemId) {
                    throw new Error(`No new QC-passed boxes available for ${item.tile?.name || 'this item'}. Already converted: ${alreadyConverted}, QC Passed: ${qcPassed}`);
                }
                continue; // Skip this item in bulk generation
            }

            // Calculate how many pallets ordered vs generated
            const palletsOrdered = item.palletsOrdered || 0;
            const khatlisOrdered = item.khatlisOrdered || 0;
            const palletsAlreadyGenerated = item.palletsGenerated || 0;
            const khatlisAlreadyGenerated = item.khatlisGenerated || 0;

            // Calculate remaining pallets/khatlis to generate
            const remainingPallets = palletsOrdered - palletsAlreadyGenerated;
            const remainingKhatlis = khatlisOrdered - khatlisAlreadyGenerated;

            // Calculate how many pallets/khatlis we can generate with available boxes
            let boxesUsed = 0;
            let palletsToGen = 0;
            let khatlisToGen = 0;

            // Prioritize pallets first
            const maxPalletsFromBoxes = Math.floor(availableBoxes / boxesPerPallet);
            palletsToGen = Math.min(remainingPallets, maxPalletsFromBoxes);
            boxesUsed += palletsToGen * boxesPerPallet;

            // Then khatlis with remaining boxes
            const remainingBoxesForKhatlis = availableBoxes - boxesUsed;
            const maxKhatlisFromBoxes = Math.floor(remainingBoxesForKhatlis / boxesPerKhatli);
            khatlisToGen = Math.min(remainingKhatlis, maxKhatlisFromBoxes);
            boxesUsed += khatlisToGen * boxesPerKhatli;

            if (palletsToGen === 0 && khatlisToGen === 0) {
                if (itemId) {
                    throw new Error(`Not enough QC-passed boxes to generate any pallets/khatlis. Available: ${availableBoxes} boxes, needs ${boxesPerPallet} per pallet or ${boxesPerKhatli} per khatli.`);
                }
                continue;
            }

            // Create pallet records
            for (let i = 0; i < palletsToGen; i++) {
                const palletId = await generateId('PA');
                palletsToCreate.push({
                    palletId,
                    factory: po.factory,
                    tile: item.tile,
                    type: 'Pallet',
                    boxCount: boxesPerPallet,
                    sourcePurchaseOrder: po._id,
                });
            }

            // Create khatli records
            for (let i = 0; i < khatlisToGen; i++) {
                const palletId = await generateId('PA');
                palletsToCreate.push({
                    palletId,
                    factory: po.factory,
                    tile: item.tile,
                    type: 'Khatli',
                    boxCount: boxesPerKhatli,
                    sourcePurchaseOrder: po._id,
                });
            }

            // Update item tracking
            item.boxesConverted = alreadyConverted + boxesUsed;
            item.palletsGenerated = palletsAlreadyGenerated + palletsToGen;
            item.khatlisGenerated = khatlisAlreadyGenerated + khatlisToGen;
        }

        if (palletsToCreate.length === 0) {
            throw new Error('No pallets or khatlis could be generated. Check QC progress.');
        }

        // Insert pallets
        const createdPallets = await Pallet.insertMany(palletsToCreate, { session });
        const palletIds = createdPallets.map(p => p._id);
        po.generatedPallets.push(...palletIds);

        // Update status if all items are fully generated
        const allItemsFullyGenerated = po.items.every(item => {
            const palletsOrdered = item.palletsOrdered || 0;
            const khatlisOrdered = item.khatlisOrdered || 0;
            const palletsGenerated = item.palletsGenerated || 0;
            const khatlisGenerated = item.khatlisGenerated || 0;
            return palletsGenerated >= palletsOrdered && khatlisGenerated >= khatlisOrdered;
        });

        if (allItemsFullyGenerated) {
            po.status = 'Completed';
        } else if (po.status === 'QC_Completed') {
            po.status = 'Packing'; // Move to packing if partial generation started
        }

        await po.save({ session });
        await session.commitTransaction();

        const finalPO = await PurchaseOrder.findById(id)
            .populate('factory', 'name')
            .populate('createdBy', 'username')
            .populate({ path: 'sourceRestockRequest', select: 'requestId' })
            .populate('items.tile', 'name')
            .populate('generatedPallets');

        res.status(200).json(finalPO);

    } catch (error) {
        await session.abortTransaction();
        res.status(400);
        throw new Error(error.message || 'Failed to generate pallets.');
    } finally {
        session.endSession();
    }
});