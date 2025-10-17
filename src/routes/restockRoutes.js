const express = require('express');
const router = express.Router();
const { createRestockRequest, recordContainerArrival, getAllRestockRequests } = require('../controllers/restockController');
const { protect } = require('../middlewares/authMiddleware');
const { role, location } = require('../middlewares/roleMiddleware');

router.route('/')
  .post(protect, role('admin', 'dubai-staff'), location('Dubai'), createRestockRequest)
  .get(protect, getAllRestockRequests);

router.put('/:id/arrival', protect, role('admin', 'dubai-staff'), location('Dubai'), recordContainerArrival);

module.exports = router;
