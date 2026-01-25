// // FILE: backend/src/controllers/tileController.js
// // COMPLETE FILE - Replace entire file

// import Tile from '../models/tileModel.js';
// import Pallet from '../models/palletModel.js';
// import PurchaseOrder from '../models/purchaseOrderModel.js';
// import Booking from '../models/bookingModel.js';
// import RestockRequest from '../models/restockRequestModel.js';
// import asyncHandler from '../utils/asyncHandler.js';
// import { generateId } from '../services/idGenerator.js';
// import logger from '../config/logger.js';
// import mongoose from 'mongoose';

// // ===== CREATE TILE =====
// export const createTile = asyncHandler(async (req, res) => {
//     const {
//         name, number, surface, size, imageUrl, publicId, conversionFactor,
//         restockThreshold, stockDetails, manufacturingFactories
//     } = req.body;

//     if (number) {
//         const existingTileWithNumber = await Tile.findOne({ number });
//         if (existingTileWithNumber) {
//             res.status(400);
//             throw new Error(`A tile with number '${number}' already exists.`);
//         }
//     }

//     const tileId = await generateId('TL');

//     const tile = await Tile.create({
//         tileId, name, number, surface, size, imageUrl, publicId, conversionFactor, restockThreshold,
//         stockDetails: {
//             availableStock: Number(stockDetails?.availableStock || 0),
//             bookedStock: Number(stockDetails?.bookedStock || 0),
//             restockingStock: Number(stockDetails?.restockingStock || 0),
//         },
//         manufacturingFactories: manufacturingFactories || [],
//         createdBy: req.user._id,
//     });

//     res.status(201).json(tile);
// });

// // ===== GET ALL TILES =====
// export const getAllTiles = asyncHandler(async (req, res) => {
//     const { search, size, underThreshold, page = 1, limit = 50 } = req.query;
//     const query = { deleted: { $ne: true } };
    
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
    
//     const tiles = await Tile.find(query)
//         .populate('createdBy', 'username')
//         .populate('manufacturingFactories', 'name')
//         .sort({ createdAt: -1 })
//         .limit(limitNum)
//         .skip(skip);

//     res.status(200).json({ 
//         tiles, 
//         page: pageNum, 
//         pages: Math.ceil(totalTiles / limitNum), 
//         total: totalTiles 
//     });
// });

// // ===== GET TILES FOR BOOKING =====
// export const getTilesForBooking = asyncHandler(async (req, res) => {
//     const { search } = req.query;
//     const query = { deleted: { $ne: true } };

//     if (search) {
//         const searchRegex = new RegExp(search, 'i');
//         query.$or = [{ name: searchRegex }, { number: searchRegex }];
//     } else {
//         return res.status(200).json([]);
//     }

//     const tiles = await Tile.find(query)
//         .select('name number size conversionFactor stockDetails')
//         .limit(10);

//     res.status(200).json(tiles);
// });

// // ===== GET TILE BY ID =====
// export const getTileById = asyncHandler(async (req, res) => {
//     const tile = await Tile.findOne({ _id: req.params.id, deleted: { $ne: true } })
//         .populate('manufacturingFactories', 'name')
//         .populate('createdBy', 'username');
    
//     if (!tile) {
//         res.status(404);
//         throw new Error('Tile not found');
//     }
//     res.status(200).json(tile);
// });

// // ===== UPDATE TILE =====
// export const updateTile = asyncHandler(async (req, res) => {
//     const {
//         name, number, surface, size, imageUrl, publicId, conversionFactor,
//         restockThreshold, stockDetails, manufacturingFactories
//     } = req.body;

//     const tile = await Tile.findOne({ _id: req.params.id, deleted: { $ne: true } });
//     if (!tile) {
//         res.status(404);
//         throw new Error('Tile not found');
//     }

//     if (number) {
//         const existingTileWithNumber = await Tile.findOne({ 
//             number, 
//             _id: { $ne: req.params.id },
//             deleted: { $ne: true }
//         });
//         if (existingTileWithNumber) {
//             res.status(400);
//             throw new Error(`Another tile with number '${number}' already exists.`);
//         }
//     }

//     tile.name = name ?? tile.name;
//     tile.number = number ?? tile.number;
//     tile.surface = surface ?? tile.surface;
//     tile.size = size ?? tile.size;
//     tile.imageUrl = imageUrl ?? tile.imageUrl;
//     tile.publicId = publicId ?? tile.publicId;
//     tile.conversionFactor = conversionFactor ?? tile.conversionFactor;
//     tile.restockThreshold = restockThreshold ?? tile.restockThreshold;
//     tile.manufacturingFactories = manufacturingFactories ?? tile.manufacturingFactories;

//     if (stockDetails) {
//         tile.stockDetails.availableStock = stockDetails.availableStock ?? tile.stockDetails.availableStock;
//         tile.stockDetails.bookedStock = stockDetails.bookedStock ?? tile.stockDetails.bookedStock;
//         tile.stockDetails.restockingStock = stockDetails.restockingStock ?? tile.stockDetails.restockingStock;
//     }

//     const updatedTile = await tile.save();
//     res.status(200).json(updatedTile);
// });

// // ===== DELETE TILE (Enhanced with validation) =====
// export const deleteTile = asyncHandler(async (req, res) => {
//     const { id } = req.params;
//     const { force } = req.body;

//     const tile = await Tile.findOne({ _id: id, deleted: { $ne: true } });
//     if (!tile) {
//         res.status(404);
//         throw new Error('Tile not found');
//     }

//     // 1. CHECK FOR EXISTING PALLETS/KHATLIS
//     const palletCount = await Pallet.countDocuments({ tile: id });

//     // 2. CHECK FOR PENDING/ACTIVE POs
//     const poCount = await PurchaseOrder.countDocuments({
//         'items.tile': id,
//         status: { $nin: ['Completed', 'Cancelled'] },
//         deleted: { $ne: true }
//     });

//     // 3. CHECK FOR ACTIVE BOOKINGS
//     const bookingCount = await Booking.countDocuments({
//         'tilesList.tile': id,
//         status: { $nin: ['Completed', 'Cancelled'] }
//     });

//     // 4. CHECK FOR PENDING RESTOCK REQUESTS
//     const restockCount = await RestockRequest.countDocuments({
//         'requestedItems.tile': id,
//         status: { $nin: ['Completed', 'Cancelled', 'Completed with Discrepancy'] }
//     });

//     // Build error message if related data exists
//     const relatedDataMessages = [];
//     if (palletCount > 0) {
//         relatedDataMessages.push(`${palletCount} pallets/khatlis exist`);
//     }
//     if (poCount > 0) {
//         relatedDataMessages.push(`${poCount} active purchase orders`);
//     }
//     if (bookingCount > 0) {
//         relatedDataMessages.push(`${bookingCount} active bookings`);
//     }
//     if (restockCount > 0) {
//         relatedDataMessages.push(`${restockCount} pending restock requests`);
//     }

//     // If related data exists and not force delete
//     if (relatedDataMessages.length > 0 && !force) {
//         res.status(400);
//         throw new Error(
//             `Cannot delete tile "${tile.name}". Related data exists: ${relatedDataMessages.join(', ')}. ` +
//             `Please complete or cancel related items first.`
//         );
//     }

//     // SOFT DELETE THE TILE
//     tile.deleted = true;
//     tile.deletedAt = new Date();
//     tile.deletedBy = req.user._id;
//     await tile.save();

//     logger.info(`Tile "${tile.name}" archived by ${req.user.username}${force ? ' (force)' : ''}`);

//     res.status(200).json({
//         message: 'Tile archived successfully',
//         tileName: tile.name,
//         tileNumber: tile.tileNumber || tile.number,
//         warning: relatedDataMessages.length > 0 
//             ? `Force deleted with: ${relatedDataMessages.join(', ')}` 
//             : null
//     });
// });

// // ===== GET UNIQUE TILE SIZES =====
// export const getUniqueTileSizes = asyncHandler(async (req, res) => {
//     const sizes = await Tile.distinct('size', { deleted: { $ne: true } });
//     const sortedSizes = sizes.filter(size => size).sort();
//     res.status(200).json(sortedSizes);
// });

// // ===== BULK CREATE TILES =====
// export const bulkCreateTiles = asyncHandler(async (req, res) => {
//     const tilesData = req.body.tiles;

//     if (!tilesData || !Array.isArray(tilesData) || tilesData.length === 0) {
//         res.status(400);
//         throw new Error('No tile data provided.');
//     }

//     const validationErrors = [];
//     const tilesToCreate = [];
//     const existingTiles = await Tile.find({ 
//         $or: [{ number: { $ne: null } }, { name: { $ne: null } }],
//         deleted: { $ne: true }
//     }).select('name number');
    
//     const dbNumbers = new Set(existingTiles.map(t => t.number).filter(Boolean));
//     const dbNames = new Set(existingTiles.map(t => t.name));
//     const fileNumbers = new Set();
//     const fileNames = new Set();

//     for (let i = 0; i < tilesData.length; i++) {
//         const tile = tilesData[i];
//         const errors = [];
        
//         if (!tile.name) {
//             errors.push('Name is required.');
//         } else {
//             if (dbNames.has(tile.name) || fileNames.has(tile.name)) {
//                 errors.push(`Name '${tile.name}' already exists.`);
//             }
//             fileNames.add(tile.name);
//         }
        
//         if (!tile.size) errors.push('Size is required.');
//         if (!tile.surface) errors.push('Surface is required.');
        
//         if (tile.number && tile.number.toString().trim() !== '') {
//             const tileNumber = tile.number.toString().trim();
//             if (dbNumbers.has(tileNumber) || fileNumbers.has(tileNumber)) {
//                 errors.push(`Number '${tileNumber}' already exists.`);
//             }
//             fileNumbers.add(tileNumber);
//         }
        
//         if (errors.length > 0) {
//             validationErrors.push({ rowIndex: i, errors });
//         } else {
//             tilesToCreate.push({
//                 name: tile.name,
//                 number: (tile.number && tile.number.toString().trim() !== '') ? tile.number.toString().trim() : null,
//                 surface: tile.surface,
//                 size: tile.size,
//                 conversionFactor: Number(tile.conversionFactor) || 1,
//                 restockThreshold: Number(tile.restockThreshold) || 0,
//                 imageUrl: tile.imageUrl || '',
//                 stockDetails: { 
//                     availableStock: Number(tile.initialStock) || 0, 
//                     bookedStock: 0, 
//                     restockingStock: 0 
//                 },
//                 createdBy: req.user._id,
//             });
//         }
//     }

//     if (validationErrors.length > 0) {
//         return res.status(400).json({ message: 'Validation failed.', errors: validationErrors });
//     }
//     if (tilesToCreate.length === 0) {
//         return res.status(400).json({ message: "No valid tiles to import." });
//     }

//     const session = await mongoose.startSession();
//     session.startTransaction();
//     try {
//         const lastTile = await Tile.findOne().sort({ createdAt: -1 });
//         let sequenceNumber = 1;
//         if (lastTile && lastTile.tileId) {
//             const lastNumber = parseInt(lastTile.tileId.split('-')[1], 10);
//             if (!isNaN(lastNumber)) {
//                 sequenceNumber = lastNumber + 1;
//             }
//         }

//         for (const tile of tilesToCreate) {
//             tile.tileId = `TL-${String(sequenceNumber).padStart(5, '0')}`;
//             sequenceNumber++;
//         }

//         await Tile.insertMany(tilesToCreate, { session });
//         await session.commitTransaction();
        
//         res.status(201).json({
//             message: `Successfully imported ${tilesToCreate.length} tiles.`,
//         });
//     } catch (error) {
//         await session.abortTransaction();
//         console.error("Database Import Error:", error);
//         res.status(500);
//         throw new Error('An error occurred during the database import. No tiles were saved.');
//     } finally {
//         session.endSession();
//     }
// });

// // ===== GET TILES BY FACTORY =====
// export const getTilesByFactory = asyncHandler(async (req, res) => {
//     const { factoryId } = req.params;

//     if (!mongoose.Types.ObjectId.isValid(factoryId)) {
//         res.status(400);
//         throw new Error('Invalid Factory ID');
//     }

//     const tiles = await Tile.find({ 
//         manufacturingFactories: factoryId,
//         deleted: { $ne: true }
//     })
//     .select('name size conversionFactor')
//     .sort({ name: 1 });

//     res.status(200).json(tiles);
// });

// // ===== GET TILE STOCK DETAILS =====
// export const getTileStockDetails = asyncHandler(async (req, res) => {
//     const { id } = req.params;

//     const tile = await Tile.findOne({ _id: id, deleted: { $ne: true } })
//         .populate('manufacturingFactories', 'name address')
//         .populate('createdBy', 'username');

//     if (!tile) {
//         res.status(404);
//         throw new Error('Tile not found');
//     }

//     // Get factory stock
//     const factoryStockAgg = await Pallet.aggregate([
//         { 
//             $match: { 
//                 tile: new mongoose.Types.ObjectId(id), 
//                 status: 'InFactoryStock' 
//             } 
//         },
//         {
//             $group: {
//                 _id: '$factory',
//                 pallets: { $sum: { $cond: [{ $eq: ['$type', 'Pallet'] }, 1, 0] } },
//                 khatlis: { $sum: { $cond: [{ $eq: ['$type', 'Khatli'] }, 1, 0] } },
//                 boxes: { $sum: '$boxCount' }
//             }
//         },
//         {
//             $lookup: {
//                 from: 'factories',
//                 localField: '_id',
//                 foreignField: '_id',
//                 as: 'factoryInfo'
//             }
//         },
//         { $unwind: { path: '$factoryInfo', preserveNullAndEmptyArrays: true } },
//         {
//             $project: {
//                 _id: 0,
//                 factoryId: '$_id',
//                 factoryName: { $ifNull: ['$factoryInfo.name', 'Unknown'] },
//                 pallets: 1,
//                 khatlis: 1,
//                 boxes: 1
//             }
//         },
//         { $sort: { factoryName: 1 } }
//     ]);

//     const totalFactoryStock = factoryStockAgg.reduce((sum, f) => sum + f.boxes, 0);

//     // Get transit stock
//     const transitStockAgg = await Pallet.aggregate([
//         {
//             $match: {
//                 tile: new mongoose.Types.ObjectId(id),
//                 status: { $in: ['LoadedInContainer', 'Dispatched'] }
//             }
//         },
//         {
//             $group: {
//                 _id: null,
//                 pallets: { $sum: { $cond: [{ $eq: ['$type', 'Pallet'] }, 1, 0] } },
//                 khatlis: { $sum: { $cond: [{ $eq: ['$type', 'Khatli'] }, 1, 0] } },
//                 total: { $sum: '$boxCount' }
//             }
//         }
//     ]);

//     const transitStock = transitStockAgg[0] || { pallets: 0, khatlis: 0, total: 0 };

//     // Get loaded stock
//     const loadedStockAgg = await Pallet.aggregate([
//         {
//             $match: {
//                 tile: new mongoose.Types.ObjectId(id),
//                 status: 'LoadedInContainer'
//             }
//         },
//         {
//             $group: {
//                 _id: null,
//                 total: { $sum: '$boxCount' }
//             }
//         }
//     ]);

//     const loadedStock = loadedStockAgg[0] || { total: 0 };

//     res.status(200).json({
//         tile,
//         factoryStock: {
//             total: totalFactoryStock,
//             byFactory: factoryStockAgg
//         },
//         transitStock: {
//             total: transitStock.total,
//             pallets: transitStock.pallets,
//             khatlis: transitStock.khatlis
//         },
//         loadedStock: {
//             total: loadedStock.total
//         }
//     });
// });

// // ===== GET DELETED TILES (Admin) =====
// export const getDeletedTiles = asyncHandler(async (req, res) => {
//     const deletedTiles = await Tile.find({ deleted: true })
//         .select('+deleted +deletedAt +deletedBy')
//         .populate('deletedBy', 'username')
//         .sort({ deletedAt: -1 });

//     res.status(200).json(deletedTiles);
// });

// // ===== RESTORE TILE (Admin) =====
// export const restoreTile = asyncHandler(async (req, res) => {
//     const { id } = req.params;

//     const tile = await Tile.findOne({ _id: id }).select('+deleted +deletedAt');
    
//     if (!tile) {
//         res.status(404);
//         throw new Error('Tile not found');
//     }

//     if (!tile.deleted) {
//         res.status(400);
//         throw new Error('Tile is not deleted');
//     }

//     tile.deleted = false;
//     tile.deletedAt = undefined;
//     tile.deletedBy = undefined;
//     await tile.save();

//     logger.info(`Tile "${tile.name}" restored by ${req.user.username}`);

//     res.status(200).json({
//         message: 'Tile restored successfully',
//         tile
//     });
// });



// FILE: backend/src/controllers/tileController.js
// COMPLETE FIXED VERSION - Replace entire file

import Tile from '../models/tileModel.js';
import Pallet from '../models/palletModel.js';
import PurchaseOrder from '../models/purchaseOrderModel.js';
import Booking from '../models/bookingModel.js';
import RestockRequest from '../models/restockRequestModel.js';
import asyncHandler from '../utils/asyncHandler.js';
import { generateId } from '../services/idGenerator.js';
import logger from '../config/logger.js';
import mongoose from 'mongoose';

// ===== CREATE TILE =====
export const createTile = asyncHandler(async (req, res) => {
    const {
        name, number, surface, size, imageUrl, publicId, conversionFactor,
        restockThreshold, stockDetails, manufacturingFactories
    } = req.body;

    // Check for ACTIVE tiles with same number (ignoring soft-deleted)
    if (number) {
        const existingTileWithNumber = await Tile.findOne({ 
            number, 
            deleted: { $ne: true } 
        });
        if (existingTileWithNumber) {
            res.status(400);
            throw new Error(`A tile with number '${number}' already exists.`);
        }
    }

    // Check for ACTIVE tiles with same name (ignoring soft-deleted)
    const existingTileWithName = await Tile.findOne({ 
        name, 
        deleted: { $ne: true } 
    });
    if (existingTileWithName) {
        res.status(400);
        throw new Error(`A tile with name '${name}' already exists.`);
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

// ===== GET ALL TILES =====
export const getAllTiles = asyncHandler(async (req, res) => {
    const { 
        search, 
        size, 
        surface,
        underThreshold, 
        showDeleted,
        page = 1, 
        limit = 50 
    } = req.query;
    
    const query = {};
    
    // Handle deleted filter - IMPORTANT: Must set deleted property in query
    // to bypass the pre-find middleware
    if (showDeleted === 'true') {
        // Show only deleted tiles (admin only)
        query.deleted = true;
    } else {
        // Show only active tiles (default) - explicitly set to bypass middleware
        query.deleted = { $ne: true };
    }
    
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
    
    let tilesQuery = Tile.find(query)
        .populate('createdBy', 'username')
        .populate('manufacturingFactories', 'name')
        .sort({ createdAt: -1 })
        .limit(limitNum)
        .skip(skip);

    // If showing deleted tiles, also populate deletedBy and select hidden fields
    if (showDeleted === 'true') {
        tilesQuery = tilesQuery
            .select('+deleted +deletedAt +deletedBy')
            .populate('deletedBy', 'username');
    }

    const tiles = await tilesQuery;

    res.status(200).json({ 
        tiles, 
        page: pageNum, 
        pages: Math.ceil(totalTiles / limitNum), 
        total: totalTiles 
    });
});

// ===== GET TILES FOR BOOKING =====
export const getTilesForBooking = asyncHandler(async (req, res) => {
    const { search } = req.query;
    const query = { deleted: { $ne: true } };

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

// ===== GET TILE BY ID =====
export const getTileById = asyncHandler(async (req, res) => {
    const tile = await Tile.findOne({ _id: req.params.id, deleted: { $ne: true } })
        .populate('manufacturingFactories', 'name')
        .populate('createdBy', 'username');
    
    if (!tile) {
        res.status(404);
        throw new Error('Tile not found');
    }
    res.status(200).json(tile);
});

// ===== UPDATE TILE =====
export const updateTile = asyncHandler(async (req, res) => {
    const {
        name, number, surface, size, imageUrl, publicId, conversionFactor,
        restockThreshold, stockDetails, manufacturingFactories
    } = req.body;

    const tile = await Tile.findOne({ _id: req.params.id, deleted: { $ne: true } });
    if (!tile) {
        res.status(404);
        throw new Error('Tile not found');
    }

    // Check for duplicate number in ACTIVE tiles (excluding current tile and soft-deleted)
    if (number) {
        const existingTileWithNumber = await Tile.findOne({ 
            number, 
            _id: { $ne: req.params.id },
            deleted: { $ne: true }
        });
        if (existingTileWithNumber) {
            res.status(400);
            throw new Error(`Another tile with number '${number}' already exists.`);
        }
    }

    // Check for duplicate name in ACTIVE tiles (excluding current tile and soft-deleted)
    if (name && name !== tile.name) {
        const existingTileWithName = await Tile.findOne({ 
            name, 
            _id: { $ne: req.params.id },
            deleted: { $ne: true }
        });
        if (existingTileWithName) {
            res.status(400);
            throw new Error(`Another tile with name '${name}' already exists.`);
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

// ===== DELETE TILE (Soft Delete) =====
export const deleteTile = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { force } = req.body;

    const tile = await Tile.findOne({ _id: id, deleted: { $ne: true } });
    if (!tile) {
        res.status(404);
        throw new Error('Tile not found');
    }

    // Check for related data
    const palletCount = await Pallet.countDocuments({ tile: id });
    const poCount = await PurchaseOrder.countDocuments({
        'items.tile': id,
        status: { $nin: ['Completed', 'Cancelled'] },
        deleted: { $ne: true }
    });
    const bookingCount = await Booking.countDocuments({
        'tilesList.tile': id,
        status: { $nin: ['Completed', 'Cancelled'] }
    });
    const restockCount = await RestockRequest.countDocuments({
        'requestedItems.tile': id,
        status: { $nin: ['Completed', 'Cancelled', 'Completed with Discrepancy'] }
    });

    const relatedDataMessages = [];
    if (palletCount > 0) relatedDataMessages.push(`${palletCount} pallets/khatlis exist`);
    if (poCount > 0) relatedDataMessages.push(`${poCount} active purchase orders`);
    if (bookingCount > 0) relatedDataMessages.push(`${bookingCount} active bookings`);
    if (restockCount > 0) relatedDataMessages.push(`${restockCount} pending restock requests`);

    if (relatedDataMessages.length > 0 && !force) {
        res.status(400);
        throw new Error(
            `Cannot delete tile "${tile.name}". Related data exists: ${relatedDataMessages.join(', ')}. ` +
            `Please complete or cancel related items first.`
        );
    }

    // SOFT DELETE
    tile.deleted = true;
    tile.deletedAt = new Date();
    tile.deletedBy = req.user._id;
    await tile.save();

    logger.info(`Tile "${tile.name}" archived by ${req.user.username}${force ? ' (force)' : ''}`);

    res.status(200).json({
        message: 'Tile archived successfully',
        tileName: tile.name,
        tileNumber: tile.number,
        warning: relatedDataMessages.length > 0 
            ? `Force deleted with: ${relatedDataMessages.join(', ')}` 
            : null
    });
});

// ===== HARD DELETE TILE (Admin Only) =====
export const hardDeleteTile = asyncHandler(async (req, res) => {
    const { id } = req.params;

    logger.info(`Hard delete request for tile ID: ${id} by user: ${req.user.username}`);

    // Find tile with explicit deleted: true to bypass middleware
    const tile = await Tile.findOne({ _id: id, deleted: true })
        .select('+deleted +deletedAt +deletedBy');
    
    if (!tile) {
        logger.warn(`Hard delete failed: Tile ${id} not found or not soft-deleted`);
        res.status(404);
        throw new Error('Tile not found or not deleted. Only soft-deleted tiles can be permanently deleted.');
    }

    logger.info(`Found soft-deleted tile: ${tile.name} (${tile.number || 'no number'})`);

    // Check for any remaining related data
    const palletCount = await Pallet.countDocuments({ tile: id });
    const poCount = await PurchaseOrder.countDocuments({ 'items.tile': id });
    const bookingCount = await Booking.countDocuments({ 'tilesList.tile': id });
    const restockCount = await RestockRequest.countDocuments({ 'requestedItems.tile': id });

    if (palletCount > 0 || poCount > 0 || bookingCount > 0 || restockCount > 0) {
        logger.warn(`Hard delete blocked: Tile ${tile.name} has related data`);
        res.status(400);
        throw new Error(
            `Cannot permanently delete tile. Related data still exists: ` +
            `${palletCount} pallets, ${poCount} POs, ${bookingCount} bookings, ${restockCount} restock requests. ` +
            `Please remove all related data first.`
        );
    }

    const tileName = tile.name;
    const tileNumber = tile.number;
    
    // PERMANENT DELETE
    await Tile.deleteOne({ _id: id });

    logger.info(`Tile "${tileName}" (${tileNumber || 'no number'}) permanently deleted by ${req.user.username}`);

    res.status(200).json({
        message: 'Tile permanently deleted',
        tileName,
        tileNumber
    });
});

// ===== GET UNIQUE TILE SIZES =====
export const getUniqueTileSizes = asyncHandler(async (req, res) => {
    const sizes = await Tile.distinct('size', { deleted: { $ne: true } });
    const sortedSizes = sizes.filter(size => size).sort();
    res.status(200).json(sortedSizes);
});

// ===== BULK CREATE TILES =====
export const bulkCreateTiles = asyncHandler(async (req, res) => {
    const tilesData = req.body.tiles;

    if (!tilesData || !Array.isArray(tilesData) || tilesData.length === 0) {
        res.status(400);
        throw new Error('No tile data provided.');
    }

    const validationErrors = [];
    const tilesToCreate = [];
    const conflicts = [];
    const warnings = [];
    const newFactoriesCreated = [];
    
    // Get ACTIVE tiles (bypass middleware by setting deleted explicitly)
    const existingTiles = await Tile.find({ deleted: { $ne: true } })
        .select('name number');
    
    // Get SOFT-DELETED tiles (bypass middleware by setting deleted: true)
    const softDeletedTiles = await Tile.find({ deleted: true })
        .select('name number _id +deleted');
    
    // Get all factories for name lookup
    const Factory = mongoose.model('Factory');
    const allFactories = await Factory.find({ deleted: { $ne: true } })
        .select('name _id');
    
    // Create factory name map (case-insensitive)
    const factoryMap = new Map();
    allFactories.forEach(factory => {
        factoryMap.set(factory.name.toLowerCase().trim(), factory._id);
    });
    
    const dbNumbers = new Set(existingTiles.map(t => t.number).filter(Boolean));
    const dbNames = new Set(existingTiles.map(t => t.name));
    
    // Maps for soft-deleted tiles
    const softDeletedByName = new Map();
    const softDeletedByNumber = new Map();
    softDeletedTiles.forEach(tile => {
        if (tile.name) softDeletedByName.set(tile.name, tile._id);
        if (tile.number) softDeletedByNumber.set(tile.number, tile._id);
    });
    
    const fileNumbers = new Set();
    const fileNames = new Set();
    
    // Track new factories to create
    const factoriesToCreate = new Map(); // name -> factory object

    // Validate each tile
    for (let i = 0; i < tilesData.length; i++) {
        const tile = tilesData[i];
        const errors = [];
        const rowConflicts = {};
        const rowWarnings = [];
        
        // Validate name
        if (!tile.name || String(tile.name).trim() === '') {
            errors.push('Name is required.');
        } else {
            const tileName = String(tile.name).trim();
            
            if (dbNames.has(tileName) || fileNames.has(tileName)) {
                errors.push(`Name '${tileName}' already exists in active tiles.`);
            } else if (softDeletedByName.has(tileName)) {
                rowConflicts.nameConflict = {
                    field: 'name',
                    value: tileName,
                    deletedTileId: softDeletedByName.get(tileName)
                };
            }
            fileNames.add(tileName);
        }
        
        // Validate size
        if (!tile.size || String(tile.size).trim() === '') {
            errors.push('Size is required.');
        }
        
        // Validate surface
        if (!tile.surface || String(tile.surface).trim() === '') {
            errors.push('Surface is required.');
        } else {
            const surface = String(tile.surface).trim();
            if (surface !== 'Glossy' && surface !== 'Matt' && surface !== 'matt') {
                errors.push('Surface must be either "Glossy" or "Matt".');
            }
        }
        
        // Validate conversionFactor
        if (!tile.conversionFactor || isNaN(Number(tile.conversionFactor)) || Number(tile.conversionFactor) <= 0) {
            errors.push('Conversion factor must be a positive number.');
        }
        
        // Validate number if provided
        if (tile.number && String(tile.number).trim() !== '') {
            const tileNumber = String(tile.number).trim();
            
            if (dbNumbers.has(tileNumber) || fileNumbers.has(tileNumber)) {
                errors.push(`Number '${tileNumber}' already exists in active tiles.`);
            } else if (softDeletedByNumber.has(tileNumber)) {
                rowConflicts.numberConflict = {
                    field: 'number',
                    value: tileNumber,
                    deletedTileId: softDeletedByNumber.get(tileNumber)
                };
            }
            fileNumbers.add(tileNumber);
        }
        
        // Process manufacturing factories
        let factoryIds = [];
        if (tile.manufacturingFactories && String(tile.manufacturingFactories).trim() !== '') {
            const factoryNamesStr = String(tile.manufacturingFactories).trim();
            const factoryNames = factoryNamesStr.split(',').map(name => name.trim()).filter(name => name);
            const createNew = tile.createNewFactories === true || 
                             String(tile.createNewFactories).toLowerCase() === 'true' ||
                             tile.createNewFactories === 'TRUE';
            
            for (const factoryName of factoryNames) {
                const factoryKey = factoryName.toLowerCase().trim();
                
                // Check if factory exists
                if (factoryMap.has(factoryKey)) {
                    factoryIds.push(factoryMap.get(factoryKey));
                }
                // Check if we're already planning to create this factory
                else if (factoriesToCreate.has(factoryKey)) {
                    // Will be created, add placeholder
                    factoryIds.push(factoryKey); // Temporary, will be replaced with real ID
                }
                // Factory doesn't exist
                else {
                    if (createNew) {
                        // Mark for creation
                        factoriesToCreate.set(factoryKey, {
                            name: factoryName,
                            address: 'To be updated',
                            contactPerson: 'To be updated',
                            contactNumber: 'To be updated',
                            status: 'pending_details',
                            createdBy: req.user._id
                        });
                        factoryIds.push(factoryKey); // Temporary
                        rowWarnings.push(`Will create new factory: "${factoryName}"`);
                    } else {
                        errors.push(`Factory "${factoryName}" not found. Set createNewFactories to TRUE to auto-create.`);
                    }
                }
            }
        }
        
        // Track conflicts
        if (Object.keys(rowConflicts).length > 0) {
            conflicts.push({
                rowIndex: i,
                tileName: tile.name,
                conflicts: rowConflicts
            });
        }
        
        // Track warnings
        if (rowWarnings.length > 0) {
            warnings.push({
                rowIndex: i,
                tileName: tile.name,
                warnings: rowWarnings
            });
        }
        
        // Track errors
        if (errors.length > 0) {
            validationErrors.push({ rowIndex: i, errors });
        } else if (Object.keys(rowConflicts).length === 0) {
            // Only add if no errors and no conflicts
            const surface = String(tile.surface).trim();
            tilesToCreate.push({
                name: String(tile.name).trim(),
                number: (tile.number && String(tile.number).trim() !== '') ? String(tile.number).trim() : undefined,
                surface: surface === 'matt' ? 'Matt' : surface,
                size: String(tile.size).trim(),
                conversionFactor: Number(tile.conversionFactor),
                restockThreshold: Number(tile.restockThreshold) || 0,
                imageUrl: tile.imageUrl ? String(tile.imageUrl).trim() : '',
                stockDetails: { 
                    availableStock: Number(tile.initialStock) || 0, 
                    bookedStock: 0, 
                    restockingStock: 0 
                },
                manufacturingFactories: factoryIds, // Includes both real IDs and temp keys
                createdBy: req.user._id,
            });
        }
    }

    // Return validation errors
    if (validationErrors.length > 0) {
        return res.status(400).json({ 
            message: 'Validation failed.', 
            errors: validationErrors,
            conflicts: conflicts.length > 0 ? conflicts : undefined,
            warnings: warnings.length > 0 ? warnings : undefined
        });
    }
    
    // Return conflicts
    if (conflicts.length > 0) {
        return res.status(409).json({ 
            message: 'Some tiles conflict with soft-deleted tiles.',
            conflicts,
            warnings: warnings.length > 0 ? warnings : undefined,
            canProceed: false
        });
    }

    if (tilesToCreate.length === 0) {
        return res.status(400).json({ message: "No valid tiles to import." });
    }

    // Create tiles with transaction
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        // Step 1: Create new factories first
        const factoryIdMap = new Map(); // temp key -> real MongoDB ID
        
        if (factoriesToCreate.size > 0) {
            const newFactories = Array.from(factoriesToCreate.values());
            const createdFactories = await Factory.insertMany(newFactories, { session });
            
            // Map temp keys to real IDs
            let index = 0;
            for (const [key, factoryData] of factoriesToCreate.entries()) {
                factoryIdMap.set(key, createdFactories[index]._id);
                newFactoriesCreated.push({
                    name: factoryData.name,
                    id: createdFactories[index]._id
                });
                index++;
            }
            
            logger.info(`Created ${createdFactories.length} new factories during bulk import by ${req.user.username}`);
        }
        
        // Step 2: Replace temporary factory keys with real IDs in tiles
        for (const tile of tilesToCreate) {
            tile.manufacturingFactories = tile.manufacturingFactories.map(idOrKey => {
                // If it's a temp key (string), replace with real ID
                if (typeof idOrKey === 'string' && factoryIdMap.has(idOrKey)) {
                    return factoryIdMap.get(idOrKey);
                }
                // Otherwise it's already a real ObjectId
                return idOrKey;
            });
        }
        
        // Step 3: Generate tile IDs
        const lastTile = await Tile.findOne().sort({ createdAt: -1 }).session(session);
        let sequenceNumber = 1;
        if (lastTile && lastTile.tileId) {
            const match = lastTile.tileId.match(/TL-(\d+)/);
            if (match) {
                sequenceNumber = parseInt(match[1], 10) + 1;
            }
        }

        // Assign IDs
        for (const tile of tilesToCreate) {
            tile.tileId = `TL-${String(sequenceNumber).padStart(5, '0')}`;
            sequenceNumber++;
        }

        // Step 4: Insert tiles
        await Tile.insertMany(tilesToCreate, { session });
        await session.commitTransaction();
        
        logger.info(`Bulk imported ${tilesToCreate.length} tiles by ${req.user.username}`);
        
        res.status(201).json({
            message: `Successfully imported ${tilesToCreate.length} tiles${newFactoriesCreated.length > 0 ? ` and created ${newFactoriesCreated.length} new factories` : ''}.`,
            importedCount: tilesToCreate.length,
            newFactoriesCreated: newFactoriesCreated.length > 0 ? newFactoriesCreated : undefined,
            warnings: warnings.length > 0 ? warnings : undefined
        });
    } catch (error) {
        await session.abortTransaction();
        logger.error("Bulk import error:", error);
        res.status(500);
        throw new Error(`Database import failed: ${error.message}`);
    } finally {
        session.endSession();
    }
});

// ===== GET TILES BY FACTORY =====
export const getTilesByFactory = asyncHandler(async (req, res) => {
    const { factoryId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(factoryId)) {
        res.status(400);
        throw new Error('Invalid Factory ID');
    }

    const tiles = await Tile.find({ 
        manufacturingFactories: factoryId,
        deleted: { $ne: true }
    })
    .select('name size conversionFactor')
    .sort({ name: 1 });

    res.status(200).json(tiles);
});

// ===== GET TILE STOCK DETAILS =====
export const getTileStockDetails = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const tile = await Tile.findOne({ _id: id, deleted: { $ne: true } })
        .populate('manufacturingFactories', 'name address')
        .populate('createdBy', 'username');

    if (!tile) {
        res.status(404);
        throw new Error('Tile not found');
    }

    // Get factory stock
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
                palletCount: { $sum: { $cond: [{ $eq: ['$type', 'Pallet'] }, 1, 0] } },
                khatliCount: { $sum: { $cond: [{ $eq: ['$type', 'Khatli'] }, 1, 0] } },
                totalBoxes: { $sum: '$boxCount' }
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
                pallets: '$palletCount',
                khatlis: '$khatliCount',
                boxes: '$totalBoxes'
            }
        },
        { $sort: { factoryName: 1 } }
    ]);

    const totalFactoryStock = factoryStockAgg.reduce((sum, f) => sum + f.boxes, 0);

    // Get transit stock
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

    // Get loaded stock
    const loadedStockAgg = await Pallet.aggregate([
        {
            $match: {
                tile: new mongoose.Types.ObjectId(id),
                status: 'LoadedInContainer'
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

// ===== GET DELETED TILES (Admin) =====
export const getDeletedTiles = asyncHandler(async (req, res) => {
    const deletedTiles = await Tile.find({ deleted: true })
        .select('+deleted +deletedAt +deletedBy')
        .populate('deletedBy', 'username')
        .populate('manufacturingFactories', 'name')
        .sort({ deletedAt: -1 });

    res.status(200).json(deletedTiles);
});

// ===== RESTORE TILE (Admin) =====
export const restoreTile = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const tile = await Tile.findOne({ _id: id, deleted: true })
        .select('+deleted +deletedAt +deletedBy');
    
    if (!tile) {
        res.status(404);
        throw new Error('Tile not found or not deleted');
    }

    // Check for active tiles with same name or number
    const conflicts = [];
    if (tile.name) {
        const nameConflict = await Tile.findOne({ name: tile.name, deleted: { $ne: true } });
        if (nameConflict) conflicts.push(`Name '${tile.name}' is already used`);
    }
    if (tile.number) {
        const numberConflict = await Tile.findOne({ number: tile.number, deleted: { $ne: true } });
        if (numberConflict) conflicts.push(`Number '${tile.number}' is already used`);
    }

    if (conflicts.length > 0) {
        res.status(400);
        throw new Error(`Cannot restore: ${conflicts.join(', ')}`);
    }

    tile.deleted = false;
    tile.deletedAt = undefined;
    tile.deletedBy = undefined;
    await tile.save();

    logger.info(`Tile "${tile.name}" restored by ${req.user.username}`);

    res.status(200).json({
        message: 'Tile restored successfully',
        tile
    });
});