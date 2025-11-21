// backend/src/routes/purchaseOrderRoutes.js

import express from 'express';
import { 
    createPurchaseOrder, 
    getAllPurchaseOrders,
    getPurchaseOrderById,
    updatePurchaseOrderStatus,
    // --- 1. IMPORT THE NEW CONTROLLER ---
    recordQC
} from '../controllers/purchaseOrderController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect, authorize('admin', 'india-staff'));

router.route('/')
    .post(createPurchaseOrder)
    .get(getAllPurchaseOrders);

// --- 2. ADD THE NEW QC ROUTE ---
// This is a nested route for a specific item within a specific PO
router.route('/:poId/items/:itemId/qc')
    .post(recordQC);

router.route('/:id/status')
    .patch(updatePurchaseOrderStatus);

router.route('/:id')
    .get(getPurchaseOrderById);

export default router;
