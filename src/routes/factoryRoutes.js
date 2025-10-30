import express from 'express';
import { createFactory, getAllFactories } from '../controllers/factoryController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect, authorize('admin', 'india-staff'));

router.route('/')
    .post(createFactory)
    .get(getAllFactories);

export default router;
