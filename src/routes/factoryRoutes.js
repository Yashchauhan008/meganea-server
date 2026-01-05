// import express from 'express';
// import { createFactory, getAllFactories } from '../controllers/factoryController.js';
// import { protect, authorize } from '../middleware/authMiddleware.js';

// const router = express.Router();

// router.use(protect, authorize('admin', 'india-staff'));

// router.route('/')
//     .post(createFactory)
//     .get(getAllFactories);

// export default router;

// FILE: backend/src/routes/factoryRoutes.js
// COMPLETE FILE - Replace entire file

import express from 'express';
import {
    createFactory,
    getAllFactories,
    getFactoryById,
    updateFactory,
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

router.route('/:id')
    .get(protect, getFactoryById)
    .put(protect, authorize('admin', 'india-staff'), updateFactory)
    .delete(protect, authorize('admin'), deleteFactory);

router.route('/:id/with-stock')
    .get(protect, getFactoryWithStock);

router.route('/:id/restore')
    .put(protect, authorize('admin'), restoreFactory);

export default router;