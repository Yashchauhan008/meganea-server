import express from 'express';
import {
  createRestockRequest,
  getAllRestockRequests,
  getRestockRequestById,
  updateRestockRequestStatus,
  recordArrival,
} from '../controllers/restockController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Dubai staff can create and view requests
router.use(protect, authorize('admin', 'dubai-staff', 'india-staff'));

router.route('/')
  .post(authorize('admin', 'dubai-staff'), createRestockRequest)
  .get(getAllRestockRequests);

router.route('/:id').get(getRestockRequestById);

// India staff can process requests
router.patch('/:id/status', authorize('admin', 'india-staff'), updateRestockRequestStatus);

// Dubai staff can record arrivals
router.post('/:id/record-arrival', authorize('admin', 'dubai-staff'), recordArrival);

export default router;
