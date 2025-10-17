const express = require('express');
const router = express.Router();
const { createBooking, fulfillBooking, cancelBooking, getAllBookings } = require('../controllers/bookingController');
const { protect } = require('../middlewares/authMiddleware');
const { role, location } = require('../middlewares/roleMiddleware');

router.route('/')
  .post(protect, role('admin', 'dubai-staff'), location('Dubai'), createBooking)
  .get(protect, getAllBookings);

router.put('/:id/fulfill', protect, role('admin', 'dubai-staff'), location('Dubai'), fulfillBooking);
router.put('/:id/cancel', protect, role('admin', 'dubai-staff'), cancelBooking);

module.exports = router;
