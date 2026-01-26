import express from 'express';
import {
    createPurchaseOrder,
    getAllPurchaseOrders,
    getPurchaseOrderById,
    updatePurchaseOrderStatus,
    recordQC,
    generatePalletsFromPO,
    deletePurchaseOrder,
    cancelPurchaseOrder
} from '../controllers/purchaseOrderController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Main routes
router.route('/')
    .get(protect, getAllPurchaseOrders)
    .post(protect, authorize('admin', 'india-staff'), createPurchaseOrder);

router.route('/:id')
    .get(protect, getPurchaseOrderById)
    .delete(protect, authorize('admin'), deletePurchaseOrder);

// Status update
router.route('/:id/status')
    .put(protect, authorize('admin', 'india-staff'), updatePurchaseOrderStatus);

// Cancel PO (alternative to delete for completed POs)
router.route('/:id/cancel')
    .put(protect, authorize('admin'), cancelPurchaseOrder);

// QC Recording
router.route('/:poId/items/:itemId/qc')
    .post(protect, authorize('admin', 'india-staff'), recordQC);

// Generate Pallets
router.route('/:id/generate-pallets')
    .post(protect, authorize('admin', 'india-staff'), generatePalletsFromPO);

export default router;