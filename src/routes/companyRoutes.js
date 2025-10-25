import express from 'express';
import {
  createCompany,
  getAllCompanies,
  getCompanyById,
  updateCompany,
  deleteCompany,
} from '../controllers/companyController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Protect all company routes
router.use(protect, authorize('admin', 'dubai-staff', 'salesman'));

router.route('/').post(createCompany).get(getAllCompanies);
router.route('/:id').get(getCompanyById).put(updateCompany).delete(authorize('admin'), deleteCompany);

export default router;
