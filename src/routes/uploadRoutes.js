import express from 'express';
import upload from '../config/cloudinary.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// A dedicated image upload endpoint for tiles.
// The path is now '/' to correctly handle POST requests to '/api/uploads'.
router.post(
  '/', // <--- THIS IS THE CORRECT PATH
  protect,
  authorize('admin', 'dubai-staff', 'india-staff'),
  upload.single('image'), // 'image' must match the FormData key from the frontend
  (req, res) => {
    if (!req.file) {
      res.status(400);
      throw new Error('Please upload an image file');
    }
    // Send back the secure URL and public ID from Cloudinary
    res.status(200).json({
      message: 'Image uploaded successfully',
      imageUrl: req.file.path,
      publicId: req.file.filename,
    });
  }
);

export default router;
