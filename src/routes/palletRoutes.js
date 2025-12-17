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
    getPalletDetailsForTile
} from '../controllers/palletController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// ===== SUMMARY VIEW - ALL FACTORIES =====
router.get('/all-factory-stock', protect, authorize('admin', 'india-staff'), getAllFactoryStock);

// ===== DETAIL VIEW - SPECIFIC FACTORY =====
router.get('/factory-stock/:factoryId', protect, authorize('admin', 'india-staff'), getFactoryStockByFactory);
router.get('/factory-stock-summary/:factoryId', protect, authorize('admin', 'india-staff'), getFactoryStockSummary);

// ===== AVAILABLE PALLETS =====
router.get('/available-stock', protect, authorize('admin', 'india-staff'), getAllAvailablePallets);
router.get('/available/:factoryId', protect, authorize('admin', 'india-staff'), getAvailablePalletsByFactory);

// ===== PALLET DETAILS FOR TILE =====
router.get('/details/:factoryId/:tileId', protect, authorize('admin', 'india-staff'), getPalletDetailsForTile);

// ===== MANUAL ADJUSTMENTS =====
router.post('/manual-adjustment', protect, authorize('admin'), createManualPallet);

// ===== UPDATE AND DELETE =====
router.put('/:id', protect, authorize('admin'), updatePalletBoxCount);
router.delete('/:id', protect, authorize('admin'), deletePallet);

export default router;
