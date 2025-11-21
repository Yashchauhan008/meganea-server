// backend/src/controllers/purchaseOrderController.js

import mongoose from 'mongoose';
import asyncHandler from '../utils/asyncHandler.js';
import PurchaseOrder from '../models/purchaseOrderModel.js';
import RestockRequest from '../models/restockRequestModel.js';
import Tile from '../models/tileModel.js';
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
    // --- STEP 1: Define a variable to hold our updated request ---
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
                        
                        const itemToUpdate = restockRequest.requestedItems[restockItemIndex];

                        if ((itemToUpdate.quantityInPO + totalBoxesInThisPO) > itemToUpdate.quantityRequested) {
                            throw new Error(`Cannot assign ${totalBoxesInThisPO} boxes. Only ${itemToUpdate.quantityRequested - itemToUpdate.quantityInPO} boxes are pending.`);
                        }

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
                // --- STEP 2: Save the final state to our variable ---
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

    // --- STEP 3: THE FINAL FIX ---
    // Instead of re-fetching, we populate the object we already have in memory.
    try {
        const populatedPO = await PurchaseOrder.findById(savedPO._id)
            .populate('factory', 'name')
            .populate('items.tile', 'name');

        // Manually populate the `finalRestockRequest` object before sending it.
        // This is guaranteed to have the correct `quantityInPO` values.
        const responseRestockRequest = await finalRestockRequest.populate([
            { path: 'requestedItems.tile', select: 'name size manufacturingFactories' },
            { path: 'requestedItems.purchaseOrder', select: 'poId' }
        ]);
            
        if (!populatedPO) {
            throw new Error('Purchase Order created but could not be retrieved for response.');
        }

        // Now, we send the correctly populated, up-to-date objects.
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

// This function remains unchanged.
export const getAllPurchaseOrders = asyncHandler(async (req, res) => {
    const purchaseOrders = await PurchaseOrder.find({})
        .populate('factory', 'name')
        .populate('createdBy', 'username')
        .populate({
            path: 'sourceRestockRequest',
            select: 'requestId'
        })
        .sort({ createdAt: -1 });

    res.status(200).json(purchaseOrders);
});
