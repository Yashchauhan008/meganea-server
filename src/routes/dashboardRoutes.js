import express from 'express';
import { getDashboardData } from '../controllers/dashboardController.js';
import { protect } from '../middleware/authMiddleware.js';
import { getIndiaDashboardData } from '../controllers/indiaDashboardController.js';

const router = express.Router();
// A single, protected route for all dashboard data
router.route('/').get(protect, getDashboardData);

router.route('/india').get(protect, getIndiaDashboardData);

export default router;