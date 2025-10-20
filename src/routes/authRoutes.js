import express from 'express';
import { loginUser, registerUser, getMe } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', registerUser); // Should be a protected, admin-only route in a real app
router.post('/login', loginUser);
router.get('/me', protect, getMe);

export default router;
