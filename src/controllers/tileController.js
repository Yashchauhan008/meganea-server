// import Tile from '../models/tileModel.js';
// import asyncHandler from '../utils/asyncHandler.js';
// import { generateId } from '../services/idGenerator.js';
// import logger from '../config/logger.js';
// import mongoose from 'mongoose'; // <-- THIS IS THE FIX

// export const createTile = asyncHandler(async (req, res) => {
//   // Destructure all fields from the request body, including the new factory array
//   const {
//     name, number, surface, size, imageUrl, publicId, conversionFactor,
//     restockThreshold, stockDetails, manufacturingFactories
//   } = req.body;

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
//     manufacturingFactories: manufacturingFactories || [], // <-- CORRECTLY HANDLE THE NEW FIELD
//     createdBy: req.user._id,
//   });

//   res.status(201).json(tile);
// });


// export const getAllTiles = asyncHandler(async (req, res) => {
//   const { search, size, underThreshold, page = 1, limit = 50 } = req.query;
//   const query = {};
//   if (search) {
//       const searchRegex = new RegExp(search, 'i');
//       query.$or = [{ name: searchRegex }, { number: searchRegex }];
//   }
//   if (size) { query.size = size; }
//   if (underThreshold === 'true') {
//       query.$expr = { $lte: ['$stockDetails.availableStock', '$restockThreshold'] };
//   }
//   const pageNum = Number(page);
//   const limitNum = Number(limit);
//   const skip = (pageNum - 1) * limitNum;
//   const totalTiles = await Tile.countDocuments(query);
  
//   // IMPORTANT: Populate the manufacturingFactories field
//   const tiles = await Tile.find(query)
//       .populate('createdBy', 'username')
//       .populate('manufacturingFactories', 'name') // <-- POPULATE FACTORIES
//       .sort({ createdAt: -1 })
//       .limit(limitNum)
//       .skip(skip);

//   res.status(200).json({ tiles, page: pageNum, pages: Math.ceil(totalTiles / limitNum), total: totalTiles });
// });


// export const getTilesForBooking = asyncHandler(async (req, res) => {
//   const { search } = req.query;
//   const query = {};

//   if (search) {
//       const searchRegex = new RegExp(search, 'i');
//       query.$or = [{ name: searchRegex }, { number: searchRegex }];
//   } else {
//       // Return an empty array if there's no search term to avoid sending all tiles
//       return res.status(200).json([]);
//   }

//   const tiles = await Tile.find(query)
//       // Select only the fields absolutely necessary for the booking form
//       .select('name number size conversionFactor stockDetails')
//       .limit(10); // Limit the results for a fast search dropdown

//   res.status(200).json(tiles);
// });


// // --- READ (ONE) ---
// export const getTileById = asyncHandler(async (req, res) => {
//   // The middleware on the model ensures we can't find a deleted tile
//   const tile = await Tile.findById(req.params.id);
//   if (!tile) {
//     res.status(404);
//     throw new Error('Tile not found');
//   }
//   res.status(200).json(tile);
// });

// export const updateTile = asyncHandler(async (req, res) => {
//   // Destructure all fields, including the factory array
//   const {
//     name, number, surface, size, imageUrl, publicId, conversionFactor,
//     restockThreshold, stockDetails, manufacturingFactories
//   } = req.body;

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

//   // Update all fields
//   tile.name = name ?? tile.name;
//   tile.number = number ?? tile.number;
//   tile.surface = surface ?? tile.surface;
//   tile.size = size ?? tile.size;
//   tile.imageUrl = imageUrl ?? tile.imageUrl;
//   tile.publicId = publicId ?? tile.publicId;
//   tile.conversionFactor = conversionFactor ?? tile.conversionFactor;
//   tile.restockThreshold = restockThreshold ?? tile.restockThreshold;
  
//   // CORRECTLY UPDATE THE FACTORIES ARRAY
//   // Use `??` to handle cases where the field might not be sent
//   tile.manufacturingFactories = manufacturingFactories ?? tile.manufacturingFactories;

//   if (stockDetails) {
//     tile.stockDetails.availableStock = stockDetails.availableStock ?? tile.stockDetails.availableStock;
//     tile.stockDetails.bookedStock = stockDetails.bookedStock ?? tile.stockDetails.bookedStock;
//     tile.stockDetails.restockingStock = stockDetails.restockingStock ?? tile.stockDetails.restockingStock;
//   }

//   const updatedTile = await tile.save();
//   res.status(200).json(updatedTile);
// });


// // --- SOFT DELETE ---
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


// export const getUniqueTileSizes = asyncHandler(async (req, res) => {
//   try {
//     // Use the distinct() method to get an array of unique values for the 'size' field
//     const sizes = await Tile.distinct('size');
    
//     // Filter out any null or empty string values and sort them
//     const sortedSizes = sizes.filter(size => size).sort();
    
//     res.status(200).json(sortedSizes);
//   } catch (error) {
//     res.status(400);
//     throw new Error('Could not fetch unique tile sizes.');
//   }
// });


// // In src/controllers/tileController.js

// // ... (keep your other imports: mongoose, Tile, asyncHandler, etc.)

// export const bulkCreateTiles = asyncHandler(async (req, res) => {
//   const tilesData = req.body.tiles;

//   if (!tilesData || !Array.isArray(tilesData) || tilesData.length === 0) {
//     res.status(400).throw(new Error('No tile data provided.'));
//   }

//   // --- Validation (remains the same as the previous version) ---
//   const validationErrors = [];
//   const tilesToCreate = [];
//   const existingTiles = await Tile.find({ $or: [{ number: { $ne: null } }, { name: { $ne: null } }] }).select('name number');
//   const dbNumbers = new Set(existingTiles.map(t => t.number).filter(Boolean));
//   const dbNames = new Set(existingTiles.map(t => t.name));
//   const fileNumbers = new Set();
//   const fileNames = new Set();

//   for (let i = 0; i < tilesData.length; i++) {
//     const tile = tilesData[i];
//     const errors = [];
//     if (!tile.name) {
//       errors.push('Name is required.');
//     } else {
//       if (dbNames.has(tile.name) || fileNames.has(tile.name)) {
//         errors.push(`Name '${tile.name}' already exists.`);
//       }
//       fileNames.add(tile.name);
//     }
//     if (!tile.size) errors.push('Size is required.');
//     if (!tile.surface) errors.push('Surface is required.');
//     if (tile.number && tile.number.toString().trim() !== '') {
//       const tileNumber = tile.number.toString().trim();
//       if (dbNumbers.has(tileNumber) || fileNumbers.has(tileNumber)) {
//         errors.push(`Number '${tileNumber}' already exists.`);
//       }
//       fileNumbers.add(tileNumber);
//     }
//     if (errors.length > 0) {
//       validationErrors.push({ rowIndex: i, errors });
//     } else {
//       tilesToCreate.push({
//         name: tile.name,
//         number: (tile.number && tile.number.toString().trim() !== '') ? tile.number.toString().trim() : null,
//         surface: tile.surface,
//         size: tile.size,
//         conversionFactor: Number(tile.conversionFactor) || 1,
//         restockThreshold: Number(tile.restockThreshold) || 0,
//         imageUrl: tile.imageUrl || '',
//         stockDetails: { availableStock: Number(tile.initialStock) || 0, bookedStock: 0, restockingStock: 0 },
//         createdBy: req.user._id,
//       });
//     }
//   }

//   if (validationErrors.length > 0) {
//     return res.status(400).json({ message: 'Validation failed.', errors: validationErrors });
//   }
//   if (tilesToCreate.length === 0) {
//     return res.status(400).json({ message: "No valid tiles to import." });
//   }

//   // --- DATABASE TRANSACTION WITH CORRECTED ID GENERATION ---
//   const session = await mongoose.startSession();
//   session.startTransaction();
//   try {
//     // 1. Get the starting sequence number ONCE.
//     const lastTile = await Tile.findOne().sort({ createdAt: -1 });
//     let sequenceNumber = 1;
//     if (lastTile && lastTile.tileId) {
//       const lastNumber = parseInt(lastTile.tileId.split('-')[1], 10);
//       if (!isNaN(lastNumber)) {
//         sequenceNumber = lastNumber + 1;
//       }
//     }

//     // 2. Assign unique IDs by MANUALLY incrementing the sequence number in the loop.
//     for (const tile of tilesToCreate) {
//       tile.tileId = `TL-${String(sequenceNumber).padStart(5, '0')}`;
//       sequenceNumber++; // <-- THE CRITICAL FIX
//     }

//     // 3. Perform the bulk insert.
//     await Tile.insertMany(tilesToCreate, { session });

//     await session.commitTransaction();
//     res.status(201).json({
//       message: `Successfully imported ${tilesToCreate.length} tiles.`,
//     });
//   } catch (error) {
//     await session.abortTransaction();
//     console.error("Database Import Error:", error);
//     res.status(500).throw(new Error('An error occurred during the database import. No tiles were saved.'));
//   } finally {
//     session.endSession();
//   }
// });


// /**
//  * @desc    Get all tiles manufactured by a specific factory
//  * @route   GET /api/tiles/by-factory/:factoryId
//  * @access  Private
//  */
// export const getTilesByFactory = asyncHandler(async (req, res) => {
//   const { factoryId } = req.params;

//   if (!mongoose.Types.ObjectId.isValid(factoryId)) {
//     res.status(400);
//     throw new Error('Invalid Factory ID');
//   }

//   // Find all tiles where the manufacturingFactories array contains the given factoryId
//   const tiles = await Tile.find({ manufacturingFactories: factoryId })
//     .select('name size conversionFactor') // Select only the fields needed
//     .sort({ name: 1 });

//   res.status(200).json(tiles);
// });

// FILE LOCATION: backend/src/controllers/tileController.js

import Tile from '../models/tileModel.js';
import Pallet from '../models/palletModel.js';
import Container from '../models/containerModel.js';
import asyncHandler from '../utils/asyncHandler.js';
import { generateId } from '../services/idGenerator.js';
import logger from '../config/logger.js';
import mongoose from 'mongoose';

export const createTile = asyncHandler(async (req, res) => {
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
    manufacturingFactories: manufacturingFactories || [],
    createdBy: req.user._id,
  });

  res.status(201).json(tile);
});


export const getAllTiles = asyncHandler(async (req, res) => {
  const { search, size, surface, underThreshold, page = 1, limit = 50 } = req.query;
  const query = {};
  if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [{ name: searchRegex }, { number: searchRegex }];
  }
  if (size) { query.size = size; }
  if (surface) { query.surface = surface; }
  if (underThreshold === 'true') {
      query.$expr = { $lte: ['$stockDetails.availableStock', '$restockThreshold'] };
  }
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const skip = (pageNum - 1) * limitNum;
  const totalTiles = await Tile.countDocuments(query);
  
  const tiles = await Tile.find(query)
      .populate('createdBy', 'username')
      .populate('manufacturingFactories', 'name')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip(skip)
      .lean(); // Use lean() for better performance and to allow modification

  // Get all tile IDs from the current page
  const tileIds = tiles.map(t => t._id);

  // Calculate factory stock for all tiles (pallets with status InFactoryStock)
  const factoryStockAgg = await Pallet.aggregate([
    {
      $match: {
        tile: { $in: tileIds },
        status: 'InFactoryStock'
      }
    },
    {
      $group: {
        _id: '$tile',
        totalBoxes: { $sum: '$boxCount' }
      }
    }
  ]);

  // Create a map for quick lookup
  const factoryStockMap = {};
  factoryStockAgg.forEach(item => {
    factoryStockMap[item._id.toString()] = item.totalBoxes;
  });

  // Calculate transit stock (boxes in Dispatched or In Transit containers)
  const transitContainers = await Container.find({
    status: { $in: ['Dispatched', 'In Transit'] }
  }).populate({
    path: 'pallets',
    match: { tile: { $in: tileIds } },
    select: 'tile boxCount'
  });

  // Aggregate transit stock by tile
  const transitStockMap = {};
  transitContainers.forEach(container => {
    if (container.pallets && container.pallets.length > 0) {
      container.pallets.forEach(pallet => {
        if (pallet && pallet.tile) {
          const tileId = pallet.tile.toString();
          transitStockMap[tileId] = (transitStockMap[tileId] || 0) + (pallet.boxCount || 0);
        }
      });
    }
  });

  // Enhance tiles with calculated stock
  const enhancedTiles = tiles.map(tile => {
    const tileIdStr = tile._id.toString();
    return {
      ...tile,
      stockDetails: {
        ...tile.stockDetails,
        inFactoryStock: factoryStockMap[tileIdStr] || 0,
        transitStock: transitStockMap[tileIdStr] || 0
      }
    };
  });

  res.status(200).json({ tiles: enhancedTiles, page: pageNum, pages: Math.ceil(totalTiles / limitNum), total: totalTiles });
});


export const getTilesForBooking = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const query = {};

  if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [{ name: searchRegex }, { number: searchRegex }];
  } else {
      return res.status(200).json([]);
  }

  const tiles = await Tile.find(query)
      .select('name number size conversionFactor stockDetails')
      .limit(10);

  res.status(200).json(tiles);
});


export const getTileById = asyncHandler(async (req, res) => {
  const tile = await Tile.findById(req.params.id)
    .populate('manufacturingFactories', 'name')
    .populate('createdBy', 'username');
    
  if (!tile) {
    res.status(404);
    throw new Error('Tile not found');
  }
  res.status(200).json(tile);
});

export const updateTile = asyncHandler(async (req, res) => {
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

  tile.name = name ?? tile.name;
  tile.number = number ?? tile.number;
  tile.surface = surface ?? tile.surface;
  tile.size = size ?? tile.size;
  tile.imageUrl = imageUrl ?? tile.imageUrl;
  tile.publicId = publicId ?? tile.publicId;
  tile.conversionFactor = conversionFactor ?? tile.conversionFactor;
  tile.restockThreshold = restockThreshold ?? tile.restockThreshold;
  tile.manufacturingFactories = manufacturingFactories ?? tile.manufacturingFactories;

  if (stockDetails) {
    tile.stockDetails.availableStock = stockDetails.availableStock ?? tile.stockDetails.availableStock;
    tile.stockDetails.bookedStock = stockDetails.bookedStock ?? tile.stockDetails.bookedStock;
    tile.stockDetails.restockingStock = stockDetails.restockingStock ?? tile.stockDetails.restockingStock;
  }

  const updatedTile = await tile.save();
  res.status(200).json(updatedTile);
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


export const getUniqueTileSizes = asyncHandler(async (req, res) => {
  try {
    const sizes = await Tile.distinct('size');
    const sortedSizes = sizes.filter(size => size).sort();
    res.status(200).json(sortedSizes);
  } catch (error) {
    res.status(400);
    throw new Error('Could not fetch unique tile sizes.');
  }
});


export const bulkCreateTiles = asyncHandler(async (req, res) => {
  const tilesData = req.body.tiles;

  if (!tilesData || !Array.isArray(tilesData) || tilesData.length === 0) {
    res.status(400).throw(new Error('No tile data provided.'));
  }

  const validationErrors = [];
  const tilesToCreate = [];
  const existingTiles = await Tile.find({ $or: [{ number: { $ne: null } }, { name: { $ne: null } }] }).select('name number');
  const dbNumbers = new Set(existingTiles.map(t => t.number).filter(Boolean));
  const dbNames = new Set(existingTiles.map(t => t.name));
  const fileNumbers = new Set();
  const fileNames = new Set();

  for (let i = 0; i < tilesData.length; i++) {
    const tile = tilesData[i];
    const errors = [];
    if (!tile.name) {
      errors.push('Name is required.');
    } else {
      if (dbNames.has(tile.name) || fileNames.has(tile.name)) {
        errors.push(`Name '${tile.name}' already exists.`);
      }
      fileNames.add(tile.name);
    }
    if (!tile.size) errors.push('Size is required.');
    if (!tile.surface) errors.push('Surface is required.');
    if (tile.number && tile.number.toString().trim() !== '') {
      const tileNumber = tile.number.toString().trim();
      if (dbNumbers.has(tileNumber) || fileNumbers.has(tileNumber)) {
        errors.push(`Number '${tileNumber}' already exists.`);
      }
      fileNumbers.add(tileNumber);
    }
    if (errors.length > 0) {
      validationErrors.push({ rowIndex: i, errors });
    } else {
      tilesToCreate.push({
        name: tile.name,
        number: (tile.number && tile.number.toString().trim() !== '') ? tile.number.toString().trim() : null,
        surface: tile.surface,
        size: tile.size,
        conversionFactor: Number(tile.conversionFactor) || 1,
        restockThreshold: Number(tile.restockThreshold) || 0,
        imageUrl: tile.imageUrl || '',
        stockDetails: { availableStock: Number(tile.initialStock) || 0, bookedStock: 0, restockingStock: 0 },
        createdBy: req.user._id,
      });
    }
  }

  if (validationErrors.length > 0) {
    return res.status(400).json({ message: 'Validation failed.', errors: validationErrors });
  }
  if (tilesToCreate.length === 0) {
    return res.status(400).json({ message: "No valid tiles to import." });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const lastTile = await Tile.findOne().sort({ createdAt: -1 });
    let sequenceNumber = 1;
    if (lastTile && lastTile.tileId) {
      const lastNumber = parseInt(lastTile.tileId.split('-')[1], 10);
      if (!isNaN(lastNumber)) {
        sequenceNumber = lastNumber + 1;
      }
    }

    for (const tile of tilesToCreate) {
      tile.tileId = `TL-${String(sequenceNumber).padStart(5, '0')}`;
      sequenceNumber++;
    }

    await Tile.insertMany(tilesToCreate, { session });

    await session.commitTransaction();
    res.status(201).json({
      message: `Successfully imported ${tilesToCreate.length} tiles.`,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Database Import Error:", error);
    res.status(500).throw(new Error('An error occurred during the database import. No tiles were saved.'));
  } finally {
    session.endSession();
  }
});


export const getTilesByFactory = asyncHandler(async (req, res) => {
  const { factoryId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(factoryId)) {
    res.status(400);
    throw new Error('Invalid Factory ID');
  }

  const tiles = await Tile.find({ manufacturingFactories: factoryId })
    .select('name size conversionFactor')
    .sort({ name: 1 });

  res.status(200).json(tiles);
});


/**
 * @desc    Get detailed stock information for a tile including factory stock and transit stock
 * @route   GET /api/tiles/:id/stock-details
 * @access  Private
 */
/**
 * @desc    Get detailed stock information for a tile
 * @route   GET /api/tiles/:id/stock-details
 * @access  Private
 */
export const getTileStockDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get tile with populated factories
  const tile = await Tile.findById(id)
    .populate('manufacturingFactories', 'name address')
    .populate('createdBy', 'username');

  if (!tile) {
    res.status(404);
    throw new Error('Tile not found');
  }

  // Get factory stock - pallets/khatlis in factory stock for this tile
  const factoryStockAgg = await Pallet.aggregate([
    { 
      $match: { 
        tile: new mongoose.Types.ObjectId(id), 
        status: 'InFactoryStock' 
      } 
    },
    {
      $group: {
        _id: '$factory',
        pallets: { $sum: { $cond: [{ $eq: ['$type', 'Pallet'] }, 1, 0] } },
        khatlis: { $sum: { $cond: [{ $eq: ['$type', 'Khatli'] }, 1, 0] } },
        boxes: { $sum: '$boxCount' }
      }
    },
    {
      $lookup: {
        from: 'factories',
        localField: '_id',
        foreignField: '_id',
        as: 'factoryInfo'
      }
    },
    { $unwind: { path: '$factoryInfo', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        factoryId: '$_id',
        factoryName: { $ifNull: ['$factoryInfo.name', 'Unknown'] },
        pallets: 1,
        khatlis: 1,
        boxes: 1
      }
    },
    { $sort: { factoryName: 1 } }
  ]);

  // Calculate total factory stock
  const totalFactoryStock = factoryStockAgg.reduce((sum, f) => sum + f.boxes, 0);

  // Get transit stock - pallets loaded in containers that are dispatched/in transit
  const transitStockAgg = await Pallet.aggregate([
    {
      $match: {
        tile: new mongoose.Types.ObjectId(id),
        status: { $in: ['LoadedInContainer', 'Dispatched'] }
      }
    },
    {
      $group: {
        _id: null,
        pallets: { $sum: { $cond: [{ $eq: ['$type', 'Pallet'] }, 1, 0] } },
        khatlis: { $sum: { $cond: [{ $eq: ['$type', 'Khatli'] }, 1, 0] } },
        total: { $sum: '$boxCount' }
      }
    }
  ]);

  const transitStock = transitStockAgg[0] || { pallets: 0, khatlis: 0, total: 0 };

  // Get loaded stock (in containers but not yet dispatched)
  const loadedStockAgg = await Pallet.aggregate([
    {
      $match: {
        tile: new mongoose.Types.ObjectId(id),
        status: 'LoadedInContainer',
        container: { $ne: null }
      }
    },
    {
      $lookup: {
        from: 'containers',
        localField: 'container',
        foreignField: '_id',
        as: 'containerInfo'
      }
    },
    { $unwind: '$containerInfo' },
    {
      $match: {
        'containerInfo.status': { $nin: ['Dispatched', 'In Transit', 'Delivered'] }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$boxCount' }
      }
    }
  ]);

  const loadedStock = loadedStockAgg[0] || { total: 0 };

  res.status(200).json({
    tile,
    factoryStock: {
      total: totalFactoryStock,
      byFactory: factoryStockAgg
    },
    transitStock: {
      total: transitStock.total,
      pallets: transitStock.pallets,
      khatlis: transitStock.khatlis
    },
    loadedStock: {
      total: loadedStock.total
    }
  });
});
