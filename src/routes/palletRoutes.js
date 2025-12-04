import express from 'express';
import {
    getFactoryStock,
    createManualPallet,
    deletePallet,
    updatePalletBoxCount,
    getPalletDetailsForTile,
    getAvailablePalletsByFactory
} from '../controllers/palletController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET /api/pallets/factory-stock
// Fetches grouped stock for the main page.
router.get(
    '/factory-stock',
    protect,
    authorize('admin', 'india-staff'),
    getFactoryStock
);

// POST /api/pallets/manual-adjustment
// Creates a new pallet manually from the modal form.
router.post(
    '/manual-adjustment',
    protect,
    authorize('admin'),
    createManualPallet
);

// GET /api/pallets/details/:factoryId/:tileId
// Fetches the detailed list of individual pallets for the modal.
router.get(
    '/details/:factoryId/:tileId',
    protect,
    authorize('admin'),
    getPalletDetailsForTile
);

// PUT /api/pallets/pallet/:id
// Updates the box count of a single pallet.
router.put(
    '/pallet/:id',
    protect,
    authorize('admin'),
    updatePalletBoxCount
);

// DELETE /api/pallets/pallet/:id
// Deletes a single pallet.
router.delete(
    '/pallet/:id',
    protect,
    authorize('admin'),
    deletePallet
);

router.get(
    '/available-stock/:factoryId',
    protect,
    authorize('admin', 'india-staff'),
    getAvailablePalletsByFactory
);

export default router;
