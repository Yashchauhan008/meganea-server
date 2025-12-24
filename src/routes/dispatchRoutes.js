

// import express from 'express';
// import {
//   createDispatchOrder,
//   getAllDispatchOrders,
//   getDispatchOrderById,
//   updateDispatchOrder, // Import new
//   deleteDispatchOrder, // Import new
// } from '../controllers/dispatchController.js';
// import { protect, authorize } from '../middleware/authMiddleware.js';

// const router = express.Router();
// router.use(protect, authorize('admin', 'dubai-staff'));

// router.route('/')
//   .post(createDispatchOrder)
//   .get(getAllDispatchOrders);

// // --- UPDATED ROUTE FOR A SPECIFIC DISPATCH ---
// // router.route('/:id')
// //   .get(getDispatchOrderById)
// //   .put(updateDispatchOrder) // Add PUT for editing
// //   .delete(authorize('admin'), deleteDispatchOrder); // Add DELETE, restricted to admin

//   router.route('/:id')
//   .get(getDispatchOrderById)
//   .put(authorize('admin', 'dubai-staff'), updateDispatchOrder) // Ensure this line exists
//   .delete(authorize('admin'), deleteDispatchOrder);

// export default router;


import express from 'express';
import {
  getAvailableContainers,
  createDispatchOrder,
  getAllDispatchOrders,
  getDispatchOrderById,
  updateDispatchOrder,
  updateDispatchStatus,
  deleteDispatchOrder,
} from '../controllers/dispatchController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Middleware to protect all routes
router.use(protect);

/**
 * @route   GET /api/dispatches/containers/available
 * @desc    Get all containers available for dispatch
 * @access  Private (Admin, India Staff)
 */
router.get('/containers/available', authorize('Admin', 'India Staff'), getAvailableContainers);

/**
 * @route   POST /api/dispatches
 * @desc    Create a new dispatch order
 * @access  Private (Admin, India Staff)
 */
router.post('/', authorize('Admin', 'India Staff'), createDispatchOrder);

/**
 * @route   GET /api/dispatches
 * @desc    Get all dispatch orders
 * @access  Private (Admin, India Staff)
 */
router.get('/', authorize('Admin', 'India Staff'), getAllDispatchOrders);

/**
 * @route   GET /api/dispatches/:id
 * @desc    Get single dispatch order
 * @access  Private (Admin, India Staff)
 */
router.get('/:id', authorize('Admin', 'India Staff'), getDispatchOrderById);

/**
 * @route   PUT /api/dispatches/:id
 * @desc    Update dispatch order (add/remove containers)
 * @access  Private (Admin, India Staff)
 */
router.put('/:id', authorize('Admin', 'India Staff'), updateDispatchOrder);

/**
 * @route   PATCH /api/dispatches/:id/status
 * @desc    Update dispatch status
 * @access  Private (Admin, India Staff)
 */
router.patch('/:id/status', authorize('Admin', 'India Staff'), updateDispatchStatus);

/**
 * @route   DELETE /api/dispatches/:id
 * @desc    Delete dispatch order (soft delete)
 * @access  Private (Admin)
 */
router.delete('/:id', authorize('Admin'), deleteDispatchOrder);

export default router;
