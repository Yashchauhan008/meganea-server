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

router.get('/', getAllTiles);
router.get('/:id', getTileById);

router.use(protect);

router.post('/', authorize('admin', 'dubai-staff', 'india-staff'), createTile);
router.put('/:id', authorize('admin', 'dubai-staff', 'india-staff'), updateTile);
router.delete('/:id', authorize('admin'), deleteTile);

export default router;
