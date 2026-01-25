import express from 'express';
import {
  createDubaiDispatch,
  getAllDubaiDispatches,
  getDubaiDispatchById,
  updateDubaiDispatch,
  deleteDubaiDispatch,
  verifyDubaiDispatch,
  updateDubaiDispatchStatus,
  getDubaiDispatchStats,
} from '../controllers/dubaiDispatchController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * Dubai Dispatch Routes
 * 
 * All routes for managing Dubai's booking-based dispatch system.
 * Completely independent from India's container-based dispatch routes.
 */

// Apply authentication to all routes
router.use(protect);

/**
 * @route   GET /api/dubai-dispatches/stats
 * @desc    Get Dubai dispatch statistics for dashboard
 * @access  Private (Admin, Dubai-Staff)
 */
router.get(
  '/stats',
  authorize('admin', 'dubai-staff'),
  getDubaiDispatchStats
);

/**
 * @route   GET /api/dubai-dispatches
 * @desc    Get all Dubai dispatch orders (with filters and pagination)
 * @access  Private (Admin, Dubai-Staff, Salesman)
 * @query   status, companyName, invoiceNumber, dateFrom, dateTo, page, limit
 */
router.get(
  '/',
  authorize('admin', 'dubai-staff', 'salesman'),
  getAllDubaiDispatches
);

/**
 * @route   POST /api/dubai-dispatches
 * @desc    Create a new Dubai dispatch order from processing delivery note
 * @access  Private (Admin, Dubai-Staff)
 * @body    bookingId, unprocessedImageId, dispatchedItems, invoiceNumber, etc.
 */
router.post(
  '/',
  authorize('admin', 'dubai-staff'),
  createDubaiDispatch
);

/**
 * @route   GET /api/dubai-dispatches/:id
 * @desc    Get a single Dubai dispatch order by ID
 * @access  Private (Admin, Dubai-Staff, Salesman)
 */
router.get(
  '/:id',
  authorize('admin', 'dubai-staff', 'salesman'),
  getDubaiDispatchById
);

/**
 * @route   PUT /api/dubai-dispatches/:id
 * @desc    Update a Dubai dispatch order
 * @access  Private (Admin, Dubai-Staff)
 * @body    dispatchedItems, invoiceNumber, deliveryDate, etc.
 */
router.put(
  '/:id',
  authorize('admin', 'dubai-staff'),
  updateDubaiDispatch
);

/**
 * @route   DELETE /api/dubai-dispatches/:id
 * @desc    Delete a Dubai dispatch order (soft delete with stock reversion)
 * @access  Private (Admin only)
 */
router.delete(
  '/:id',
  authorize('admin'),
  deleteDubaiDispatch
);

/**
 * @route   PATCH /api/dubai-dispatches/:id/verify
 * @desc    Verify a Dubai dispatch order
 * @access  Private (Admin, Dubai-Staff)
 * @body    remarks (optional)
 */
router.patch(
  '/:id/verify',
  authorize('admin', 'dubai-staff'),
  verifyDubaiDispatch
);

/**
 * @route   PATCH /api/dubai-dispatches/:id/status
 * @desc    Update Dubai dispatch status
 * @access  Private (Admin, Dubai-Staff)
 * @body    status, remarks
 */
router.patch(
  '/:id/status',
  authorize('admin', 'dubai-staff'),
  updateDubaiDispatchStatus
);

export default router;