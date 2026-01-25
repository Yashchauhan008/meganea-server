// backend/src/routes/reconciliationRoutes.js

import express from 'express';
import { reconcileTileStock, checkTileStock } from '../controllers/reconciliationController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Protect all routes and require admin access
router.use(protect);
router.use(authorize('admin'));

// Check for mismatches (dry run - doesn't change anything)
router.get('/check-tile-stock', checkTileStock);

// Fix all stock mismatches
router.post('/tile-stock', reconcileTileStock);

export default router;