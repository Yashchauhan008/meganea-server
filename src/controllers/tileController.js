// import Tile from '../models/tileModel.js';
// import asyncHandler from '../utils/asyncHandler.js';
// import { generateId } from '../services/idGenerator.js';
// import logger from '../config/logger.js';

// export const createTile = asyncHandler(async (req, res) => {
//   const { name, number, surface, size, imageUrl, publicId, conversionFactor, restockThreshold, stockDetails } = req.body;
//   const tileId = await generateId('TL');

//   const tile = await Tile.create({
//     tileId, name, number, surface, size, imageUrl, publicId, conversionFactor, restockThreshold,
//     stockDetails: {
//       availableStock: Number(stockDetails?.availableStock || 0),
//       bookedStock: Number(stockDetails?.bookedStock || 0),
//       restockingStock: Number(stockDetails?.restockingStock || 0),
//     },
//     createdBy: req.user._id,
//   });

//   logger.info(`Tile "${tile.name}" created by user ${req.user.username}`);
//   res.status(201).json(tile);
// });

// export const updateTile = asyncHandler(async (req, res) => {
//   const { name, number, surface, size, imageUrl, publicId, conversionFactor, restockThreshold, stockDetails } = req.body;
//   const tile = await Tile.findById(req.params.id);
//   if (!tile) {
//     res.status(404);
//     throw new Error('Tile not found');
//   }

//   tile.name = name ?? tile.name;
//   tile.number = number ?? tile.number;
//   tile.surface = surface ?? tile.surface;
//   tile.size = size ?? tile.size;
//   tile.imageUrl = imageUrl ?? tile.imageUrl;
//   tile.publicId = publicId ?? tile.publicId;
//   tile.conversionFactor = conversionFactor ?? tile.conversionFactor;
//   tile.restockThreshold = restockThreshold ?? tile.restockThreshold;

//   if (stockDetails) {
//     tile.stockDetails.availableStock = stockDetails.availableStock ?? tile.stockDetails.availableStock;
//     tile.stockDetails.bookedStock = stockDetails.bookedStock ?? tile.stockDetails.bookedStock;
//     tile.stockDetails.restockingStock = stockDetails.restockingStock ?? tile.stockDetails.restockingStock;
//   }

//   const updatedTile = await tile.save();
//   logger.info(`Tile "${updatedTile.name}" updated by ${req.user.username}`);
//   res.status(200).json(updatedTile);
// });

// export const getTileById = asyncHandler(async (req, res) => {
//   const tile = await Tile.findById(req.params.id);
//   if (!tile) {
//     res.status(404);
//     throw new Error('Tile not found');
//   }
//   res.status(200).json(tile);
// });

// export const deleteTile = asyncHandler(async (req, res) => {
//   const tile = await Tile.findById(req.params.id);
//   if (!tile) {
//       res.status(404);
//       throw new Error('Tile not found');
//   }
//   tile.deleted = true;
//   await tile.save();
//   logger.info(`Tile "${tile.name}" archived by ${req.user.username}`);
//   res.status(200).json({ message: 'Tile archived successfully' });
// });

// /**
//  * @desc    Get all tiles with search, filter, and pagination
//  * @route   GET /api/tiles
//  * @access  Public
//  */
// export const getAllTiles = asyncHandler(async (req, res) => {
//   const { search, size, underThreshold, page = 1, limit = 50 } = req.query;

//   const query = { deleted: { $ne: true } };

//   if (search) {
//     const searchRegex = new RegExp(search, 'i');
//     query.$or = [{ name: searchRegex }, { number: searchRegex }];
//   }

//   if (size) {
//     query.size = size;
//   }

//   // --- NEW LOGIC FOR THRESHOLD FILTER ---
//   if (underThreshold === 'true') {
//     // Use $expr to compare two fields from the same document
//     query.$expr = { $lte: ['$stockDetails.availableStock', '$restockThreshold'] };
//   }
//   // ------------------------------------

//   const pageNum = Number(page);
//   const limitNum = Number(limit);
//   const skip = (pageNum - 1) * limitNum;

//   const totalTiles = await Tile.countDocuments(query);

//   const tiles = await Tile.find(query)
//     .populate('createdBy', 'username')
//     .sort({ createdAt: -1 })
//     .limit(limitNum)
//     .skip(skip);

//   res.status(200).json({
//     tiles,
//     page: pageNum,
//     pages: Math.ceil(totalTiles / limitNum),
//     total: totalTiles,
//   });
// });

import Tile from '../models/tileModel.js';
import asyncHandler from '../utils/asyncHandler.js';
import { generateId } from '../services/idGenerator.js';
import logger from '../config/logger.js';

// @desc    Create a new tile
// @route   POST /api/tiles
export const createTile = asyncHandler(async (req, res) => {
  const { name, number, surface, size, imageUrl, publicId, conversionFactor, restockThreshold, stockDetails } = req.body;

  // --- NEW: Check for unique tile number before creating ---
  if (number) {
    const existingTileWithNumber = await Tile.findOne({ number });
    if (existingTileWithNumber) {
      res.status(400);
      throw new Error(`A tile with number '${number}' already exists.`);
    }
  }
  // ---------------------------------------------------------

  const tileId = await generateId('TL');

  const tile = await Tile.create({
    tileId,
    name,
    number,
    surface,
    size,
    imageUrl,
    publicId,
    conversionFactor,
    restockThreshold,
    stockDetails: {
      availableStock: Number(stockDetails?.availableStock || 0),
      bookedStock: Number(stockDetails?.bookedStock || 0),
      restockingStock: Number(stockDetails?.restockingStock || 0),
    },
    createdBy: req.user._id,
  });

  logger.info(`Tile "${tile.name}" created successfully by ${req.user.username}`);
  res.status(201).json(tile);
});

// @desc    Update a tile
// @route   PUT /api/tiles/:id
export const updateTile = asyncHandler(async (req, res) => {
  const { name, number, surface, size, imageUrl, publicId, conversionFactor, restockThreshold, stockDetails } = req.body;

  const tile = await Tile.findById(req.params.id);
  if (!tile) {
    res.status(404);
    throw new Error('Tile not found');
  }

  // --- NEW: Check for unique tile number before updating ---
  if (number) {
    const existingTileWithNumber = await Tile.findOne({ number, _id: { $ne: req.params.id } });
    if (existingTileWithNumber) {
      res.status(400);
      throw new Error(`Another tile with number '${number}' already exists.`);
    }
  }
  // ---------------------------------------------------------

  tile.name = name ?? tile.name;
  tile.number = number ?? tile.number;
  tile.surface = surface ?? tile.surface;
  tile.size = size ?? tile.size;
  tile.imageUrl = imageUrl ?? tile.imageUrl;
  tile.publicId = publicId ?? tile.publicId;
  tile.conversionFactor = conversionFactor ?? tile.conversionFactor;
  tile.restockThreshold = restockThreshold ?? tile.restockThreshold;

  if (stockDetails) {
    tile.stockDetails.availableStock = stockDetails.availableStock ?? tile.stockDetails.availableStock;
    tile.stockDetails.bookedStock = stockDetails.bookedStock ?? tile.stockDetails.bookedStock;
    tile.stockDetails.restockingStock = stockDetails.restockingStock ?? tile.stockDetails.restockingStock;
  }

  const updatedTile = await tile.save();
  logger.info(`Tile "${updatedTile.name}" updated successfully by ${req.user.username}`);
  res.status(200).json(updatedTile);
});

// --- OTHER CONTROLLERS (Unchanged and Correct) ---
export const getAllTiles = asyncHandler(async (req, res) => {
    const { search, size, underThreshold, page = 1, limit = 50 } = req.query;
    const query = { deleted: { $ne: true } };
    if (search) {
        const searchRegex = new RegExp(search, 'i');
        query.$or = [{ name: searchRegex }, { number: searchRegex }];
    }
    if (size) { query.size = size; }
    if (underThreshold === 'true') {
        query.$expr = { $lte: ['$stockDetails.availableStock', '$restockThreshold'] };
    }
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;
    const totalTiles = await Tile.countDocuments(query);
    const tiles = await Tile.find(query).populate('createdBy', 'username').sort({ createdAt: -1 }).limit(limitNum).skip(skip);
    res.status(200).json({ tiles, page: pageNum, pages: Math.ceil(totalTiles / limitNum), total: totalTiles });
});

export const getTileById = asyncHandler(async (req, res) => {
  const tile = await Tile.findById(req.params.id);
  if (!tile) {
    res.status(404);
    throw new Error('Tile not found');
  }
  res.status(200).json(tile);
});

export const deleteTile = asyncHandler(async (req, res) => {
  const tile = await Tile.findById(req.params.id);
  if (!tile) {
      res.status(404);
      throw new Error('Tile not found');
  }
  tile.deleted = true;
  await tile.save();
  logger.info(`Tile "${tile.name}" archived successfully by ${req.user.username}`);
  res.status(200).json({ message: 'Tile archived successfully' });
});
