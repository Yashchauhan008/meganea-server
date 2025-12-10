import express from 'express';
import {
    getFactoryStock,
    createManualPallet,
    deletePallet,
    updatePalletBoxCount,
    getPalletDetailsForTile,
    getAvailablePalletsByFactory,
    getAllAvailablePallets
} from '../controllers/palletController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// This route fetches the main grouped stock for the dashboard/stock page.
router.get(
    '/factory-stock',
    protect,
    authorize('admin', 'india-staff'),
    getFactoryStock
);

// This route handles manual pallet creation.
router.post(
    '/manual-adjustment',
    protect,
    authorize('admin'),
    createManualPallet
);

// This route gets the detailed list of individual pallets for a specific tile.
router.get(
    '/details/:factoryId/:tileId',
    protect,
    authorize('admin'),
    getPalletDetailsForTile
);

// This route updates a single pallet's box count.
router.put(
    '/pallet/:id',
    protect,
    authorize('admin'),
    updatePalletBoxCount
);

// This route deletes a single pallet.
router.delete(
    '/pallet/:id',
    protect,
    authorize('admin'),
    deletePallet
);


// --- THIS IS THE CRITICAL FIX ---

// ROUTE 1: Get ALL available pallets from ALL factories.
// This general route MUST be defined BEFORE the more specific route with a parameter.
router.get(
    '/available-stock',
    protect,
    authorize('admin', 'india-staff'),
    getAllAvailablePallets
);

// ROUTE 2: Get available pallets for a SPECIFIC factory.
// This route will only be matched if the URL has something after '/available-stock/',
// e.g., '/available-stock/60d21b4667d0d8992e610c85'
router.get(
    '/available-stock/:factoryId',
    protect,
    authorize('admin', 'india-staff'),
    getAvailablePalletsByFactory
);

// --- END OF CRITICAL FIX ---


export default router;
