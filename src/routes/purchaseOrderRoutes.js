// backend/src/routes/purchaseOrderRoutes.js

import express from 'express';
import { 
    createPurchaseOrder, 
    getAllPurchaseOrders,
    getPurchaseOrderById,
    // --- 1. IMPORT THE NEW CONTROLLER ---
    updatePurchaseOrderStatus
} from '../controllers/purchaseOrderController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect, authorize('admin', 'india-staff'));

router.route('/')
    .post(createPurchaseOrder)
    .get(getAllPurchaseOrders);

// --- 2. ADD THE NEW STATUS ROUTE ---
// It's a PATCH request because we are partially updating the document.
router.route('/:id/status')
    .patch(updatePurchaseOrderStatus);

router.route('/:id')
    .get(getPurchaseOrderById);

export default router;
