import express from 'express';
import {
  createDispatchOrder,
  getAllDispatchOrders,
  getDispatchOrderById,
} from '../controllers/dispatchController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect, authorize('admin', 'dubai-staff'));

router.route('/').post(createDispatchOrder).get(getAllDispatchOrders);
router.route('/:id').get(getDispatchOrderById);

export default router;
