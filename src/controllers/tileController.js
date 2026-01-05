// FILE: backend/src/controllers/tileController.js
// COMPLETE FILE - Replace entire file

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

// ===== GET ALL TILES =====
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
    
    const tiles = await Tile.find(query)
        .populate('createdBy', 'username')
        .populate('manufacturingFactories', 'name')
        .sort({ createdAt: -1 })
        .limit(limitNum)
        .skip(skip);

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

// ===== DELETE TILE (Enhanced with validation) =====
export const deleteTile = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { force } = req.body;

    const tile = await Tile.findOne({ _id: id, deleted: { $ne: true } });
    if (!tile) {
        res.status(404);
        throw new Error('Tile not found');
    }

    // 1. CHECK FOR EXISTING PALLETS/KHATLIS
    const palletCount = await Pallet.countDocuments({ tile: id });

    // 2. CHECK FOR PENDING/ACTIVE POs
    const poCount = await PurchaseOrder.countDocuments({
        'items.tile': id,
        status: { $nin: ['Completed', 'Cancelled'] },
        deleted: { $ne: true }
    });

    // 3. CHECK FOR ACTIVE BOOKINGS
    const bookingCount = await Booking.countDocuments({
        'tilesList.tile': id,
        status: { $nin: ['Completed', 'Cancelled'] }
    });

    // 4. CHECK FOR PENDING RESTOCK REQUESTS
    const restockCount = await RestockRequest.countDocuments({
        'requestedItems.tile': id,
        status: { $nin: ['Completed', 'Cancelled', 'Completed with Discrepancy'] }
    });

    // Build error message if related data exists
    const relatedDataMessages = [];
    if (palletCount > 0) {
        relatedDataMessages.push(`${palletCount} pallets/khatlis exist`);
    }
    if (poCount > 0) {
        relatedDataMessages.push(`${poCount} active purchase orders`);
    }
    if (bookingCount > 0) {
        relatedDataMessages.push(`${bookingCount} active bookings`);
    }
    if (restockCount > 0) {
        relatedDataMessages.push(`${restockCount} pending restock requests`);
    }

    // If related data exists and not force delete
    if (relatedDataMessages.length > 0 && !force) {
        res.status(400);
        throw new Error(
            `Cannot delete tile "${tile.name}". Related data exists: ${relatedDataMessages.join(', ')}. ` +
            `Please complete or cancel related items first.`
        );
    }

    // SOFT DELETE THE TILE
    tile.deleted = true;
    tile.deletedAt = new Date();
    tile.deletedBy = req.user._id;
    await tile.save();

    logger.info(`Tile "${tile.name}" archived by ${req.user.username}${force ? ' (force)' : ''}`);

    res.status(200).json({
        message: 'Tile archived successfully',
        tileName: tile.name,
        tileNumber: tile.tileNumber || tile.number,
        warning: relatedDataMessages.length > 0 
            ? `Force deleted with: ${relatedDataMessages.join(', ')}` 
            : null
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
    const existingTiles = await Tile.find({ 
        $or: [{ number: { $ne: null } }, { name: { $ne: null } }],
        deleted: { $ne: true }
    }).select('name number');
    
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
                stockDetails: { 
                    availableStock: Number(tile.initialStock) || 0, 
                    bookedStock: 0, 
                    restockingStock: 0 
                },
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
        res.status(500);
        throw new Error('An error occurred during the database import. No tiles were saved.');
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
        .sort({ deletedAt: -1 });

    res.status(200).json(deletedTiles);
});

// ===== RESTORE TILE (Admin) =====
export const restoreTile = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const tile = await Tile.findOne({ _id: id }).select('+deleted +deletedAt');
    
    if (!tile) {
        res.status(404);
        throw new Error('Tile not found');
    }

    if (!tile.deleted) {
        res.status(400);
        throw new Error('Tile is not deleted');
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