import express from 'express';
import {
  createRestockRequest,
  getAllRestockRequests,
  getRestockRequestById,
  updateRestockRequestStatus,
  recordArrival,
  updateShippedQuantity,
  forceCompleteRequest,
  editRestockRequest,
  editArrivalHistory,
} from '../controllers/restockController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes are protected and require a user to be logged in.
router.use(protect);

// Dubai staff can create new requests. Admins can too.
router.route('/')
  .post(authorize('admin', 'dubai-staff'), createRestockRequest)
  .get(authorize('admin', 'dubai-staff', 'india-staff'), getAllRestockRequests);

// All authorized staff can view a specific request.
router.route('/:id')
  .get(getRestockRequestById)
  .put(authorize('admin', 'dubai-staff'), editRestockRequest); // <-- ADD .put()

// India staff can update the status to 'Processing' or 'Cancelled'. Admins can too.
router.patch('/:id/status', authorize('admin', 'india-staff'), updateRestockRequestStatus);

// Dubai staff can record physical arrivals of stock. Admins can too.
router.post('/:id/record-arrival', authorize('admin', 'dubai-staff'), recordArrival);

router.patch('/:id/update-shipped', authorize('admin', 'india-staff'), updateShippedQuantity);

router.patch('/:id/force-complete', authorize('admin'), forceCompleteRequest);

router.patch('/:id/edit-arrival', authorize('admin'), editArrivalHistory);




export default router;
