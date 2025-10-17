const express = require('express');
const router = express.Router();
const { createTile, getAllTiles, getTileById, updateTile } = require('../controllers/tileController');
const { protect } = require('../middlewares/authMiddleware');
const { role } = require('../middlewares/roleMiddleware');
const { upload } = require('../config/cloudinary');

router.route('/')
  .post(protect, role('admin'), upload.single('image'), createTile)
  .get(protect, getAllTiles);

router.route('/:id')
  .get(protect, getTileById)
  .put(protect, role('admin'), upload.single('image'), updateTile);

module.exports = router;
