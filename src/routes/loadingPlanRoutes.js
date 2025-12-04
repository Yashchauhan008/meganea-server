import express from 'express';
// --- THIS IS THE FIX: Import the new controller function ---
import { createLoadingPlan, getLoadingPlans, getLoadingPlanById } from '../controllers/loadingPlanController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// This route handles GET for all plans and POST for creating a new one
router.route('/')
    .post(
        protect,
        authorize('admin', 'india-staff'),
        createLoadingPlan
    )
    .get(
        protect,
        authorize('admin', 'india-staff'),
        getLoadingPlans
    );

// --- THIS IS THE FIX: Add the new route for getting a single plan by its ID ---
// This route must be defined to handle requests like /api/loading-plans/60d21b4667d0d8992e610c85
router.route('/:id')
    .get(
        protect,
        authorize('admin', 'india-staff'),
        getLoadingPlanById
    );
// --- END OF FIX ---

export default router;
