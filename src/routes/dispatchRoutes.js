// import express from 'express';
// import {
//   createDispatchOrder,
//   getAllDispatchOrders,
//   getDispatchOrderById,
// } from '../controllers/dispatchController.js';
// import { protect, authorize } from '../middleware/authMiddleware.js';

// const router = express.Router();

// // Protect all routes and authorize only admin and relevant staff
// router.use(protect, authorize('admin', 'dubai-staff'));

// router.route('/')
//   .post(createDispatchOrder)
//   .get(getAllDispatchOrders);

// router.route('/:id')
//   .get(getDispatchOrderById);

// export default router;


import express from 'express';
import {
  createDispatchOrder,
  getAllDispatchOrders,
  getDispatchOrderById,
  updateDispatchOrder, // Import new
  deleteDispatchOrder, // Import new
} from '../controllers/dispatchController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect, authorize('admin', 'dubai-staff'));

router.route('/')
  .post(createDispatchOrder)
  .get(getAllDispatchOrders);

// --- UPDATED ROUTE FOR A SPECIFIC DISPATCH ---
router.route('/:id')
  .get(getDispatchOrderById)
  .put(updateDispatchOrder) // Add PUT for editing
  .delete(authorize('admin'), deleteDispatchOrder); // Add DELETE, restricted to admin

export default router;
