import express from 'express';
import { getDashboardData } from '../controllers/dashboardController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// A single, protected route for all dashboard data
router.route('/').get(protect, getDashboardData);

export default router;
