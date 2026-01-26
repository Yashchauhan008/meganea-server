
// import express from 'express';
// import {
//     createFactory,
//     getAllFactories,
//     getFactoryById,
//     updateFactory,
//     deleteFactory,
//     getFactoryWithStock,
//     getDeletedFactories,
//     restoreFactory
// } from '../controllers/factoryController.js';
// import { protect, authorize } from '../middleware/authMiddleware.js';

// const router = express.Router();

// // Special routes (must be before /:id)
// router.route('/deleted')
//     .get(protect, authorize('admin'), getDeletedFactories);

// // Main routes
// router.route('/')
//     .get(protect, getAllFactories)
//     .post(protect, authorize('admin', 'india-staff'), createFactory);

// router.route('/:id')
//     .get(protect, getFactoryById)
//     .put(protect, authorize('admin', 'india-staff'), updateFactory)
//     .delete(protect, authorize('admin'), deleteFactory);

// router.route('/:id/with-stock')
//     .get(protect, getFactoryWithStock);

// router.route('/:id/restore')
//     .put(protect, authorize('admin'), restoreFactory);

// export default router;

// FILE: backend/src/routes/factoryRoutes.js
// COMPLETE ERROR-FREE VERSION

import express from 'express';
import {
    createFactory,
    getAllFactories,
    getFactoryById,
    getFactoryDetails,
    updateFactory,
    updateFactoryStatus,
    deleteFactory,
    getFactoryWithStock,
    getDeletedFactories,
    restoreFactory
} from '../controllers/factoryController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Special routes (must be before /:id)
router.route('/deleted')
    .get(protect, authorize('admin'), getDeletedFactories);

// Main routes
router.route('/')
    .get(protect, getAllFactories)
    .post(protect, authorize('admin', 'india-staff'), createFactory);

// Detail view with tiles (must be before /:id to avoid conflict)
router.route('/:id/detail')
    .get(protect, getFactoryDetails);

// Stock summary
router.route('/:id/with-stock')
    .get(protect, getFactoryWithStock);

// Status update
router.route('/:id/status')
    .patch(protect, authorize('admin', 'india-staff'), updateFactoryStatus);

// Restore deleted factory
router.route('/:id/restore')
    .put(protect, authorize('admin'), restoreFactory);

// Standard CRUD (must be last)
router.route('/:id')
    .get(protect, getFactoryById)
    .put(protect, authorize('admin', 'india-staff'), updateFactory)
    .delete(protect, authorize('admin'), deleteFactory);

export default router;