import Tile from '../models/tileModel.js';
import asyncHandler from '../utils/asyncHandler.js';
import { generateId } from '../services/idGenerator.js';

// @desc    Create a new tile
// @route   POST /api/tiles
// @access  Private/Admin, Private/Staff
export const createTile = asyncHandler(async (req, res) => {
  const { name, number, surface, size, imageUrl, conversionFactor, restockThreshold, stockDetails } = req.body;

  const tileId = await generateId('TL');

  const tile = await Tile.create({
    tileId,
    name,
    number,
    surface,
    size,
    imageUrl,
    conversionFactor,
    restockThreshold,
    stockDetails,
  });

  res.status(201).json(tile);
});

// @desc    Get all tiles
// @route   GET /api/tiles
// @access  Public
export const getAllTiles = asyncHandler(async (req, res) => {
  const tiles = await Tile.find({ isActive: true });
  res.status(200).json(tiles);
});

// @desc    Get a single tile by ID
// @route   GET /api/tiles/:id
// @access  Public
export const getTileById = asyncHandler(async (req, res) => {
  const tile = await Tile.findById(req.params.id);
  if (!tile) {
    res.status(404);
    throw new Error('Tile not found');
  }
  res.status(200).json(tile);
});

// @desc    Update a tile
// @route   PUT /api/tiles/:id
// @access  Private/Admin, Private/Staff
export const updateTile = asyncHandler(async (req, res) => {
  const tile = await Tile.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!tile) {
    res.status(404);
    throw new Error('Tile not found');
  }

  res.status(200).json(tile);
});

// @desc    Delete a tile (soft delete)
// @route   DELETE /api/tiles/:id
// @access  Private/Admin
export const deleteTile = asyncHandler(async (req, res) => {
  const tile = await Tile.findById(req.params.id);

  if (!tile) {
    res.status(404);
    throw new Error('Tile not found');
  }

  // Soft delete by setting isActive to false
  tile.isActive = false;
  await tile.save();

  res.status(200).json({ message: 'Tile deactivated successfully' });
});
