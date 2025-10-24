
// import Tile from '../models/tileModel.js';
// import asyncHandler from '../utils/asyncHandler.js';
// import { generateId } from '../services/idGenerator.js';
// import logger from '../config/logger.js';

// /**
//  * @desc    Create a new tile
//  * @route   POST /api/tiles
//  */
// export const createTile = asyncHandler(async (req, res) => {
//   const { name, number, surface, size, imageUrl, publicId, conversionFactor, restockThreshold, stockDetails } = req.body;

//   const tileId = await generateId('TL');

//   // --- THIS IS THE CORRECTED LOGIC FOR CREATING A TILE ---
//   // It directly uses the stockDetails object sent from the form.
//   const tile = await Tile.create({
//     tileId,
//     name,
//     number,
//     surface,
//     size,
//     imageUrl,
//     publicId,
//     conversionFactor,
//     restockThreshold,
//     stockDetails: {
//       availableStock: Number(stockDetails?.availableStock || 0),
//       bookedStock: Number(stockDetails?.bookedStock || 0),
//       restockingStock: Number(stockDetails?.restockingStock || 0),
//     },
//     createdBy: req.user._id,
//   });
//   // ---------------------------------------------------------

//   logger.info(`Tile "${tile.name}" created successfully by ${req.user.username}`);
//   res.status(201).json(tile);
// });

// /**
//  * @desc    Update a tile
//  * @route   PUT /api/tiles/:id
//  */
// export const updateTile = asyncHandler(async (req, res) => {
//   const { name, number, surface, size, imageUrl, publicId, conversionFactor, restockThreshold, stockDetails } = req.body;

//   const tile = await Tile.findById(req.params.id);
//   if (!tile) {
//     res.status(404);
//     throw new Error('Tile not found');
//   }

//   // --- THIS IS THE CORRECTED LOGIC FOR UPDATING A TILE ---
//   // It explicitly checks for the stockDetails object and updates each field.
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
//   // -------------------------------------------------------

//   const updatedTile = await tile.save();
//   logger.info(`Tile "${updatedTile.name}" updated successfully by ${req.user.username}`);
//   res.status(200).json(updatedTile);
// });


// // --- OTHER CONTROLLERS (Unchanged and Correct) ---
// export const getAllTiles = asyncHandler(async (req, res) => {
//   const tiles = await Tile.find({}).populate('createdBy', 'username').sort({ createdAt: -1 });
//   res.status(200).json(tiles);
// });

// export const getTileById = asyncHandler(async (req, res) => {
//   const tile = await Tile.findById(req.params.id);
//   if (!tile) {
//     res.status(404);
//     throw new Error('Tile not found');
//   }
//   res.status(200).json(tile);
// });

// /**
//  * @desc    Archive a tile (soft delete)
//  * @route   DELETE /api/tiles/:id
//  * @access  Private/Admin
//  */
// export const deleteTile = asyncHandler(async (req, res) => {
//   // --- THIS IS THE CORRECTED LOGIC ---
//   const tile = await Tile.findById(req.params.id);

//   if (!tile) {
//       res.status(404);
//       throw new Error('Tile not found');
//   }

//   // Set the deleted flag to true and save the document
//   tile.deleted = true;
//   await tile.save();
//   // ------------------------------------

//   logger.info(`Tile "${tile.name}" archived successfully by ${req.user.username}`);
//   res.status(200).json({ message: 'Tile archived successfully' });
// });

import Tile from '../models/tileModel.js';
import asyncHandler from '../utils/asyncHandler.js';
import { generateId } from '../services/idGenerator.js';
import logger from '../config/logger.js';

export const createTile = asyncHandler(async (req, res) => {
  const { name, number, surface, size, imageUrl, publicId, conversionFactor, restockThreshold, stockDetails } = req.body;
  const tileId = await generateId('TL');

  const tile = await Tile.create({
    tileId, name, number, surface, size, imageUrl, publicId, conversionFactor, restockThreshold,
    stockDetails: {
      availableStock: Number(stockDetails?.availableStock || 0),
      bookedStock: Number(stockDetails?.bookedStock || 0),
      restockingStock: Number(stockDetails?.restockingStock || 0),
    },
    createdBy: req.user._id,
  });

  logger.info(`Tile "${tile.name}" created by user ${req.user.username}`);
  res.status(201).json(tile);
});

export const updateTile = asyncHandler(async (req, res) => {
  const { name, number, surface, size, imageUrl, publicId, conversionFactor, restockThreshold, stockDetails } = req.body;
  const tile = await Tile.findById(req.params.id);
  if (!tile) {
    res.status(404);
    throw new Error('Tile not found');
  }

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
  logger.info(`Tile "${updatedTile.name}" updated by ${req.user.username}`);
  res.status(200).json(updatedTile);
});

export const getAllTiles = asyncHandler(async (req, res) => {
  const tiles = await Tile.find({}).populate('createdBy', 'username').sort({ createdAt: -1 });
  res.status(200).json(tiles);
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
  logger.info(`Tile "${tile.name}" archived by ${req.user.username}`);
  res.status(200).json({ message: 'Tile archived successfully' });
});
