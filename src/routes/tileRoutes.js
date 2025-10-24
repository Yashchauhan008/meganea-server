import express from 'express';
import {
  createTile,
  getAllTiles,
  getTileById,
  updateTile,
  deleteTile // This is the soft delete
} from '../controllers/tileController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// The GET route is public to see active tiles
router.route('/')
  .get(getAllTiles)
  .post(protect, authorize('admin', 'dubai-staff', 'india-staff'), createTile);

// All actions on a specific tile ID
router.route('/:id')
  .get(getTileById) // Public
  .put(protect, authorize('admin', 'dubai-staff', 'india-staff'), updateTile)
  .delete(protect, authorize('admin', 'dubai-staff'), deleteTile); // This performs the soft delete

export default router;
