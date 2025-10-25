// import express from 'express';
// import {
//   createBooking,
//   getAllBookings,
//   getBookingById,
//   updateBookingStatus,
//   addUnprocessedImage,
//   cancelBooking,
// } from '../controllers/bookingController.js';
// import { protect, authorize } from '../middleware/authMiddleware.js';
// import upload from '../config/cloudinary.js';

// const router = express.Router();

// router.use(protect, authorize('admin', 'dubai-staff', 'salesman'));

// router.route('/').post(createBooking).get(getAllBookings);
// router.route('/:id').get(getBookingById);
// router.route('/:id/cancel').patch(cancelBooking);
// router.route('/:id/status').patch(updateBookingStatus); // Admin/staff can manually override status

// // Route for laborers to upload delivery note images
// router.post(
//   '/:id/upload-image',
//   authorize('admin', 'dubai-staff', 'labor'),
//   upload.single('image'),
//   addUnprocessedImage
// );

// export default router;

import express from 'express';
import {
  createBooking,
  getAllBookings,
  getBookingById,
  updateBooking, // Import new
  deleteBooking, // Import new
  cancelBooking,
} from '../controllers/bookingController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(protect, authorize('admin', 'dubai-staff', 'salesman'));

router.route('/')
  .get(getAllBookings)
  .post(createBooking);

// --- UPDATED ROUTE FOR A SPECIFIC BOOKING ---
router.route('/:id')
  .get(getBookingById)
  .put(authorize('admin', 'dubai-staff'), updateBooking) // Add PUT for editing
  .delete(authorize('admin'), deleteBooking); // Add DELETE for archiving

router.route('/:id/cancel')
  .patch(authorize('admin', 'dubai-staff'), cancelBooking);

export default router;
