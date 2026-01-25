// FILE: backend/src/controllers/purchaseOrderController.js
// COMPLETE FILE - Replace entire file

import mongoose from 'mongoose';
import asyncHandler from '../utils/asyncHandler.js';
import PurchaseOrder from '../models/purchaseOrderModel.js';
import RestockRequest from '../models/restockRequestModel.js';
import Tile from '../models/tileModel.js';
import Pallet from '../models/palletModel.js';
import { generateId } from '../services/idGenerator.js';

// ===== CREATE PURCHASE ORDER =====
export const createPurchaseOrder = asyncHandler(async (req, res) => {
    const {
        sourceRestockRequestId,
        factoryId,
        items,
        packingRules,
        notes
    } = req.body;

    if (!factoryId || !items || items.length === 0 || !packingRules) {
        res.status(400);
        throw new Error('Factory, items, and packing rules are required fields.');
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

        if (finalRestockRequest) {
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
                
            res.status(201).json({
                purchaseOrder: populatedPO,
                restockRequest: responseRestockRequest
            });
        } else {
            res.status(201).json({
                purchaseOrder: populatedPO,
                restockRequest: null
            });
        }

    } catch (responseError) {
        console.error("Error preparing response after successful commit:", responseError);
        res.status(201).json({ 
            message: 'Purchase Order created successfully, but there was an error generating the full response.',
            poId: savedPO.poId 
        });
    }
});

// ===== GET ALL PURCHASE ORDERS =====
export const getAllPurchaseOrders = asyncHandler(async (req, res) => {
    const purchaseOrders = await PurchaseOrder.find({ deleted: { $ne: true } })
        .populate('factory', 'name')
        .populate('createdBy', 'username')
        .populate({ path: 'sourceRestockRequest', select: 'requestId' })
        .populate({ path: 'items.tile', select: 'name tileNumber size' })
        .sort({ createdAt: -1 });

    res.status(200).json(purchaseOrders);
});

// ===== GET PURCHASE ORDER BY ID =====
export const getPurchaseOrderById = asyncHandler(async (req, res) => {
    const po = await PurchaseOrder.findById(req.params.id)
        .populate('factory', 'name')
        .populate('createdBy', 'username')
        .populate({ path: 'sourceRestockRequest', select: 'requestId' })
        .populate({ path: 'items.tile', select: 'name tileNumber size' });

    if (!po) {
        res.status(404);
        throw new Error('Purchase Order not found');
    }

    res.status(200).json(po);
});

// ===== UPDATE PURCHASE ORDER STATUS =====
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
        .populate({ path: 'items.tile', select: 'name tileNumber size' });

    res.status(200).json(populatedPO);
});

// ===== RECORD QC =====
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
        .populate({ path: 'items.tile', select: 'name tileNumber size' });

    res.status(200).json(populatedPO);
});

// ===== GENERATE PALLETS FROM PO =====
// export const generatePalletsFromPO = asyncHandler(async (req, res) => {
//     const { id } = req.params;
//     const { itemId } = req.body;

//     const session = await mongoose.startSession();
//     session.startTransaction();

//     try {
//         const po = await PurchaseOrder.findById(id).session(session);
//         if (!po) {
//             throw new Error('Purchase Order not found.');
//         }

//         if (!['QC_Completed', 'Packing'].includes(po.status)) {
//             throw new Error(`Cannot generate pallets. PO status is '${po.status}', but must be 'QC_Completed' or 'Packing'.`);
//         }

//         const palletsToCreate = [];
//         const itemsToProcess = itemId 
//             ? po.items.filter(item => item._id.toString() === itemId)
//             : po.items;

//         for (const item of itemsToProcess) {
//             if (item.quantityPassedQC < item.totalBoxesOrdered) {
//                 if (itemId) {
//                     throw new Error(`Item has not passed QC. Passed: ${item.quantityPassedQC}, Required: ${item.totalBoxesOrdered}`);
//                 }
//                 continue;
//             }

//             const existingPallets = await Pallet.countDocuments({
//                 sourcePurchaseOrder: po._id,
//                 tile: item.tile,
//                 type: 'Pallet'
//             }).session(session);

//             const existingKhatlis = await Pallet.countDocuments({
//                 sourcePurchaseOrder: po._id,
//                 tile: item.tile,
//                 type: 'Khatli'
//             }).session(session);

//             const palletsRemaining = (item.palletsOrdered || 0) - existingPallets;
//             const khatlisRemaining = (item.khatlisOrdered || 0) - existingKhatlis;

//             for (let i = 0; i < palletsRemaining; i++) {
//                 const palletId = await generateId('PA');
//                 palletsToCreate.push({
//                     palletId,
//                     factory: po.factory,
//                     tile: item.tile,
//                     type: 'Pallet',
//                     boxCount: po.packingRules.boxesPerPallet,
//                     sourcePurchaseOrder: po._id,
//                     status: 'InFactoryStock'
//                 });
//             }

//             for (let i = 0; i < khatlisRemaining; i++) {
//                 const palletId = await generateId('PA');
//                 palletsToCreate.push({
//                     palletId,
//                     factory: po.factory,
//                     tile: item.tile,
//                     type: 'Khatli',
//                     boxCount: po.packingRules.boxesPerKhatli,
//                     sourcePurchaseOrder: po._id,
//                     status: 'InFactoryStock'
//                 });
//             }

//             item.palletsGenerated = (item.palletsGenerated || 0) + palletsRemaining;
//             item.khatlisGenerated = (item.khatlisGenerated || 0) + khatlisRemaining;
//             item.boxesConverted = (item.boxesConverted || 0) + 
//                 (palletsRemaining * po.packingRules.boxesPerPallet) + 
//                 (khatlisRemaining * po.packingRules.boxesPerKhatli);
//         }

//         if (palletsToCreate.length > 0) {
//             const createdPallets = await Pallet.insertMany(palletsToCreate, { session });
//             const palletIds = createdPallets.map(p => p._id);
//             po.generatedPallets.push(...palletIds);
//         }

//         const allGenerated = po.items.every(item => {
//             const palletsGenerated = item.palletsGenerated || 0;
//             const khatlisGenerated = item.khatlisGenerated || 0;
//             return palletsGenerated >= item.palletsOrdered && khatlisGenerated >= item.khatlisOrdered;
//         });

//         if (allGenerated) {
//             po.status = 'Completed';
//         } else if (po.status === 'QC_Completed') {
//             po.status = 'Packing';
//         }

//         await po.save({ session });
//         await session.commitTransaction();

//         const finalPO = await PurchaseOrder.findById(id)
//             .populate('factory', 'name')
//             .populate('items.tile', 'name tileNumber size')
//             .populate('generatedPallets');

//         res.status(200).json(finalPO);

//     } catch (error) {
//         await session.abortTransaction();
//         res.status(400);
//         throw new Error(error.message || 'Failed to generate pallets.');
//     } finally {
//         session.endSession();
//     }
// });
export const generatePalletsFromPO = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const po = await PurchaseOrder.findById(id).session(session);
        if (!po) {
            throw new Error('Purchase Order not found.');
        }

        if (po.status !== 'QC_Completed') {
            throw new Error(`Cannot generate pallets. PO status is '${po.status}', but must be 'QC_Completed'.`);
        }

        const allItemsQCPassed = po.items.every(item => item.quantityPassedQC >= item.totalBoxesOrdered);
        if (!allItemsQCPassed) {
            throw new Error('Not all items have passed QC. Please complete all QC checks.');
        }

        const palletsToCreate = [];
        const tileStockUpdates = new Map(); // *** NEW: Track stock updates ***

        for (const item of po.items) {
            // *** NEW: Calculate total boxes for stock update ***
            const boxesFromPallets = item.palletsOrdered * po.packingRules.boxesPerPallet;
            const boxesFromKhatlis = item.khatlisOrdered * po.packingRules.boxesPerKhatli;
            const totalBoxes = boxesFromPallets + boxesFromKhatlis;

            // *** NEW: Track stock update for this tile ***
            const tileId = item.tile.toString();
            tileStockUpdates.set(tileId, (tileStockUpdates.get(tileId) || 0) + totalBoxes);

            // Create pallets
            for (let i = 0; i < item.palletsOrdered; i++) {
                const palletId = await generateId('PA');
                palletsToCreate.push({
                    palletId,
                    factory: po.factory,
                    tile: item.tile,
                    type: 'Pallet',
                    boxCount: po.packingRules.boxesPerPallet,
                    sourcePurchaseOrder: po._id,
                    status: 'InFactoryStock', // Explicitly set status
                });
            }

            // Create khatlis
            for (let i = 0; i < item.khatlisOrdered; i++) {
                const palletId = await generateId('PA');
                palletsToCreate.push({
                    palletId,
                    factory: po.factory,
                    tile: item.tile,
                    type: 'Khatli',
                    boxCount: po.packingRules.boxesPerKhatli,
                    sourcePurchaseOrder: po._id,
                    status: 'InFactoryStock', // Explicitly set status
                });
            }
        }

        // Insert all pallets/khatlis
        if (palletsToCreate.length > 0) {
            const createdPallets = await Pallet.insertMany(palletsToCreate, { session });
            const palletIds = createdPallets.map(p => p._id);
            po.generatedPallets.push(...palletIds);
        }

        // *** NEW: Update Tile stock ***
        for (const [tileId, boxCount] of tileStockUpdates.entries()) {
            await Tile.findByIdAndUpdate(
                tileId,
                {
                    $inc: {
                        'stockDetails.inFactoryStock': boxCount,
                        'stockDetails.restockingStock': -boxCount
                    }
                },
                { session }
            );
        }

        // Update PO status
        po.status = 'Completed';
        await po.save({ session });

        await session.commitTransaction();

        const finalPO = await PurchaseOrder.findById(id)
            .populate('factory', 'name')
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


// ===== DELETE PURCHASE ORDER =====
export const deletePurchaseOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const po = await PurchaseOrder.findById(id).session(session);

        if (!po) {
            throw new Error('Purchase Order not found');
        }

        const deletableStatuses = ['Draft', 'SentToFactory', 'Manufacturing', 'QC_InProgress'];
        if (!deletableStatuses.includes(po.status)) {
            throw new Error(
                `Cannot delete PO with status '${po.status}'. ` +
                `Only POs with status: ${deletableStatuses.join(', ')} can be deleted.`
            );
        }

        if (po.generatedPallets && po.generatedPallets.length > 0) {
            const allocatedPallets = await Pallet.countDocuments({
                _id: { $in: po.generatedPallets },
                status: { $ne: 'InFactoryStock' }
            }).session(session);

            if (allocatedPallets > 0) {
                throw new Error(
                    `Cannot delete PO. ${allocatedPallets} pallets have already been ` +
                    `loaded into containers or dispatched.`
                );
            }
        }

        // 1. REVERT TILE RESTOCKING STOCK
        for (const item of po.items) {
            const boxesFromPallets = (item.palletsOrdered || 0) * (po.packingRules?.boxesPerPallet || 0);
            const boxesFromKhatlis = (item.khatlisOrdered || 0) * (po.packingRules?.boxesPerKhatli || 0);
            const totalBoxesToRevert = boxesFromPallets + boxesFromKhatlis;

            if (totalBoxesToRevert > 0) {
                await Tile.findByIdAndUpdate(
                    item.tile,
                    { $inc: { 'stockDetails.restockingStock': -totalBoxesToRevert } },
                    { session }
                );
            }
        }

        // 2. UPDATE LINKED RESTOCK REQUEST
        if (po.sourceRestockRequest) {
            const restockRequest = await RestockRequest.findById(po.sourceRestockRequest).session(session);
            
            if (restockRequest) {
                for (const poItem of po.items) {
                    const restockItemIndex = restockRequest.requestedItems.findIndex(
                        item => String(item.tile) === String(poItem.tile)
                    );

                    if (restockItemIndex > -1) {
                        const boxesFromPallets = (poItem.palletsOrdered || 0) * (po.packingRules?.boxesPerPallet || 0);
                        const boxesFromKhatlis = (poItem.khatlisOrdered || 0) * (po.packingRules?.boxesPerKhatli || 0);
                        const totalBoxesInThisPO = boxesFromPallets + boxesFromKhatlis;

                        restockRequest.requestedItems[restockItemIndex].quantityInPO = Math.max(
                            0,
                            (restockRequest.requestedItems[restockItemIndex].quantityInPO || 0) - totalBoxesInThisPO
                        );

                        if (String(restockRequest.requestedItems[restockItemIndex].purchaseOrder) === String(po._id)) {
                            restockRequest.requestedItems[restockItemIndex].purchaseOrder = null;
                        }
                    }
                }

                const anyItemHasPO = restockRequest.requestedItems.some(item => item.quantityInPO > 0);
                if (!anyItemHasPO && restockRequest.status === 'Processing') {
                    restockRequest.status = 'Pending';
                }

                restockRequest.markModified('requestedItems');
                await restockRequest.save({ session });
            }
        }

        // 3. DELETE GENERATED PALLETS
        if (po.generatedPallets && po.generatedPallets.length > 0) {
            await Pallet.deleteMany({
                _id: { $in: po.generatedPallets },
                status: 'InFactoryStock'
            }, { session });
        }

        // 4. SOFT DELETE THE PO
        po.status = 'Cancelled';
        po.deleted = true;
        po.deletedAt = new Date();
        po.deletedBy = req.user._id;
        po.deletionReason = reason || 'Deleted by admin';
        await po.save({ session });

        await session.commitTransaction();

        res.status(200).json({
            message: 'Purchase Order deleted successfully',
            poId: po.poId,
            itemsReverted: po.items.length,
            palletsDeleted: po.generatedPallets?.length || 0
        });

    } catch (error) {
        await session.abortTransaction();
        res.status(400);
        throw new Error(error.message || 'Failed to delete Purchase Order');
    } finally {
        session.endSession();
    }
});

// ===== CANCEL PURCHASE ORDER =====
export const cancelPurchaseOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const po = await PurchaseOrder.findById(id).session(session);

        if (!po) {
            throw new Error('Purchase Order not found');
        }

        if (po.status === 'Cancelled') {
            throw new Error('Purchase Order is already cancelled');
        }

        if (po.status !== 'Completed') {
            for (const item of po.items) {
                const boxesFromPallets = (item.palletsOrdered || 0) * (po.packingRules?.boxesPerPallet || 0);
                const boxesFromKhatlis = (item.khatlisOrdered || 0) * (po.packingRules?.boxesPerKhatli || 0);
                const totalBoxesToRevert = boxesFromPallets + boxesFromKhatlis;

                if (totalBoxesToRevert > 0) {
                    await Tile.findByIdAndUpdate(
                        item.tile,
                        { $inc: { 'stockDetails.restockingStock': -totalBoxesToRevert } },
                        { session }
                    );
                }
            }
        }

        if (po.sourceRestockRequest) {
            const restockRequest = await RestockRequest.findById(po.sourceRestockRequest).session(session);
            
            if (restockRequest) {
                for (const poItem of po.items) {
                    const restockItemIndex = restockRequest.requestedItems.findIndex(
                        item => String(item.tile) === String(poItem.tile)
                    );

                    if (restockItemIndex > -1) {
                        const boxesFromPallets = (poItem.palletsOrdered || 0) * (po.packingRules?.boxesPerPallet || 0);
                        const boxesFromKhatlis = (poItem.khatlisOrdered || 0) * (po.packingRules?.boxesPerKhatli || 0);
                        const totalBoxesInThisPO = boxesFromPallets + boxesFromKhatlis;

                        restockRequest.requestedItems[restockItemIndex].quantityInPO = Math.max(
                            0,
                            (restockRequest.requestedItems[restockItemIndex].quantityInPO || 0) - totalBoxesInThisPO
                        );

                        if (String(restockRequest.requestedItems[restockItemIndex].purchaseOrder) === String(po._id)) {
                            restockRequest.requestedItems[restockItemIndex].purchaseOrder = null;
                        }
                    }
                }

                restockRequest.markModified('requestedItems');
                await restockRequest.save({ session });
            }
        }

        po.status = 'Cancelled';
        po.cancelledAt = new Date();
        po.cancelledBy = req.user._id;
        po.cancellationReason = reason || 'Cancelled by admin';
        await po.save({ session });

        await session.commitTransaction();

        const populatedPO = await PurchaseOrder.findById(id)
            .populate('factory', 'name')
            .populate('items.tile', 'name tileNumber size');

        res.status(200).json(populatedPO);

    } catch (error) {
        await session.abortTransaction();
        res.status(400);
        throw new Error(error.message || 'Failed to cancel Purchase Order');
    } finally {
        session.endSession();
    }
});