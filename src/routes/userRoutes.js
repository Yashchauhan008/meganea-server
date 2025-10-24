import express from 'express';
import {
  // General user routes
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  // Salesman-specific routes
  createSalesman,
  getAllSalesmen,
  updateSalesman,
  deleteSalesman,
} from '../controllers/userController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// --- Salesman-specific CRUD routes (for admins) ---
router.route('/salesmen')
    .get(protect, authorize('admin', 'dubai-staff'), getAllSalesmen)
    .post(protect, authorize('admin'), createSalesman);

router.route('/salesmen/:id')
    .put(protect, authorize('admin'), updateSalesman)
    .delete(protect, authorize('admin'), deleteSalesman);


// --- General Admin-only User Management ---
router.use(protect, authorize('admin'));

router.route('/').post(createUser).get(getUsers);
router.route('/:id').get(getUserById).put(updateUser).delete(deleteUser);

export default router;
