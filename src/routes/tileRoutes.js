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
//   getTilesByFactory
// } from '../controllers/tileController.js';
// import { protect, authorize } from '../middleware/authMiddleware.js';

// const router = express.Router();

// // --- THIS IS THE FIX ---
// // Define the most specific routes FIRST.
// router.route('/for-booking').get(getTilesForBooking);
// // ---------------------
// router.route('/sizes').get(protect, getUniqueTileSizes);

// router.post('/bulk', protect, authorize('admin', 'dubai-staff', 'india-staff'), bulkCreateTiles);

// // Now define the general routes.
// router.route('/')
//   .get(getAllTiles)
//   .post(protect, authorize('admin', 'dubai-staff', 'india-staff'), createTile);

// // Finally, define the "greedy" dynamic route LAST.
// router.route('/:id')
//   .get(getTileById)
//   .put(protect, authorize('admin', 'dubai-staff', 'india-staff'), updateTile)
//   .delete(protect, authorize('admin', 'dubai-staff'), deleteTile);

// router.route('/by-factory/:factoryId').get(getTilesByFactory);


// export default router;

// FILE LOCATION: backend/src/routes/tileRoutes.js

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
  getTileStockDetails  // NEW
} from '../controllers/tileController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Define the most specific routes FIRST
router.route('/for-booking').get(getTilesForBooking);
router.route('/sizes').get(protect, getUniqueTileSizes);
router.post('/bulk', protect, authorize('admin', 'dubai-staff', 'india-staff'), bulkCreateTiles);
router.route('/by-factory/:factoryId').get(protect, getTilesByFactory);

// NEW: Get detailed stock info for a tile (factory stock + transit stock)
router.route('/:id/stock-details').get(protect, getTileStockDetails);

// General routes
router.route('/')
  .get(getAllTiles)
  .post(protect, authorize('admin', 'dubai-staff', 'india-staff'), createTile);

// Dynamic route LAST
router.route('/:id')
  .get(getTileById)
  .put(protect, authorize('admin', 'dubai-staff', 'india-staff'), updateTile)
  .delete(protect, authorize('admin', 'dubai-staff'), deleteTile);

export default router;