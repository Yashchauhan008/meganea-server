const asyncHandler = require('express-async-handler');
const Tile = require('../models/Tile');
const { generateUniqueId } = require('../utils/generateId');

// @desc    Create a new tile
// @route   POST /api/tiles
// @access  Private/Admin
const createTile = asyncHandler(async (req, res) => {
  const { name, number, surface, size } = req.body;
  
  if (!req.file) {
    res.status(400);
    throw new Error('Image file is required');
  }

  const tileId = `TILE-${Date.now()}`; // Simple unique ID
  
  const tile = await Tile.create({
    tileId,
    name,
    number,
    surface,
    size,
    imageUrl: req.file.path,
  });

  res.status(201).json(tile);
});

// @desc    Get all tiles
// @route   GET /api/tiles
// @access  Private
const getAllTiles = asyncHandler(async (req, res) => {
  const tiles = await Tile.find({ isActive: true });
  res.status(200).json(tiles);
});

// @desc    Get a single tile by ID
// @route   GET /api/tiles/:id
// @access  Private
const getTileById = asyncHandler(async (req, res) => {
  const tile = await Tile.findById(req.params.id);
  if (!tile) {
    res.status(404);
    throw new Error('Tile not found');
  }
  res.status(200).json(tile);
});

// @desc    Update a tile
// @route   PUT /api/tiles/:id
// @access  Private/Admin
const updateTile = asyncHandler(async (req, res) => {
  const { name, number, surface, size, isActive } = req.body;
  const tile = await Tile.findById(req.params.id);

  if (!tile) {
    res.status(404);
    throw new Error('Tile not found');
  }

  tile.name = name || tile.name;
  tile.number = number || tile.number;
  tile.surface = surface || tile.surface;
  tile.size = size || tile.size;
  tile.isActive = isActive !== undefined ? isActive : tile.isActive;

  if (req.file) {
    tile.imageUrl = req.file.path;
  }

  const updatedTile = await tile.save();
  res.status(200).json(updatedTile);
});

module.exports = { createTile, getAllTiles, getTileById, updateTile };
