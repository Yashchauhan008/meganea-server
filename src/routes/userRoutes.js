// import express from 'express';
// import {
//   // General user routes
//   createUser,
//   getUsers,
//   getUserById,
//   updateUser,
//   deleteUser,
//   // Salesman-specific routes
//   createSalesman,
//   getAllSalesmen,
//   updateSalesman,
//   deleteSalesman,
// } from '../controllers/userController.js';
// import { protect, authorize } from '../middleware/authMiddleware.js';

// const router = express.Router();

// // --- Salesman-specific CRUD routes (for admins) ---
// router.route('/salesmen')
//     .get(protect, authorize('admin', 'dubai-staff'), getAllSalesmen)
//     .post(protect, authorize('admin'), createSalesman);

// router.route('/salesmen/:id')
//     .put(protect, authorize('admin'), updateSalesman)
//     .delete(protect, authorize('admin'), deleteSalesman);


// // --- General Admin-only User Management ---
// router.use(protect, authorize('admin'));

// router.route('/').post(createUser).get(getUsers);
// router.route('/:id').get(getUserById).put(updateUser).delete(deleteUser);

// export default router;

import express from 'express';
import {
  createSalesman,
  getAllSalesmen,
  getUserById,
  updateSalesman,
  deleteSalesman,
  getSalesmanParties,
} from '../controllers/userController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// --- PUBLIC/SHARED ROUTES (if any) ---
// (None for now)

// --- ADMIN & STAFF ONLY ROUTES ---
router.use(protect, authorize('admin', 'dubai-staff'));

// General Salesman routes
router.route('/salesman').post(createSalesman);
router.route('/salesmen').get(getAllSalesmen);

// --- THIS IS THE CRITICAL FIX ---
// Define more specific routes BEFORE generic ones.
router.route('/salesman/:id/parties').get(getSalesmanParties);
router.route('/salesman/:id').put(updateSalesman).delete(deleteSalesman);
// ---------------------------------

// Generic '/:id' route is last, acting as a fallback.
router.route('/:id').get(getUserById);

export default router;
