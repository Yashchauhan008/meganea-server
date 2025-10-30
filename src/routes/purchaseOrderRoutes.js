import express from 'express';
import { createPurchaseOrder, getAllPurchaseOrders } from '../controllers/purchaseOrderController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect, authorize('admin', 'india-staff'));

router.route('/')
    .post(createPurchaseOrder)
    .get(getAllPurchaseOrders);

// We will add more routes here for QC, status updates, etc.

export default router;
