import Tile from '../models/tileModel.js';
import asyncHandler from '../utils/asyncHandler.js';
import { generateId } from '../services/idGenerator.js';
import logger from '../config/logger.js';

// --- CREATE ---
// export const createTile = asyncHandler(async (req, res) => {
//   const { name, number, surface, size, imageUrl, publicId, conversionFactor, restockThreshold, stockDetails } = req.body;
//   if (number) {
//     const existingTileWithNumber = await Tile.findOne({ number });
//     if (existingTileWithNumber) {
//       res.status(400);
//       throw new Error(`A tile with number '${number}' already exists.`);
//     }
//   }
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
//   logger.info(`Tile "${tile.name}" created by ${req.user.username}`);
//   res.status(201).json(tile);
// });
export const createTile = asyncHandler(async (req, res) => {
  // Destructure all fields from the request body, including the new factory array
  const {
    name, number, surface, size, imageUrl, publicId, conversionFactor,
    restockThreshold, stockDetails, manufacturingFactories
  } = req.body;

  if (number) {
    const existingTileWithNumber = await Tile.findOne({ number });
    if (existingTileWithNumber) {
      res.status(400);
      throw new Error(`A tile with number '${number}' already exists.`);
    }
  }

  const tileId = await generateId('TL');

  const tile = await Tile.create({
    tileId, name, number, surface, size, imageUrl, publicId, conversionFactor, restockThreshold,
    stockDetails: {
      availableStock: Number(stockDetails?.availableStock || 0),
      bookedStock: Number(stockDetails?.bookedStock || 0),
      restockingStock: Number(stockDetails?.restockingStock || 0),
    },
    manufacturingFactories: manufacturingFactories || [], // <-- CORRECTLY HANDLE THE NEW FIELD
    createdBy: req.user._id,
  });

  res.status(201).json(tile);
});


// --- READ (ALL ACTIVE) ---
// export const getAllTiles = asyncHandler(async (req, res) => {
//     const { search, size, underThreshold, page = 1, limit = 50 } = req.query;
//     const query = {}; // The soft-delete middleware on the model handles the rest
//     if (search) {
//         const searchRegex = new RegExp(search, 'i');
//         query.$or = [{ name: searchRegex }, { number: searchRegex }];
//     }
//     if (size) { query.size = size; }
//     if (underThreshold === 'true') {
//         query.$expr = { $lte: ['$stockDetails.availableStock', '$restockThreshold'] };
//     }
//     const pageNum = Number(page);
//     const limitNum = Number(limit);
//     const skip = (pageNum - 1) * limitNum;
//     const totalTiles = await Tile.countDocuments(query);
//     const tiles = await Tile.find(query).populate('createdBy', 'username').sort({ createdAt: -1 }).limit(limitNum).skip(skip);
//     res.status(200).json({ tiles, page: pageNum, pages: Math.ceil(totalTiles / limitNum), total: totalTiles });
// });
export const getAllTiles = asyncHandler(async (req, res) => {
  const { search, size, underThreshold, page = 1, limit = 50 } = req.query;
  const query = {};
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
  
  // IMPORTANT: Populate the manufacturingFactories field
  const tiles = await Tile.find(query)
      .populate('createdBy', 'username')
      .populate('manufacturingFactories', 'name') // <-- POPULATE FACTORIES
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip(skip);

  res.status(200).json({ tiles, page: pageNum, pages: Math.ceil(totalTiles / limitNum), total: totalTiles });
});


export const getTilesForBooking = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const query = {};

  if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [{ name: searchRegex }, { number: searchRegex }];
  } else {
      // Return an empty array if there's no search term to avoid sending all tiles
      return res.status(200).json([]);
  }

  const tiles = await Tile.find(query)
      // Select only the fields absolutely necessary for the booking form
      .select('name number size conversionFactor stockDetails')
      .limit(10); // Limit the results for a fast search dropdown

  res.status(200).json(tiles);
});


// --- READ (ONE) ---
export const getTileById = asyncHandler(async (req, res) => {
  // The middleware on the model ensures we can't find a deleted tile
  const tile = await Tile.findById(req.params.id);
  if (!tile) {
    res.status(404);
    throw new Error('Tile not found');
  }
  res.status(200).json(tile);
});

// --- UPDATE ---
// export const updateTile = asyncHandler(async (req, res) => {
//   const { name, number, surface, size, imageUrl, publicId, conversionFactor, restockThreshold, stockDetails } = req.body;
//   const tile = await Tile.findById(req.params.id);
//   if (!tile) {
//     res.status(404);
//     throw new Error('Tile not found');
//   }
//   if (number) {
//     const existingTileWithNumber = await Tile.findOne({ number, _id: { $ne: req.params.id } });
//     if (existingTileWithNumber) {
//       res.status(400);
//       throw new Error(`Another tile with number '${number}' already exists.`);
//     }
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
export const updateTile = asyncHandler(async (req, res) => {
  // Destructure all fields, including the factory array
  const {
    name, number, surface, size, imageUrl, publicId, conversionFactor,
    restockThreshold, stockDetails, manufacturingFactories
  } = req.body;

  const tile = await Tile.findById(req.params.id);
  if (!tile) {
    res.status(404);
    throw new Error('Tile not found');
  }

  if (number) {
    const existingTileWithNumber = await Tile.findOne({ number, _id: { $ne: req.params.id } });
    if (existingTileWithNumber) {
      res.status(400);
      throw new Error(`Another tile with number '${number}' already exists.`);
    }
  }

  // Update all fields
  tile.name = name ?? tile.name;
  tile.number = number ?? tile.number;
  tile.surface = surface ?? tile.surface;
  tile.size = size ?? tile.size;
  tile.imageUrl = imageUrl ?? tile.imageUrl;
  tile.publicId = publicId ?? tile.publicId;
  tile.conversionFactor = conversionFactor ?? tile.conversionFactor;
  tile.restockThreshold = restockThreshold ?? tile.restockThreshold;
  
  // CORRECTLY UPDATE THE FACTORIES ARRAY
  // Use `??` to handle cases where the field might not be sent
  tile.manufacturingFactories = manufacturingFactories ?? tile.manufacturingFactories;

  if (stockDetails) {
    tile.stockDetails.availableStock = stockDetails.availableStock ?? tile.stockDetails.availableStock;
    tile.stockDetails.bookedStock = stockDetails.bookedStock ?? tile.stockDetails.bookedStock;
    tile.stockDetails.restockingStock = stockDetails.restockingStock ?? tile.stockDetails.restockingStock;
  }

  const updatedTile = await tile.save();
  res.status(200).json(updatedTile);
});


// --- SOFT DELETE ---
export const deleteTile = asyncHandler(async (req, res) => {
  const tile = await Tile.findById(req.params.id);
  if (!tile) {
      res.status(404);
      throw new Error('Tile not found');
  }
  tile.deleted = true;
  await tile.save();
  logger.info(`Tile "${tile.name}" archived by ${req.user.username}`);
  res.status(200).json({ message: 'Tile archived successfully' });
});


export const getUniqueTileSizes = asyncHandler(async (req, res) => {
  try {
    // Use the distinct() method to get an array of unique values for the 'size' field
    const sizes = await Tile.distinct('size');
    
    // Filter out any null or empty string values and sort them
    const sortedSizes = sizes.filter(size => size).sort();
    
    res.status(200).json(sortedSizes);
  } catch (error) {
    res.status(400);
    throw new Error('Could not fetch unique tile sizes.');
  }
});