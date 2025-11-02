import asyncHandler from '../utils/asyncHandler.js';
import IndiaTile from '../models/indiaTileModel.js';
import Factory from '../models/factoryModel.js'; // Needed for validation

// @desc    Create a new IndiaTile
// @route   POST /api/india-tiles
// @access  Private/Admin/India-Staff
export const createIndiaTile = asyncHandler(async (req, res) => {
    const { name, number, size, surface, image, manufacturingFactories } = req.body;

    const tileExists = await IndiaTile.findOne({ name });
    if (tileExists) {
        res.status(400);
        throw new Error('A tile with this name already exists.');
    }

    const tile = await IndiaTile.create({
        name,
        number,
        size,
        surface,
        image,
        manufacturingFactories,
    });

    res.status(201).json(tile);
});

// @desc    Get all IndiaTiles
// @route   GET /api/india-tiles
// @access  Private/Admin/India-Staff
export const getAllIndiaTiles = asyncHandler(async (req, res) => {
    const tiles = await IndiaTile.find({})
        .populate('manufacturingFactories', 'name') // Populate factory names
        .sort({ name: 1 });
    res.status(200).json(tiles);
});

// @desc    Get a single IndiaTile by ID
// @route   GET /api/india-tiles/:id
// @access  Private/Admin/India-Staff
export const getIndiaTileById = asyncHandler(async (req, res) => {
    const tile = await IndiaTile.findById(req.params.id).populate('manufacturingFactories', 'name');
    if (!tile) {
        res.status(404);
        throw new Error('Tile not found');
    }
    res.status(200).json(tile);
});

// @desc    Update an IndiaTile
// @route   PUT /api/india-tiles/:id
// @access  Private/Admin/India-Staff
export const updateIndiaTile = asyncHandler(async (req, res) => {
    const { name, number, size, surface, image, manufacturingFactories } = req.body;

    const tile = await IndiaTile.findById(req.params.id);
    if (!tile) {
        res.status(404);
        throw new Error('Tile not found');
    }

    tile.name = name ?? tile.name;
    tile.number = number ?? tile.number;
    tile.size = size ?? tile.size;
    tile.surface = surface ?? tile.surface;
    tile.image = image ?? tile.image;
    tile.manufacturingFactories = manufacturingFactories ?? tile.manufacturingFactories;

    const updatedTile = await tile.save();
    res.status(200).json(updatedTile);
});

// @desc    Delete an IndiaTile (soft delete)
// @route   DELETE /api/india-tiles/:id
// @access  Private/Admin
export const deleteIndiaTile = asyncHandler(async (req, res) => {
    const tile = await IndiaTile.findById(req.params.id);
    if (!tile) {
        res.status(404);
        throw new Error('Tile not found');
    }
    tile.deleted = true;
    await tile.save();
    res.status(200).json({ message: 'Tile archived successfully' });
});
