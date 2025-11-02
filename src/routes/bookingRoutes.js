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
  updateBooking,
  deleteBooking,
  cancelBooking,
  addUnprocessedImages,
  deleteUnprocessedImage, // The renamed controller for uploads
} from '../controllers/bookingController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import upload from '../config/cloudinary.js'; // <-- THIS IS THE FIX: Import the upload config

const router = express.Router();
router.use(protect, authorize('admin', 'dubai-staff', 'salesman','labor'));

router.route('/')
  .get(getAllBookings)
  .post(createBooking);

router.route('/:id')
  .get(getBookingById)
  .put(authorize('admin', 'dubai-staff','labor'), updateBooking)
  .delete(authorize('admin'), deleteBooking);

router.route('/:id/cancel')
  .patch(authorize('admin', 'dubai-staff'), cancelBooking);

// --- MULTIPLE IMAGE UPLOAD ROUTE ---
// This route will now work because 'upload' is defined.
router.post(
  '/:id/upload-images',
  protect,
  authorize('admin', 'dubai-staff', 'labor'),
  upload.array('images', 5), // 'images' is the field name, 5 is the max file count
  addUnprocessedImages
);

router.delete(
  '/:bookingId/unprocessed-images/:imageId',
  deleteUnprocessedImage
);

export default router;
