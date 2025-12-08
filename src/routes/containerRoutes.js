import express from 'express';
import {
    getAllContainers,
    updateContainerStatus
} from '../controllers/containerController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes in this file are protected and restricted to India staff and admins
router.use(protect, authorize('admin', 'india-staff'));

// Route for GET /api/containers
router.route('/')
    .get(getAllContainers);

// Route for PUT /api/containers/:id/status
router.route('/:id/status')
    .put(updateContainerStatus);

export default router;
