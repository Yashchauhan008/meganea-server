// import express from 'express';
// import { 
//     getAllFactoryStock, 
//     getFactoryStockByFactory, 
//     getFactoryStockSummary,
//     getAllAvailablePallets,
//     getAvailablePalletsByFactory,
//     createManualPallet,
//     updatePalletBoxCount,
//     deletePallet,
//     getPalletDetailsForTile
// } from '../controllers/palletController.js';
// import { protect, authorize } from '../middleware/authMiddleware.js';

// const router = express.Router();

// // ===== SUMMARY VIEW - ALL FACTORIES =====
// router.get('/all-factory-stock', protect, authorize('admin', 'india-staff'), getAllFactoryStock);

// // ===== DETAIL VIEW - SPECIFIC FACTORY =====
// router.get('/factory-stock/:factoryId', protect, authorize('admin', 'india-staff'), getFactoryStockByFactory);
// router.get('/factory-stock-summary/:factoryId', protect, authorize('admin', 'india-staff'), getFactoryStockSummary);

// // ===== AVAILABLE PALLETS =====
// router.get('/available-stock', protect, authorize('admin', 'india-staff'), getAllAvailablePallets);
// router.get('/available/:factoryId', protect, authorize('admin', 'india-staff'), getAvailablePalletsByFactory);

// // ===== PALLET DETAILS FOR TILE =====
// router.get('/details/:factoryId/:tileId', protect, authorize('admin', 'india-staff'), getPalletDetailsForTile);

// // ===== MANUAL ADJUSTMENTS =====
// router.post('/manual-adjustment', protect, authorize('admin'), createManualPallet);

// // ===== UPDATE AND DELETE =====
// router.put('/:id', protect, authorize('admin'), updatePalletBoxCount);
// router.delete('/:id', protect, authorize('admin'), deletePallet);

// export default router;

// backend/src/routes/palletRoutes.js

import express from 'express';
import { 
    getAllFactoryStock, 
    getFactoryStockByFactory, 
    getFactoryStockSummary,
    getAllAvailablePallets,
    getAvailablePalletsByFactory,
    createManualPallet,
    updatePalletBoxCount,
    deletePallet,
    getPalletDetailsForTile,
    getFactoryStock,
    getAllPallets,        // ✅ Added
    getPalletById,        // ✅ Added
    updatePallet,         // ✅ Added (duplicate of updatePalletBoxCount - choose one)
} from '../controllers/palletController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Protect all routes
router.use(protect);

// ===== NEW: GENERAL FACTORY STOCK (for dispatch module) =====
router.get(
    '/factory-stock',
    authorize('admin', 'india-staff'),
    getFactoryStock
);

// ===== SUMMARY VIEW - ALL FACTORIES =====
router.get(
    '/all-factory-stock', 
    authorize('admin', 'india-staff'), 
    getAllFactoryStock
);

// ===== GET ALL PALLETS =====
router.get(
    '/all',
    authorize('admin', 'india-staff'),
    getAllPallets
);

// ===== DETAIL VIEW - SPECIFIC FACTORY =====
router.get(
    '/factory-stock/:factoryId', 
    authorize('admin', 'india-staff'), 
    getFactoryStockByFactory
);

router.get(
    '/factory-stock-summary/:factoryId', 
    authorize('admin', 'india-staff'), 
    getFactoryStockSummary
);

// ===== AVAILABLE PALLETS =====
router.get(
    '/available-stock', 
    authorize('admin', 'india-staff'), 
    getAllAvailablePallets
);

router.get(
    '/available/:factoryId', 
    authorize('admin', 'india-staff'), 
    getAvailablePalletsByFactory
);

// ===== PALLET DETAILS FOR TILE =====
router.get(
    '/details/:factoryId/:tileId', 
    authorize('admin', 'india-staff'), 
    getPalletDetailsForTile
);

// ===== MANUAL ADJUSTMENTS =====
router.post(
    '/manual-adjustment', 
    authorize('admin'), 
    createManualPallet
);

// ===== SINGLE PALLET OPERATIONS =====
// IMPORTANT: These MUST come LAST (after all specific routes)
router.get(
    '/:id',
    authorize('admin', 'india-staff'),
    getPalletById
);

router.put(
    '/:id', 
    authorize('admin'), 
    updatePalletBoxCount  // or updatePallet - they do the same thing
);

router.delete(
    '/:id', 
    authorize('admin'), 
    deletePallet
);

export default router;