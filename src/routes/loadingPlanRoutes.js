import express from 'express';
// Import all controller functions
import { createLoadingPlan, getLoadingPlans, getLoadingPlanById, updateLoadingPlan, deleteLoadingPlan } from '../controllers/loadingPlanController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .post(protect, authorize('admin', 'india-staff'), createLoadingPlan)
    .get(protect, authorize('admin', 'india-staff'), getLoadingPlans);

// This route now handles GET, PUT, and DELETE
router.route('/:id')
    .get(protect, authorize('admin', 'india-staff'), getLoadingPlanById)
    .put(protect, authorize('admin', 'india-staff'), updateLoadingPlan)
    .delete(protect, authorize('admin'), deleteLoadingPlan); // <-- ADD THIS LINE (Admin only)

export default router;
