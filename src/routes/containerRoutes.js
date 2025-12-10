import express from 'express';
import {
    createContainer,
    getAllContainers,
    getContainerById, // <-- IMPORT THE NEW FUNCTION
    updateContainer,
    updateContainerStatus
} from '../controllers/containerController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect, authorize('admin', 'india-staff'));

router.route('/')
    .get(getAllContainers)
    .post(createContainer);

// --- THIS IS THE CORRECTED ROUTE FOR A SINGLE CONTAINER ---
router.route('/:id')
    .get(getContainerById) // <-- ADD THE GET HANDLER
    .put(updateContainer);
// --- END OF CORRECTION ---

router.route('/:id/status')
    .patch(updateContainerStatus);

export default router;
