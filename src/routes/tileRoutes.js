import express from 'express';
import {
  createTile,
  getAllTiles,
  getTileById,
  updateTile,
  deleteTile,
  getTilesForBooking,
  getUniqueTileSizes
} from '../controllers/tileController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// --- THIS IS THE FIX ---
// Define the most specific routes FIRST.
router.route('/for-booking').get(getTilesForBooking);
// ---------------------
router.route('/sizes').get(protect, getUniqueTileSizes);

// Now define the general routes.
router.route('/')
  .get(getAllTiles)
  .post(protect, authorize('admin', 'dubai-staff', 'india-staff'), createTile);

// Finally, define the "greedy" dynamic route LAST.
router.route('/:id')
  .get(getTileById)
  .put(protect, authorize('admin', 'dubai-staff', 'india-staff'), updateTile)
  .delete(protect, authorize('admin', 'dubai-staff'), deleteTile);

export default router;
