import express from 'express';
import upload from '../config/cloudinary.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// A generic image upload endpoint
router.post(
  '/',
  protect,
  authorize('admin', 'dubai-staff'),
  upload.single('image'),
  (req, res) => {
    if (!req.file) {
      res.status(400);
      throw new Error('Please upload a file');
    }
    res.status(200).json({
      message: 'Image uploaded successfully',
      imageUrl: req.file.path,
      publicId: req.file.filename,
    });
  }
);

export default router;
