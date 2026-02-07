// backend/routes/dubaiDispatchRoutes.js

import express from 'express';
import {
  createDubaiDispatchOrder,
  getAllDubaiDispatchOrders,
  getDubaiDispatchOrderById,
  updateDubaiDispatchOrder,
  deleteDubaiDispatchOrder,
} from '../controllers/dubaiDispatchController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect, authorize('admin', 'dubai-staff'));

router.route('/')
  .post(createDubaiDispatchOrder)
  .get(getAllDubaiDispatchOrders);

router.route('/:id')
  .get(getDubaiDispatchOrderById)
  .put(authorize('admin', 'dubai-staff'), updateDubaiDispatchOrder)
  .delete(authorize('admin'), deleteDubaiDispatchOrder);

export default router;