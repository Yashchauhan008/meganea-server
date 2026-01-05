// import express from 'express';
// import {
//     createContainer,
//     getAllContainers,
//     getContainerById, // <-- IMPORT THE NEW FUNCTION
//     updateContainer,
//     updateContainerStatus
// } from '../controllers/containerController.js';
// import { protect, authorize } from '../middleware/authMiddleware.js';

// const router = express.Router();

// router.use(protect, authorize('admin', 'india-staff'));

// router.route('/')
//     .get(getAllContainers)
//     .post(createContainer);

// // --- THIS IS THE CORRECTED ROUTE FOR A SINGLE CONTAINER ---
// router.route('/:id')
//     .get(getContainerById) // <-- ADD THE GET HANDLER
//     .put(updateContainer);
// // --- END OF CORRECTION ---

// router.route('/:id/status')
//     .patch(updateContainerStatus);

// export default router;


// FILE: backend/src/routes/containerRoutes.js
// COMPLETE FILE - Replace entire file

import express from 'express';
import {
    getAllContainers,
    getContainerById,
    createContainer,
    updateContainer,
    updateContainerStatus,
    deleteContainer,
    getContainersByFactory,
    getContainersByLoadingPlan,
    getAvailableContainersForDispatch
} from '../controllers/containerController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Special routes (must be before /:id)
router.route('/available-for-dispatch')
    .get(protect, getAvailableContainersForDispatch);

router.route('/factory/:factoryId')
    .get(protect, getContainersByFactory);

router.route('/loading-plan/:loadingPlanId')
    .get(protect, getContainersByLoadingPlan);

// Main routes
router.route('/')
    .get(protect, getAllContainers)
    .post(protect, authorize('admin', 'india-staff'), createContainer);

router.route('/:id')
    .get(protect, getContainerById)
    .put(protect, authorize('admin', 'india-staff'), updateContainer)
    .delete(protect, authorize('admin', 'india-staff'), deleteContainer);

router.route('/:id/status')
    .put(protect, authorize('admin', 'india-staff'), updateContainerStatus);

export default router;