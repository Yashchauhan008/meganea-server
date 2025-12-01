// backend/src/controllers/purchaseOrderController.js

import mongoose from 'mongoose';
import asyncHandler from '../utils/asyncHandler.js';
import PurchaseOrder from '../models/purchaseOrderModel.js';
import RestockRequest from '../models/restockRequestModel.js';
import Tile from '../models/tileModel.js';
import Pallet from '../models/palletModel.js'; // <-- IMPORT THE NEW PALLET MODEL
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

            // This logic remains correct: we are increasing the "restocking" count by the amount ordered.
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
                        
                        // --- THIS IS THE MODIFICATION ---
                        // The validation block that checked for over-assignment has been completely REMOVED.
                        // We will now simply add the PO quantity to the tracking field, regardless of whether it's more or less.
                        //
                        // DELETED CODE BLOCK:
                        // if ((itemToUpdate.quantityInPO + totalBoxesInThisPO) > itemToUpdate.quantityRequested) {
                        //     throw new Error(`Cannot assign ${totalBoxesInThisPO} boxes...`);
                        // }
                        // ---------------------------------

                        restockRequest.requestedItems[restockItemIndex].quantityInPO += totalBoxesInThisPO;
                        restockRequest.requestedItems[restockItemIndex].purchaseOrder = savedPO._id;
                    }
                }

                // This logic also remains correct. It will mark the request as 'Processing'
                // if the ordered amount MEETS or EXCEEDS the requested amount.
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
        // This is the crucial addition. It tells Mongoose to look inside the 'items' array
        // and for each 'tile' field, fetch the corresponding document from the 'Tile' collection
        // and select only its 'name'.
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

    // Basic validation
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

    // Add any business logic rules here, e.g., cannot revert from 'Completed'
    if (po.status === 'Completed' || po.status === 'Cancelled') {
        res.status(400);
        throw new Error(`Cannot change status of a PO that is already ${po.status}.`);
    }

    po.status = status;
    const updatedPO = await po.save();

    // Populate the response to match what the modal expects
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

    // --- 1. Basic Validation ---
    if (quantityPassed + quantityFailed !== quantityChecked) {
        res.status(400);
        throw new Error('Passed quantity and Failed quantity must sum up to the Checked quantity.');
    }

    const po = await PurchaseOrder.findById(poId);
    if (!po) {
        res.status(404);
        throw new Error('Purchase Order not found.');
    }

    // --- 2. Find the specific item within the PO's items array ---
    const item = po.items.id(itemId);
    if (!item) {
        res.status(404);
        throw new Error('Item not found in this Purchase Order.');
    }

    // --- 3. Add the new QC record to the history ---
    item.qcHistory.push({
        quantityChecked,
        quantityPassed,
        quantityFailed,
        notes,
        checkedBy: userId,
    });

    // --- 4. Update the total passed quantity for that item ---
    item.quantityPassedQC += quantityPassed;

    // --- 5. Update the overall PO status ---
    // If this is the first QC record, move the status to In Progress
    if (po.status === 'Manufacturing') {
        po.status = 'QC_InProgress';
    }

    // --- 6. Save the changes to the database ---
    await po.save();

    // --- 7. Send back the fully populated PO for the UI to update ---
    const populatedPO = await PurchaseOrder.findById(po._id)
        .populate('factory', 'name')
        .populate('createdBy', 'username')
        .populate({ path: 'sourceRestockRequest', select: 'requestId' })
        .populate({ path: 'items.tile', select: 'name' });

    res.status(200).json(populatedPO);
});

export const generatePalletsFromPO = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const po = await PurchaseOrder.findById(id).session(session);
        if (!po) {
            throw new Error('Purchase Order not found.');
        }

        // --- Validation ---
        if (po.status !== 'QC_Completed') {
            throw new Error(`Cannot generate pallets. PO status is '${po.status}', but must be 'QC_Completed'.`);
        }

        const allItemsQCPassed = po.items.every(item => item.quantityPassedQC >= item.totalBoxesOrdered);
        if (!allItemsQCPassed) {
            throw new Error('Not all items have passed QC. Please complete all QC checks.');
        }

        const newPallets = [];

        // --- Generation Loop ---
        for (const item of po.items) {
            // Generate Pallets
            for (let i = 0; i < item.palletsOrdered; i++) {
                const palletDoc = new Pallet({
                    factory: po.factory,
                    tile: item.tile,
                    type: 'Pallet',
                    boxCount: po.packingRules.boxesPerPallet,
                    sourcePurchaseOrder: po._id,
                });
                newPallets.push(palletDoc);
            }
            // Generate Khatlis
            for (let i = 0; i < item.khatlisOrdered; i++) {
                const palletDoc = new Pallet({
                    factory: po.factory,
                    tile: item.tile,
                    type: 'Khatli',
                    boxCount: po.packingRules.boxesPerKhatli,
                    sourcePurchaseOrder: po._id,
                });
                newPallets.push(palletDoc);
            }
        }

        if (newPallets.length > 0) {
            const createdPallets = await Pallet.insertMany(newPallets, { session });
            const palletIds = createdPallets.map(p => p._id);
            po.generatedPallets.push(...palletIds);
        }

        // --- Final Status Update ---
        po.status = 'Completed'; // Or 'Packing' if you have a separate packing step
        await po.save({ session });

        await session.commitTransaction();

        // Fetch the fully populated PO to send back to the frontend
        const finalPO = await PurchaseOrder.findById(id)
            .populate('factory', 'name')
            .populate('items.tile', 'name')
            .populate('generatedPallets'); // Populate the new field

        res.status(200).json(finalPO);

    } catch (error) {
        await session.abortTransaction();
        res.status(400);
        throw new Error(error.message || 'Failed to generate pallets.');
    } finally {
        session.endSession();
    }
});