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


/**
 * @desc    Get all Dubai tiles with transit stock information
 * @route   GET /api/india-tiles/with-transit-stock
 * @access  Private/Admin/India-Staff
 * 
 * This endpoint calculates transit stock for DUBAI tiles by checking
 * which tiles are currently in containers with "In Transit" status
 */
export const getTilesWithTransitStock = asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, search = '', size = '' } = req.query;
    
    // Build query
    let query = {};
    if (search) {
        query.$or = [
            { name: new RegExp(search, 'i') },
            { number: new RegExp(search, 'i') },
            { color: new RegExp(search, 'i') }
        ];
    }
    if (size) {
        query.size = size;
    }

    // Get DUBAI tiles (not India tiles) with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const tiles = await Tile.find(query) // Using Tile model (Dubai tiles)
        .populate('manufacturingFactories', 'name')
        .populate('createdBy', 'username')
        .sort({ name: 1 })
        .limit(parseInt(limit))
        .skip(skip);

    const total = await Tile.countDocuments(query);

    // Calculate transit stock for each tile
    // Transit stock = tiles in containers with status "In Transit"
    const Container = mongoose.model('Container');
    const Pallet = mongoose.model('Pallet');
    
    const tilesWithTransit = await Promise.all(tiles.map(async (tile) => {
        try {
            // Find all pallets of this tile that are in "In Transit" containers
            const transitContainers = await Container.find({
                status: 'In Transit'
            }).select('pallets');

            const transitPalletIds = transitContainers.flatMap(c => c.pallets);
            
            const transitPallets = await Pallet.find({
                _id: { $in: transitPalletIds },
                tile: tile._id
            });

            const transitStock = transitPallets.reduce((sum, pallet) => sum + pallet.boxCount, 0);

            return {
                ...tile.toObject(),
                transitStock: transitStock || 0
            };
        } catch (error) {
            console.error(`Error calculating transit stock for tile ${tile._id}:`, error);
            return {
                ...tile.toObject(),
                transitStock: 0
            };
        }
    }));

    res.status(200).json({
        tiles: tilesWithTransit,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total
    });
});
