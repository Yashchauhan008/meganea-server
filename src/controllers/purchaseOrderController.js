import asyncHandler from '../utils/asyncHandler.js';
import PurchaseOrder from '../models/purchaseOrderModel.js';
import RestockRequest from '../models/restockRequestModel.js';
import { generateId } from '../services/idGenerator.js'; // Assuming you have this service

// @desc    Create a new Purchase Order
// @route   POST /api/purchase-orders
// @access  Private/Admin/India-Staff
export const createPurchaseOrder = asyncHandler(async (req, res) => {
    const {
        sourceRestockRequestId,
        factoryId,
        items, // Array of { tileId, palletsOrdered, khatlisOrdered }
        packingRules,
        notes
    } = req.body;

    if (!sourceRestockRequestId || !factoryId || !items || items.length === 0 || !packingRules) {
        res.status(400).throw(new Error('Missing required fields.'));
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const poId = await generateId('PO');
        const newPO = new PurchaseOrder({
            poId, sourceRestockRequest: sourceRestockRequestId, factory: factoryId,
            items: items.map(item => ({
                tile: item.tileId,
                palletsOrdered: item.palletsOrdered,
                khatlisOrdered: item.khatlisOrdered,
            })),
            packingRules, notes, createdBy: req.user._id,
        });

        const savedPO = await newPO.save({ session });

        // --- UPDATE THE INDIVIDUAL RESTOCK ITEMS ---
        const restockRequest = await RestockRequest.findById(sourceRestockRequestId).session(session);
        if (!restockRequest) throw new Error('Source Restock Request not found.');

        // For each tile in the newly created PO, find the matching line item in the restock request and assign the PO's ID.
        for (const poItem of savedPO.items) {
            const restockItem = restockRequest.requestedItems.find(
                item => item.tile.toString() === poItem.tile.toString()
            );
            if (restockItem) {
                restockItem.purchaseOrder = savedPO._id;
            }
        }
        
        // Mark the restock request as 'Processing' since work has started on it.
        if (restockRequest.status === 'Pending') {
            restockRequest.status = 'Processing';
        }
        
        await restockRequest.save({ session });
        // --- END OF CORRECTION ---

        await session.commitTransaction();
        
        const populatedPO = await PurchaseOrder.findById(savedPO._id).populate('factory', 'name').populate('items.tile', 'name');
        res.status(201).json(populatedPO);

    } catch (error) {
        await session.abortTransaction();
        res.status(400).throw(new Error(error.message || 'Failed to create Purchase Order.'));
    } finally {
        session.endSession();
    }
});

// We will add other functions like get, update, etc., later
