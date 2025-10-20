import express from 'express';
import {
  createParty,
  getAllParties,
  getPartyById,
  updateParty,
  deleteParty,
} from '../controllers/partyController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Protect all party routes
router.use(protect, authorize('admin', 'dubai-staff', 'salesman'));

router.route('/').post(createParty).get(getAllParties);
router.route('/:id').get(getPartyById).put(updateParty).delete(authorize('admin'), deleteParty);

export default router;
