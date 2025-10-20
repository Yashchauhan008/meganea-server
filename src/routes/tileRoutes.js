import express from 'express';
import {
  createTile,
  getAllTiles,
  getTileById,
  updateTile,
  deleteTile,
} from '../controllers/tileController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Publicly viewable tiles
router.route('/').get(getAllTiles);
router.route('/:id').get(getTileById);

// Protected routes for staff and admin
router.use(protect, authorize('admin', 'dubai-staff', 'india-staff'));

router.route('/').post(createTile);
router.route('/:id').put(updateTile).delete(authorize('admin'), deleteTile); // Only admin can delete

export default router;
