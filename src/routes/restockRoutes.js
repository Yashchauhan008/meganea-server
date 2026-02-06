import express from 'express';
import {
    createRestockRequest,
    getAllRestockRequests,
    getRestockRequestById,
    getRestockRequestForWorkbench,
    updateRestockRequestStatus,
    recordArrival,
    updateShippedQuantity,
    updateQuantityInPO,
    editRestockRequest,
    forceCompleteRequest,
    editArrivalHistory,
    getRequestStatistics
} from '../controllers/restockController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Statistics (admin only)
router.get('/statistics', protect, authorize('admin'), getRequestStatistics);

// Workbench route (for PO creation)
router.get('/:id/workbench', protect, getRestockRequestForWorkbench);

// Main routes
router.route('/')
    .get(protect, getAllRestockRequests)
    .post(protect, authorize('admin', 'india-staff', 'dubai-staff'), createRestockRequest);

// Single request routes
router.route('/:id')
    .get(protect, getRestockRequestById)
    .put(protect, authorize('admin', 'india-staff'), editRestockRequest);

// Status management
router.patch('/:id/status', protect, authorize('admin', 'india-staff'), updateRestockRequestStatus);

// Arrival tracking
router.post('/:id/record-arrival', protect, authorize('admin', 'india-staff'), recordArrival);
router.patch('/:id/edit-arrival', protect, authorize('admin', 'india-staff'), editArrivalHistory);

// Quantity updates
router.patch('/:id/update-shipped', protect, authorize('admin', 'india-staff'), updateShippedQuantity);
router.patch('/:id/update-quantity-in-po', protect, authorize('admin', 'india-staff'), updateQuantityInPO);

// Force complete
router.patch('/:id/force-complete', protect, authorize('admin'), forceCompleteRequest);

export default router;