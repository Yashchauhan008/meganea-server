import express from 'express';
import {
    createIndiaTile,
    getAllIndiaTiles,
    getIndiaTileById,
    updateIndiaTile,
    deleteIndiaTile,
    getTilesWithTransitStock
} from '../controllers/indiaTileController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes are protected and restricted to India-based staff and admins
router.use(protect, authorize('admin', 'india-staff'));

router.route('/')
    .get(getAllIndiaTiles)
    .post(createIndiaTile);
    
router.get('/with-transit-stock', protect, getTilesWithTransitStock);

router.route('/:id')
    .get(getIndiaTileById)
    .put(updateIndiaTile)
    .delete(authorize('admin'), deleteIndiaTile);



export default router;
