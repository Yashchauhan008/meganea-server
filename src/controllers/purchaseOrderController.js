import asyncHandler from '../utils/asyncHandler.js';
import PurchaseOrder from '../models/purchaseOrderModel.js';
import RestockRequest from '../models/restockRequestModel.js';

// @desc    Create a new Purchase Order
// @route   POST /api/purchase-orders
// @access  Private/India-Staff
export const createPurchaseOrder = asyncHandler(async (req, res) => {
    const { sourceRestockRequest, factory, packingRules, items, notes } = req.body;

    // Basic validation
    if (!items || items.length === 0) {
        res.status(400);
        throw new Error('Purchase order must contain at least one item.');
    }

    const restockRequest = await RestockRequest.findById(sourceRestockRequest);
    if (!restockRequest) {
        res.status(404);
        throw new Error('Source Restock Request not found.');
    }

    const purchaseOrder = new PurchaseOrder({
        sourceRestockRequest,
        factory,
        packingRules,
        items,
        notes,
        createdBy: req.user._id,
    });

    const createdPurchaseOrder = await purchaseOrder.save();
    res.status(201).json(createdPurchaseOrder);
});

// @desc    Get all Purchase Orders
// @route   GET /api/purchase-orders
// @access  Private/India-Staff
export const getAllPurchaseOrders = asyncHandler(async (req, res) => {
    const purchaseOrders = await PurchaseOrder.find({})
        .populate('factory', 'name')
        .populate('sourceRestockRequest', 'requestId')
        .populate('items.tile', 'name size')
        .sort({ createdAt: -1 });
    res.status(200).json(purchaseOrders);
});
