// FILE: backend/src/routes/reportRoutes.js
//
// Report API Routes for India Module
//
// Add to server.js:
// import reportRoutes from './routes/reportRoutes.js';
// app.use('/api/reports', reportRoutes);

import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
    getTilesReportData,
    getFactoriesReportData,
    getFactoryStockReportData,
    getContainersReportData,
    getPurchaseOrdersReportData,
    getPurchaseOrderDetailReportData,
    getRestockRequestsReportData,
    getLoadingPlansReportData,
    getDispatchesReportData,
    getDispatchDetailReportData,
    getInventoryReportData,
} from '../controllers/reportController.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// Report endpoints
router.get('/tiles', getTilesReportData);
router.get('/factories', getFactoriesReportData);
router.get('/factory-stock', getFactoryStockReportData);
router.get('/containers', getContainersReportData);
router.get('/purchase-orders', getPurchaseOrdersReportData);
router.get('/purchase-orders/:id', getPurchaseOrderDetailReportData);
router.get('/restock-requests', getRestockRequestsReportData);
router.get('/loading-plans', getLoadingPlansReportData);
router.get('/dispatches', getDispatchesReportData);
router.get('/dispatches/:id', getDispatchDetailReportData);
router.get('/inventory', getInventoryReportData);

export default router;