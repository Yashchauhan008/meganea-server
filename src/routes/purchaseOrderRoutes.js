// backend/src/routes/purchaseOrderRoutes.js

import express from 'express';
import {
    createPurchaseOrder,
    getAllPurchaseOrders,
    getPurchaseOrderById,
    updatePurchaseOrderStatus,
    recordQC,
    generatePalletsFromPO, // <-- IMPORT THE NEW CONTROLLER
} from '../controllers/purchaseOrderController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect, authorize('admin', 'india-staff'));

router.route('/')
    .get(getAllPurchaseOrders)
    .post(createPurchaseOrder);

// --- ADD THIS NEW ROUTE ---
// This must be defined before the generic '/:id' route
router.route('/:id/generate-pallets')
    .post(generatePalletsFromPO);
// -------------------------

router.route('/:poId/items/:itemId/qc')
    .post(recordQC);

router.route('/:id/status')
    .patch(updatePurchaseOrderStatus);

router.route('/:id')
    .get(getPurchaseOrderById);

export default router;
