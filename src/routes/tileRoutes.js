// // FILE: backend/src/routes/tileRoutes.js

// import express from 'express';
// import {
//   createTile,
//   getAllTiles,
//   getTileById,
//   updateTile,
//   deleteTile,
//   getTilesForBooking,
//   getUniqueTileSizes,
//   bulkCreateTiles,
//   getTilesByFactory,
//   getTileStockDetails  // <-- ADD THIS IMPORT
// } from '../controllers/tileController.js';
// import { protect, authorize } from '../middleware/authMiddleware.js';

// const router = express.Router();

// // Define the most specific routes FIRST
// router.route('/for-booking').get(getTilesForBooking);
// router.route('/sizes').get(protect, getUniqueTileSizes);

// router.post('/bulk', protect, authorize('admin', 'dubai-staff', 'india-staff'), bulkCreateTiles);

// // Stock details route - MUST be before /:id to avoid conflict
// router.route('/:id/stock-details').get(protect, getTileStockDetails);

// // Now define the general routes
// router.route('/')
//   .get(getAllTiles)
//   .post(protect, authorize('admin', 'dubai-staff', 'india-staff'), createTile);

// // Define the "greedy" dynamic route LAST
// router.route('/:id')
//   .get(getTileById)
//   .put(protect, authorize('admin', 'dubai-staff', 'india-staff'), updateTile)
//   .delete(protect, authorize('admin', 'dubai-staff'), deleteTile);

// router.route('/by-factory/:factoryId').get(getTilesByFactory);

// export default router;

// FILE: backend/src/routes/tileRoutes.js
// COMPLETE FILE - Replace entire file

import express from 'express';
import {
    createTile,
    getAllTiles,
    getTileById,
    updateTile,
    deleteTile,
    getTilesForBooking,
    getUniqueTileSizes,
    bulkCreateTiles,
    getTilesByFactory,
    getTileStockDetails,
    getDeletedTiles,
    restoreTile
} from '../controllers/tileController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Special routes (must be before /:id to avoid conflicts)
router.route('/for-booking')
    .get(getTilesForBooking);

router.route('/sizes')
    .get(protect, getUniqueTileSizes);

router.route('/bulk')
    .post(protect, authorize('admin', 'dubai-staff', 'india-staff'), bulkCreateTiles);

router.route('/deleted')
    .get(protect, authorize('admin'), getDeletedTiles);

router.route('/by-factory/:factoryId')
    .get(protect, getTilesByFactory);

// Main routes
router.route('/')
    .get(getAllTiles)
    .post(protect, authorize('admin', 'dubai-staff', 'india-staff'), createTile);

// Stock details route (must be before /:id)
router.route('/:id/stock-details')
    .get(protect, getTileStockDetails);

// Restore route
router.route('/:id/restore')
    .put(protect, authorize('admin'), restoreTile);

// Single tile routes
router.route('/:id')
    .get(getTileById)
    .put(protect, authorize('admin', 'dubai-staff', 'india-staff'), updateTile)
    .delete(protect, authorize('admin', 'dubai-staff'), deleteTile);

export default router;