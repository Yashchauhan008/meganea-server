import express from 'express';
import { createPurchaseOrder } from '../controllers/purchaseOrderController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect, authorize('admin', 'india-staff'));

router.route('/').post(createPurchaseOrder);
// We will add .get(getAllPurchaseOrders) here later

export default router;
