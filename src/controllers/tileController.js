// // FILE: backend/src/controllers/tileController.js
// // UPDATED VERSION with:
// // 1. Master stats for ALL tiles (not just paginated)
// // 2. Transit stock breakdown by dispatch order
// // 3. Fixed factory pallet counts
// // 4. Optimized queries
// // 5. Support for new surface values (CARVING, SINKER, R-10, R-11)

// import Tile from '../models/tileModel.js';
// import Pallet from '../models/palletModel.js';
// import PurchaseOrder from '../models/purchaseOrderModel.js';
// import Booking from '../models/bookingModel.js';
// import RestockRequest from '../models/restockRequestModel.js';
// import DispatchOrder from '../models/dispatchOrderModel.js';
// import asyncHandler from '../utils/asyncHandler.js';
// import { generateId } from '../services/idGenerator.js';
// import logger from '../config/logger.js';
// import mongoose from 'mongoose';

// // Valid surface values
// const VALID_SURFACES = ['Glossy', 'Matt', 'CARVING', 'SINKER', 'R-10', 'R-11'];

// // ===== CREATE TILE =====
// export const createTile = asyncHandler(async (req, res) => {
//     const {
//         name, number, surface, size, imageUrl, publicId, conversionFactor,
//         restockThreshold, stockDetails, manufacturingFactories
//     } = req.body;

//     // Validate surface
//     if (!VALID_SURFACES.includes(surface)) {
//         res.status(400);
//         throw new Error(`Invalid surface. Must be one of: ${VALID_SURFACES.join(', ')}`);
//     }

//     // Check for ACTIVE tiles with same number
//     if (number) {
//         const existingTileWithNumber = await Tile.findOne({ 
//             number, 
//             deleted: { $ne: true } 
//         });
//         if (existingTileWithNumber) {
//             res.status(400);
//             throw new Error(`A tile with number '${number}' already exists.`);
//         }
//     }

//     // Check for ACTIVE tiles with same name
//     const existingTileWithName = await Tile.findOne({ 
//         name, 
//         deleted: { $ne: true } 
//     });
//     if (existingTileWithName) {
//         res.status(400);
//         throw new Error(`A tile with name '${name}' already exists.`);
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

// // ===== GET ALL TILES WITH MASTER STATS =====
// export const getAllTiles = asyncHandler(async (req, res) => {
//     const { 
//         search, 
//         size, 
//         surface,
//         underThreshold, 
//         showDeleted,
//         page = 1, 
//         limit = 50 
//     } = req.query;
    
//     const query = {};
    
//     // Handle deleted filter
//     if (showDeleted === 'true') {
//         query.deleted = true;
//     } else {
//         query.deleted = { $ne: true };
//     }
    
//     if (search) {
//         const searchRegex = new RegExp(search, 'i');
//         query.$or = [{ name: searchRegex }, { number: searchRegex }];
//     }
//     if (size) { query.size = size; }
//     if (surface) { query.surface = surface; }
//     if (underThreshold === 'true') {
//         query.$expr = { $lte: ['$stockDetails.availableStock', '$restockThreshold'] };
//     }
    
//     const pageNum = Number(page);
//     const limitNum = Number(limit);
//     const skip = (pageNum - 1) * limitNum;

//     // Run queries in parallel for better performance
//     const [totalTiles, tiles, masterStats, transitStockByTile] = await Promise.all([
//         // Count total
//         Tile.countDocuments(query),
        
//         // Get paginated tiles
//         Tile.find(query)
//             .populate('createdBy', 'username')
//             .populate('manufacturingFactories', 'name')
//             .select(showDeleted === 'true' ? '+deleted +deletedAt +deletedBy' : '')
//             .populate(showDeleted === 'true' ? { path: 'deletedBy', select: 'username' } : '')
//             .sort({ createdAt: -1 })
//             .limit(limitNum)
//             .skip(skip)
//             .lean(),
        
//         // MASTER STATS - for ALL tiles matching filter (not just paginated)
//         Tile.aggregate([
//             { $match: query },
//             {
//                 $group: {
//                     _id: null,
//                     totalTiles: { $sum: 1 },
//                     totalAvailableStock: { $sum: '$stockDetails.availableStock' },
//                     totalBookedStock: { $sum: '$stockDetails.bookedStock' },
//                     totalRestockingStock: { $sum: '$stockDetails.restockingStock' },
//                     totalInFactoryStock: { $sum: '$stockDetails.inFactoryStock' },
//                     totalInTransitStock: { $sum: '$stockDetails.inTransitStock' },
//                     tilesUnderThreshold: {
//                         $sum: {
//                             $cond: [
//                                 { $lte: ['$stockDetails.availableStock', '$restockThreshold'] },
//                                 1,
//                                 0
//                             ]
//                         }
//                     }
//                 }
//             }
//         ]),
        
//         // Get transit stock from pallets for all tiles (for accurate transit display)
//         Pallet.aggregate([
//             {
//                 $match: {
//                     status: { $in: ['LoadedInContainer', 'Dispatched'] }
//                 }
//             },
//             {
//                 $group: {
//                     _id: '$tile',
//                     transitBoxes: { $sum: '$boxCount' },
//                     transitPallets: { $sum: { $cond: [{ $eq: ['$type', 'Pallet'] }, 1, 0] } },
//                     transitKhatlis: { $sum: { $cond: [{ $eq: ['$type', 'Khatli'] }, 1, 0] } }
//                 }
//             }
//         ])
//     ]);

//     // Create transit stock map for quick lookup
//     const transitMap = new Map();
//     transitStockByTile.forEach(item => {
//         transitMap.set(item._id.toString(), {
//             boxes: item.transitBoxes,
//             pallets: item.transitPallets,
//             khatlis: item.transitKhatlis
//         });
//     });

//     // Enrich tiles with accurate transit stock
//     const enrichedTiles = tiles.map(tile => {
//         const tileId = tile._id.toString();
//         const transitData = transitMap.get(tileId) || { boxes: 0, pallets: 0, khatlis: 0 };
//         return {
//             ...tile,
//             transitStock: transitData
//         };
//     });

//     // Format master stats
//     const stats = masterStats[0] || {
//         totalTiles: 0,
//         totalAvailableStock: 0,
//         totalBookedStock: 0,
//         totalRestockingStock: 0,
//         totalInFactoryStock: 0,
//         totalInTransitStock: 0,
//         tilesUnderThreshold: 0
//     };

//     res.status(200).json({ 
//         tiles: enrichedTiles, 
//         page: pageNum, 
//         pages: Math.ceil(totalTiles / limitNum), 
//         total: totalTiles,
//         masterStats: {
//             totalTiles: stats.totalTiles,
//             totalAvailableStock: stats.totalAvailableStock,
//             totalBookedStock: stats.totalBookedStock,
//             totalRestockingStock: stats.totalRestockingStock,
//             totalInFactoryStock: stats.totalInFactoryStock,
//             totalInTransitStock: stats.totalInTransitStock,
//             tilesUnderThreshold: stats.tilesUnderThreshold
//         }
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

//     // Validate surface if provided
//     if (surface && !VALID_SURFACES.includes(surface)) {
//         res.status(400);
//         throw new Error(`Invalid surface. Must be one of: ${VALID_SURFACES.join(', ')}`);
//     }

//     // Check for duplicate number
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

//     // Check for duplicate name
//     if (name && name !== tile.name) {
//         const existingTileWithName = await Tile.findOne({ 
//             name, 
//             _id: { $ne: req.params.id },
//             deleted: { $ne: true }
//         });
//         if (existingTileWithName) {
//             res.status(400);
//             throw new Error(`Another tile with name '${name}' already exists.`);
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

// // ===== DELETE TILE (Soft Delete) =====
// export const deleteTile = asyncHandler(async (req, res) => {
//     const { id } = req.params;
//     const { force } = req.body;

//     const tile = await Tile.findOne({ _id: id, deleted: { $ne: true } });
//     if (!tile) {
//         res.status(404);
//         throw new Error('Tile not found');
//     }

//     // Check for related data
//     const palletCount = await Pallet.countDocuments({ tile: id });
//     const poCount = await PurchaseOrder.countDocuments({
//         'items.tile': id,
//         status: { $nin: ['Completed', 'Cancelled'] },
//         deleted: { $ne: true }
//     });
//     const bookingCount = await Booking.countDocuments({
//         'tilesList.tile': id,
//         status: { $nin: ['Completed', 'Cancelled'] }
//     });
//     const restockCount = await RestockRequest.countDocuments({
//         'requestedItems.tile': id,
//         status: { $nin: ['Completed', 'Cancelled', 'Completed with Discrepancy'] }
//     });

//     const relatedDataMessages = [];
//     if (palletCount > 0) relatedDataMessages.push(`${palletCount} pallets/khatlis exist`);
//     if (poCount > 0) relatedDataMessages.push(`${poCount} active purchase orders`);
//     if (bookingCount > 0) relatedDataMessages.push(`${bookingCount} active bookings`);
//     if (restockCount > 0) relatedDataMessages.push(`${restockCount} pending restock requests`);

//     if (relatedDataMessages.length > 0 && !force) {
//         res.status(400);
//         throw new Error(
//             `Cannot delete tile "${tile.name}". Related data exists: ${relatedDataMessages.join(', ')}. ` +
//             `Please complete or cancel related items first.`
//         );
//     }

//     // SOFT DELETE
//     tile.deleted = true;
//     tile.deletedAt = new Date();
//     tile.deletedBy = req.user._id;
//     await tile.save();

//     logger.info(`Tile "${tile.name}" archived by ${req.user.username}${force ? ' (force)' : ''}`);

//     res.status(200).json({
//         message: 'Tile archived successfully',
//         tileName: tile.name,
//         tileNumber: tile.number,
//         warning: relatedDataMessages.length > 0 
//             ? `Force deleted with: ${relatedDataMessages.join(', ')}` 
//             : null
//     });
// });

// // ===== HARD DELETE TILE (Admin Only) =====
// export const hardDeleteTile = asyncHandler(async (req, res) => {
//     const { id } = req.params;

//     logger.info(`Hard delete request for tile ID: ${id} by user: ${req.user.username}`);

//     const tile = await Tile.findOne({ _id: id, deleted: true })
//         .select('+deleted +deletedAt +deletedBy');
    
//     if (!tile) {
//         logger.warn(`Hard delete failed: Tile ${id} not found or not soft-deleted`);
//         res.status(404);
//         throw new Error('Tile not found or not deleted. Only soft-deleted tiles can be permanently deleted.');
//     }

//     logger.info(`Found soft-deleted tile: ${tile.name} (${tile.number || 'no number'})`);

//     // Check for any remaining related data
//     const palletCount = await Pallet.countDocuments({ tile: id });
//     const poCount = await PurchaseOrder.countDocuments({ 'items.tile': id });
//     const bookingCount = await Booking.countDocuments({ 'tilesList.tile': id });
//     const restockCount = await RestockRequest.countDocuments({ 'requestedItems.tile': id });

//     if (palletCount > 0 || poCount > 0 || bookingCount > 0 || restockCount > 0) {
//         logger.warn(`Hard delete blocked: Tile ${tile.name} has related data`);
//         res.status(400);
//         throw new Error(
//             `Cannot permanently delete tile. Related data still exists: ` +
//             `${palletCount} pallets, ${poCount} POs, ${bookingCount} bookings, ${restockCount} restock requests. ` +
//             `Please remove all related data first.`
//         );
//     }

//     const tileName = tile.name;
//     const tileNumber = tile.number;
    
//     // PERMANENT DELETE
//     await Tile.deleteOne({ _id: id });

//     logger.info(`Tile "${tileName}" (${tileNumber || 'no number'}) permanently deleted by ${req.user.username}`);

//     res.status(200).json({
//         message: 'Tile permanently deleted',
//         tileName,
//         tileNumber
//     });
// });

// // ===== GET UNIQUE TILE SIZES =====
// export const getUniqueTileSizes = asyncHandler(async (req, res) => {
//     const sizes = await Tile.distinct('size', { deleted: { $ne: true } });
//     const sortedSizes = sizes.filter(size => size).sort();
//     res.status(200).json(sortedSizes);
// });

// // ===== GET UNIQUE TILE SURFACES =====
// export const getUniqueTileSurfaces = asyncHandler(async (req, res) => {
//     // Return both existing surfaces in DB and all valid options
//     const usedSurfaces = await Tile.distinct('surface', { deleted: { $ne: true } });
//     res.status(200).json({
//         used: usedSurfaces.sort(),
//         available: VALID_SURFACES
//     });
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

// // ===== GET TILE STOCK DETAILS WITH TRANSIT BREAKDOWN =====
// export const getTileStockDetails = asyncHandler(async (req, res) => {
//     const { id } = req.params;

//     const tileObjectId = new mongoose.Types.ObjectId(id);

//     // Run all queries in parallel for faster response
//     const [tile, factoryStockAgg, transitPallets, loadedStockAgg] = await Promise.all([
//         // Get tile details
//         Tile.findOne({ _id: id, deleted: { $ne: true } })
//             .populate('manufacturingFactories', 'name address')
//             .populate('createdBy', 'username')
//             .lean(),

//         // Get factory stock with CORRECT pallet/khatli counts
//         Pallet.aggregate([
//             { 
//                 $match: { 
//                     tile: tileObjectId, 
//                     status: 'InFactoryStock' 
//                 } 
//             },
//             {
//                 $group: {
//                     _id: '$factory',
//                     palletCount: { $sum: { $cond: [{ $eq: ['$type', 'Pallet'] }, 1, 0] } },
//                     khatliCount: { $sum: { $cond: [{ $eq: ['$type', 'Khatli'] }, 1, 0] } },
//                     totalBoxes: { $sum: '$boxCount' }
//                 }
//             },
//             {
//                 $lookup: {
//                     from: 'factories',
//                     localField: '_id',
//                     foreignField: '_id',
//                     as: 'factoryInfo'
//                 }
//             },
//             { $unwind: { path: '$factoryInfo', preserveNullAndEmptyArrays: true } },
//             {
//                 $project: {
//                     _id: 0,
//                     factoryId: '$_id',
//                     factoryName: { $ifNull: ['$factoryInfo.name', 'Unknown'] },
//                     pallets: '$palletCount',
//                     khatlis: '$khatliCount',
//                     boxes: '$totalBoxes'
//                 }
//             },
//             { $sort: { factoryName: 1 } }
//         ]),

//         // Get transit pallets with dispatch order info
//         Pallet.aggregate([
//             {
//                 $match: {
//                     tile: tileObjectId,
//                     status: { $in: ['LoadedInContainer', 'Dispatched'] }
//                 }
//             },
//             {
//                 $lookup: {
//                     from: 'containers',
//                     localField: 'container',
//                     foreignField: '_id',
//                     as: 'containerInfo'
//                 }
//             },
//             { $unwind: { path: '$containerInfo', preserveNullAndEmptyArrays: true } },
//             {
//                 $project: {
//                     _id: 1,
//                     type: 1,
//                     boxCount: 1,
//                     status: 1,
//                     container: 1,
//                     containerNumber: '$containerInfo.containerNumber'
//                 }
//             }
//         ]),

//         // Get loaded stock
//         Pallet.aggregate([
//             {
//                 $match: {
//                     tile: tileObjectId,
//                     status: 'LoadedInContainer'
//                 }
//             },
//             {
//                 $group: {
//                     _id: null,
//                     total: { $sum: '$boxCount' }
//                 }
//             }
//         ])
//     ]);

//     if (!tile) {
//         res.status(404);
//         throw new Error('Tile not found');
//     }

//     const totalFactoryStock = factoryStockAgg.reduce((sum, f) => sum + f.boxes, 0);

//     // Calculate transit summary
//     let transitPalletCount = 0;
//     let transitKhatliCount = 0;
//     let transitTotalBoxes = 0;

//     transitPallets.forEach(p => {
//         if (p.type === 'Pallet') transitPalletCount++;
//         else if (p.type === 'Khatli') transitKhatliCount++;
//         transitTotalBoxes += p.boxCount;
//     });

//     // Get dispatch orders that contain this tile's pallets
//     const containerIds = [...new Set(transitPallets.map(p => p.container).filter(Boolean))];
    
//     let transitBreakdown = [];
//     if (containerIds.length > 0) {
//         // Find dispatch orders containing these containers
//         const dispatchOrders = await DispatchOrder.find({
//             'containers.containerId': { $in: containerIds },
//             deleted: { $ne: true }
//         })
//         .select('dispatchNumber status dispatchDate containers')
//         .lean();

//         // Build breakdown by dispatch order
//         const breakdownMap = new Map();
        
//         transitPallets.forEach(pallet => {
//             if (!pallet.container) return;
            
//             // Find which dispatch order this container belongs to
//             const dispatchOrder = dispatchOrders.find(do_ => 
//                 do_.containers.some(c => c.containerId.toString() === pallet.container.toString())
//             );
            
//             if (dispatchOrder) {
//                 const key = dispatchOrder._id.toString();
//                 if (!breakdownMap.has(key)) {
//                     breakdownMap.set(key, {
//                         dispatchOrderId: dispatchOrder._id,
//                         dispatchNumber: dispatchOrder.dispatchNumber,
//                         dispatchDate: dispatchOrder.dispatchDate,
//                         status: dispatchOrder.status,
//                         pallets: 0,
//                         khatlis: 0,
//                         boxes: 0
//                     });
//                 }
//                 const entry = breakdownMap.get(key);
//                 if (pallet.type === 'Pallet') entry.pallets++;
//                 else if (pallet.type === 'Khatli') entry.khatlis++;
//                 entry.boxes += pallet.boxCount;
//             }
//         });

//         transitBreakdown = Array.from(breakdownMap.values()).sort((a, b) => 
//             new Date(b.dispatchDate) - new Date(a.dispatchDate)
//         );
//     }

//     const loadedStock = loadedStockAgg[0] || { total: 0 };

//     res.status(200).json({
//         tile,
//         factoryStock: {
//             total: totalFactoryStock,
//             byFactory: factoryStockAgg
//         },
//         transitStock: {
//             total: transitTotalBoxes,
//             pallets: transitPalletCount,
//             khatlis: transitKhatliCount,
//             // NEW: Breakdown by dispatch order
//             byDispatchOrder: transitBreakdown
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
//         .populate('manufacturingFactories', 'name')
//         .sort({ deletedAt: -1 });

//     res.status(200).json(deletedTiles);
// });

// // ===== RESTORE TILE (Admin) =====
// export const restoreTile = asyncHandler(async (req, res) => {
//     const { id } = req.params;

//     const tile = await Tile.findOne({ _id: id, deleted: true })
//         .select('+deleted +deletedAt +deletedBy');
    
//     if (!tile) {
//         res.status(404);
//         throw new Error('Tile not found or not deleted');
//     }

//     // Check for active tiles with same name or number
//     const conflicts = [];
//     if (tile.name) {
//         const nameConflict = await Tile.findOne({ name: tile.name, deleted: { $ne: true } });
//         if (nameConflict) conflicts.push(`Name '${tile.name}' is already used`);
//     }
//     if (tile.number) {
//         const numberConflict = await Tile.findOne({ number: tile.number, deleted: { $ne: true } });
//         if (numberConflict) conflicts.push(`Number '${tile.number}' is already used`);
//     }

//     if (conflicts.length > 0) {
//         res.status(400);
//         throw new Error(`Cannot restore: ${conflicts.join(', ')}`);
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

// // ===== BULK CREATE TILES =====
// export const bulkCreateTiles = asyncHandler(async (req, res) => {
//     const tilesData = req.body.tiles;

//     if (!tilesData || !Array.isArray(tilesData) || tilesData.length === 0) {
//         res.status(400);
//         throw new Error('No tile data provided.');
//     }

//     const validationErrors = [];
//     const tilesToCreate = [];
//     const conflicts = [];
//     const warnings = [];
//     const newFactoriesCreated = [];
    
//     // Get ACTIVE tiles
//     const existingTiles = await Tile.find({ deleted: { $ne: true } })
//         .select('name number');
    
//     // Get SOFT-DELETED tiles
//     const softDeletedTiles = await Tile.find({ deleted: true })
//         .select('name number _id +deleted');
    
//     // Get all factories
//     const Factory = mongoose.model('Factory');
//     const allFactories = await Factory.find({ deleted: { $ne: true } })
//         .select('name _id');
    
//     // Create factory name map
//     const factoryMap = new Map();
//     allFactories.forEach(factory => {
//         factoryMap.set(factory.name.toLowerCase().trim(), factory._id);
//     });
    
//     const dbNumbers = new Set(existingTiles.map(t => t.number).filter(Boolean));
//     const dbNames = new Set(existingTiles.map(t => t.name));
    
//     // Maps for soft-deleted tiles
//     const softDeletedByName = new Map();
//     const softDeletedByNumber = new Map();
//     softDeletedTiles.forEach(tile => {
//         if (tile.name) softDeletedByName.set(tile.name, tile._id);
//         if (tile.number) softDeletedByNumber.set(tile.number, tile._id);
//     });
    
//     const fileNumbers = new Set();
//     const fileNames = new Set();
    
//     // Track new factories to create
//     const factoriesToCreate = new Map();

//     // Validate each tile
//     for (let i = 0; i < tilesData.length; i++) {
//         const tile = tilesData[i];
//         const errors = [];
//         const rowConflicts = {};
//         const rowWarnings = [];
        
//         // Validate name
//         if (!tile.name || String(tile.name).trim() === '') {
//             errors.push('Name is required.');
//         } else {
//             const tileName = String(tile.name).trim();
            
//             if (dbNames.has(tileName) || fileNames.has(tileName)) {
//                 errors.push(`Name '${tileName}' already exists in active tiles.`);
//             } else if (softDeletedByName.has(tileName)) {
//                 rowConflicts.nameConflict = {
//                     field: 'name',
//                     value: tileName,
//                     deletedTileId: softDeletedByName.get(tileName)
//                 };
//             }
//             fileNames.add(tileName);
//         }
        
//         // Validate size
//         if (!tile.size || String(tile.size).trim() === '') {
//             errors.push('Size is required.');
//         }
        
//         // Validate surface - UPDATED to support new values
//         if (!tile.surface || String(tile.surface).trim() === '') {
//             errors.push('Surface is required.');
//         } else {
//             let surface = String(tile.surface).trim();
//             // Normalize common variations
//             if (surface.toLowerCase() === 'matt') surface = 'Matt';
//             if (surface.toLowerCase() === 'glossy') surface = 'Glossy';
            
//             if (!VALID_SURFACES.includes(surface)) {
//                 errors.push(`Surface must be one of: ${VALID_SURFACES.join(', ')}`);
//             }
//         }
        
//         // Validate conversionFactor
//         if (!tile.conversionFactor || isNaN(Number(tile.conversionFactor)) || Number(tile.conversionFactor) <= 0) {
//             errors.push('Conversion factor must be a positive number.');
//         }
        
//         // Validate number if provided
//         if (tile.number && String(tile.number).trim() !== '') {
//             const tileNumber = String(tile.number).trim();
            
//             if (dbNumbers.has(tileNumber) || fileNumbers.has(tileNumber)) {
//                 errors.push(`Number '${tileNumber}' already exists in active tiles.`);
//             } else if (softDeletedByNumber.has(tileNumber)) {
//                 rowConflicts.numberConflict = {
//                     field: 'number',
//                     value: tileNumber,
//                     deletedTileId: softDeletedByNumber.get(tileNumber)
//                 };
//             }
//             fileNumbers.add(tileNumber);
//         }
        
//         // Process manufacturing factories
//         let factoryIds = [];
//         if (tile.manufacturingFactories && String(tile.manufacturingFactories).trim() !== '') {
//             const factoryNamesStr = String(tile.manufacturingFactories).trim();
//             const factoryNames = factoryNamesStr.split(',').map(name => name.trim()).filter(name => name);
//             const createNew = tile.createNewFactories === true || 
//                              String(tile.createNewFactories).toLowerCase() === 'true' ||
//                              tile.createNewFactories === 'TRUE';
            
//             for (const factoryName of factoryNames) {
//                 const factoryKey = factoryName.toLowerCase().trim();
                
//                 if (factoryMap.has(factoryKey)) {
//                     factoryIds.push(factoryMap.get(factoryKey));
//                 }
//                 else if (factoriesToCreate.has(factoryKey)) {
//                     factoryIds.push(factoryKey);
//                 }
//                 else {
//                     if (createNew) {
//                         factoriesToCreate.set(factoryKey, {
//                             name: factoryName,
//                             address: 'To be updated',
//                             contactPerson: 'To be updated',
//                             contactNumber: 'To be updated',
//                             status: 'pending_details',
//                             createdBy: req.user._id
//                         });
//                         factoryIds.push(factoryKey);
//                         rowWarnings.push(`Will create new factory: "${factoryName}"`);
//                     } else {
//                         errors.push(`Factory "${factoryName}" not found. Set createNewFactories to TRUE to auto-create.`);
//                     }
//                 }
//             }
//         }
        
//         // Track conflicts
//         if (Object.keys(rowConflicts).length > 0) {
//             conflicts.push({
//                 rowIndex: i,
//                 tileName: tile.name,
//                 conflicts: rowConflicts
//             });
//         }
        
//         // Track warnings
//         if (rowWarnings.length > 0) {
//             warnings.push({
//                 rowIndex: i,
//                 tileName: tile.name,
//                 warnings: rowWarnings
//             });
//         }
        
//         // Track errors
//         if (errors.length > 0) {
//             validationErrors.push({ rowIndex: i, errors });
//         } else if (Object.keys(rowConflicts).length === 0) {
//             let surface = String(tile.surface).trim();
//             if (surface.toLowerCase() === 'matt') surface = 'Matt';
//             if (surface.toLowerCase() === 'glossy') surface = 'Glossy';
            
//             tilesToCreate.push({
//                 name: String(tile.name).trim(),
//                 number: (tile.number && String(tile.number).trim() !== '') ? String(tile.number).trim() : undefined,
//                 surface: surface,
//                 size: String(tile.size).trim(),
//                 conversionFactor: Number(tile.conversionFactor),
//                 restockThreshold: Number(tile.restockThreshold) || 0,
//                 imageUrl: tile.imageUrl ? String(tile.imageUrl).trim() : '',
//                 stockDetails: { 
//                     availableStock: Number(tile.initialStock) || 0, 
//                     bookedStock: 0, 
//                     restockingStock: 0 
//                 },
//                 manufacturingFactories: factoryIds,
//                 createdBy: req.user._id,
//             });
//         }
//     }

//     // Return validation errors
//     if (validationErrors.length > 0) {
//         return res.status(400).json({ 
//             message: 'Validation failed.', 
//             errors: validationErrors,
//             conflicts: conflicts.length > 0 ? conflicts : undefined,
//             warnings: warnings.length > 0 ? warnings : undefined
//         });
//     }
    
//     // Return conflicts
//     if (conflicts.length > 0) {
//         return res.status(409).json({ 
//             message: 'Some tiles conflict with soft-deleted tiles.',
//             conflicts,
//             warnings: warnings.length > 0 ? warnings : undefined,
//             canProceed: false
//         });
//     }

//     if (tilesToCreate.length === 0) {
//         return res.status(400).json({ message: "No valid tiles to import." });
//     }

//     // Create tiles with transaction
//     const session = await mongoose.startSession();
//     session.startTransaction();
    
//     try {
//         // Step 1: Create new factories first
//         const factoryIdMap = new Map();
        
//         if (factoriesToCreate.size > 0) {
//             const newFactories = Array.from(factoriesToCreate.values());
//             const createdFactories = await Factory.insertMany(newFactories, { session });
            
//             let index = 0;
//             for (const [key, factoryData] of factoriesToCreate.entries()) {
//                 factoryIdMap.set(key, createdFactories[index]._id);
//                 newFactoriesCreated.push({
//                     name: factoryData.name,
//                     id: createdFactories[index]._id
//                 });
//                 index++;
//             }
            
//             logger.info(`Created ${createdFactories.length} new factories during bulk import by ${req.user.username}`);
//         }
        
//         // Step 2: Replace temporary factory keys with real IDs
//         for (const tile of tilesToCreate) {
//             tile.manufacturingFactories = tile.manufacturingFactories.map(idOrKey => {
//                 if (typeof idOrKey === 'string' && factoryIdMap.has(idOrKey)) {
//                     return factoryIdMap.get(idOrKey);
//                 }
//                 return idOrKey;
//             });
//         }
        
//         // Step 3: Generate tile IDs
//         const lastTile = await Tile.findOne().sort({ createdAt: -1 }).session(session);
//         let sequenceNumber = 1;
//         if (lastTile && lastTile.tileId) {
//             const match = lastTile.tileId.match(/TL-(\d+)/);
//             if (match) {
//                 sequenceNumber = parseInt(match[1], 10) + 1;
//             }
//         }

//         // Assign IDs
//         for (const tile of tilesToCreate) {
//             tile.tileId = `TL-${String(sequenceNumber).padStart(5, '0')}`;
//             sequenceNumber++;
//         }

//         // Step 4: Insert tiles
//         await Tile.insertMany(tilesToCreate, { session });
//         await session.commitTransaction();
        
//         logger.info(`Bulk imported ${tilesToCreate.length} tiles by ${req.user.username}`);
        
//         res.status(201).json({
//             message: `Successfully imported ${tilesToCreate.length} tiles${newFactoriesCreated.length > 0 ? ` and created ${newFactoriesCreated.length} new factories` : ''}.`,
//             importedCount: tilesToCreate.length,
//             newFactoriesCreated: newFactoriesCreated.length > 0 ? newFactoriesCreated : undefined,
//             warnings: warnings.length > 0 ? warnings : undefined
//         });
//     } catch (error) {
//         await session.abortTransaction();
//         logger.error("Bulk import error:", error);
//         res.status(500);
//         throw new Error(`Database import failed: ${error.message}`);
//     } finally {
//         session.endSession();
//     }
// });

// FILE: backend/src/controllers/tileController.js
// FIXED VERSION v4 - Correct transit stock calculation
// Uses DispatchOrder.containers.items to get tile-wise transit stock

import Tile from '../models/tileModel.js';
import Pallet from '../models/palletModel.js';
import Container from '../models/containerModel.js';
import PurchaseOrder from '../models/purchaseOrderModel.js';
import Booking from '../models/bookingModel.js';
import RestockRequest from '../models/restockRequestModel.js';
import DispatchOrder from '../models/dispatchOrderModel.js';
import asyncHandler from '../utils/asyncHandler.js';
import { generateId } from '../services/idGenerator.js';
import logger from '../config/logger.js';
import mongoose from 'mongoose';

const VALID_SURFACES = ['Glossy', 'Matt', 'CARVING', 'SINKER', 'R-10', 'R-11'];

// ===== CREATE TILE =====
export const createTile = asyncHandler(async (req, res) => {
    const { name, number, surface, size, imageUrl, publicId, conversionFactor, restockThreshold, stockDetails, manufacturingFactories } = req.body;

    if (!VALID_SURFACES.includes(surface)) {
        res.status(400);
        throw new Error(`Invalid surface. Must be one of: ${VALID_SURFACES.join(', ')}`);
    }

    if (number) {
        const existingTileWithNumber = await Tile.findOne({ number, deleted: { $ne: true } });
        if (existingTileWithNumber) {
            res.status(400);
            throw new Error(`A tile with number '${number}' already exists.`);
        }
    }

    const existingTileWithName = await Tile.findOne({ name, deleted: { $ne: true } });
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

// ===== HELPER: Calculate transit stock from "In Transit" dispatch orders =====
// This function reads from DispatchOrder.containers.items which has tileId and boxCount
const calculateTransitStockFromDispatches = async () => {
    // Get all "In Transit" dispatch orders using aggregate to bypass pre-find hook
    const inTransitDispatches = await DispatchOrder.aggregate([
        {
            $match: {
                status: 'In Transit',
                deleted: { $ne: true }
            }
        },
        {
            $project: {
                _id: 1,
                dispatchNumber: 1,
                dispatchDate: 1,
                status: 1,
                containers: 1,
                stockSummary: 1
            }
        }
    ]);

    // Map to store transit stock per tile
    const transitByTile = new Map();
    // Total transit boxes for master stats
    let totalTransitBoxes = 0;

    // Process each dispatch order
    inTransitDispatches.forEach(dispatch => {
        if (!dispatch.containers || !Array.isArray(dispatch.containers)) return;

        // Process each container in the dispatch
        dispatch.containers.forEach(container => {
            if (!container.items || !Array.isArray(container.items)) return;

            // Process each item (pallet/khatli) in the container
            container.items.forEach(item => {
                if (!item.tileId) return;

                const tileIdStr = item.tileId.toString();
                const boxes = (item.boxCount || 0) * (item.quantity || 1);

                if (!transitByTile.has(tileIdStr)) {
                    transitByTile.set(tileIdStr, {
                        boxes: 0,
                        pallets: 0,
                        khatlis: 0,
                        byDispatchOrder: []
                    });
                }

                const tileData = transitByTile.get(tileIdStr);
                tileData.boxes += boxes;
                totalTransitBoxes += boxes;

                if (item.itemType === 'Pallet') {
                    tileData.pallets += (item.quantity || 1);
                } else if (item.itemType === 'Khatli') {
                    tileData.khatlis += (item.quantity || 1);
                }

                // Track by dispatch order
                let dispatchEntry = tileData.byDispatchOrder.find(d => d.dispatchOrderId.toString() === dispatch._id.toString());
                if (!dispatchEntry) {
                    dispatchEntry = {
                        dispatchOrderId: dispatch._id,
                        dispatchNumber: dispatch.dispatchNumber,
                        dispatchDate: dispatch.dispatchDate,
                        status: dispatch.status,
                        pallets: 0,
                        khatlis: 0,
                        boxes: 0
                    };
                    tileData.byDispatchOrder.push(dispatchEntry);
                }

                dispatchEntry.boxes += boxes;
                if (item.itemType === 'Pallet') {
                    dispatchEntry.pallets += (item.quantity || 1);
                } else if (item.itemType === 'Khatli') {
                    dispatchEntry.khatlis += (item.quantity || 1);
                }
            });
        });
    });

    return { transitByTile, totalTransitBoxes, inTransitDispatches };
};

// ===== GET ALL TILES WITH MASTER STATS =====
export const getAllTiles = asyncHandler(async (req, res) => {
    const { search, size, surface, underThreshold, showDeleted, page = 1, limit = 50 } = req.query;
    
    const query = {};
    
    if (showDeleted === 'true') {
        query.deleted = true;
    } else {
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

    // Run all queries in parallel
    const [totalTiles, tiles, masterStatsAgg, transitData] = await Promise.all([
        Tile.countDocuments(query),
        
        Tile.find(query)
            .populate('createdBy', 'username')
            .populate('manufacturingFactories', 'name')
            .select(showDeleted === 'true' ? '+deleted +deletedAt +deletedBy' : '')
            .populate(showDeleted === 'true' ? { path: 'deletedBy', select: 'username' } : '')
            .sort({ createdAt: -1 })
            .limit(limitNum)
            .skip(skip)
            .lean(),
        
        Tile.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalTiles: { $sum: 1 },
                    totalAvailableStock: { $sum: '$stockDetails.availableStock' },
                    totalBookedStock: { $sum: '$stockDetails.bookedStock' },
                    totalRestockingStock: { $sum: '$stockDetails.restockingStock' },
                    totalInFactoryStock: { $sum: '$stockDetails.inFactoryStock' },
                    tilesUnderThreshold: {
                        $sum: { $cond: [{ $lte: ['$stockDetails.availableStock', '$restockThreshold'] }, 1, 0] }
                    }
                }
            }
        ]),
        
        // Get transit data from In Transit dispatches
        calculateTransitStockFromDispatches()
    ]);

    const { transitByTile, totalTransitBoxes } = transitData;

    // Enrich tiles with transit stock
    const enrichedTiles = tiles.map(tile => {
        const tileIdStr = tile._id.toString();
        const tileTransit = transitByTile.get(tileIdStr);
        return {
            ...tile,
            transitStock: tileTransit ? {
                boxes: tileTransit.boxes,
                pallets: tileTransit.pallets,
                khatlis: tileTransit.khatlis
            } : { boxes: 0, pallets: 0, khatlis: 0 }
        };
    });

    const stats = masterStatsAgg[0] || {
        totalTiles: 0, totalAvailableStock: 0, totalBookedStock: 0,
        totalRestockingStock: 0, totalInFactoryStock: 0, tilesUnderThreshold: 0
    };

    res.status(200).json({ 
        tiles: enrichedTiles, 
        page: pageNum, 
        pages: Math.ceil(totalTiles / limitNum), 
        total: totalTiles,
        masterStats: {
            totalTiles: stats.totalTiles,
            totalAvailableStock: stats.totalAvailableStock,
            totalBookedStock: stats.totalBookedStock,
            totalRestockingStock: stats.totalRestockingStock,
            totalInFactoryStock: stats.totalInFactoryStock,
            totalInTransitStock: totalTransitBoxes,
            tilesUnderThreshold: stats.tilesUnderThreshold
        }
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
    const { name, number, surface, size, imageUrl, publicId, conversionFactor, restockThreshold, stockDetails, manufacturingFactories } = req.body;

    const tile = await Tile.findOne({ _id: req.params.id, deleted: { $ne: true } });
    if (!tile) {
        res.status(404);
        throw new Error('Tile not found');
    }

    if (surface && !VALID_SURFACES.includes(surface)) {
        res.status(400);
        throw new Error(`Invalid surface. Must be one of: ${VALID_SURFACES.join(', ')}`);
    }

    if (number) {
        const existingTileWithNumber = await Tile.findOne({ number, _id: { $ne: req.params.id }, deleted: { $ne: true } });
        if (existingTileWithNumber) {
            res.status(400);
            throw new Error(`Another tile with number '${number}' already exists.`);
        }
    }

    if (name) {
        const existingTileWithName = await Tile.findOne({ name, _id: { $ne: req.params.id }, deleted: { $ne: true } });
        if (existingTileWithName) {
            res.status(400);
            throw new Error(`Another tile with name '${name}' already exists.`);
        }
    }

    tile.name = name || tile.name;
    tile.number = number !== undefined ? number : tile.number;
    tile.surface = surface || tile.surface;
    tile.size = size || tile.size;
    tile.imageUrl = imageUrl !== undefined ? imageUrl : tile.imageUrl;
    tile.publicId = publicId !== undefined ? publicId : tile.publicId;
    tile.conversionFactor = conversionFactor || tile.conversionFactor;
    tile.restockThreshold = restockThreshold !== undefined ? restockThreshold : tile.restockThreshold;
    
    if (stockDetails) {
        tile.stockDetails = {
            availableStock: stockDetails.availableStock !== undefined ? Number(stockDetails.availableStock) : tile.stockDetails.availableStock,
            bookedStock: stockDetails.bookedStock !== undefined ? Number(stockDetails.bookedStock) : tile.stockDetails.bookedStock,
            restockingStock: stockDetails.restockingStock !== undefined ? Number(stockDetails.restockingStock) : tile.stockDetails.restockingStock,
            inFactoryStock: stockDetails.inFactoryStock !== undefined ? Number(stockDetails.inFactoryStock) : tile.stockDetails.inFactoryStock,
            inTransitStock: stockDetails.inTransitStock !== undefined ? Number(stockDetails.inTransitStock) : tile.stockDetails.inTransitStock,
        };
    }

    if (manufacturingFactories !== undefined) {
        tile.manufacturingFactories = manufacturingFactories;
    }

    const updatedTile = await tile.save();
    await updatedTile.populate('manufacturingFactories', 'name');

    res.status(200).json(updatedTile);
});

// ===== DELETE TILE (SOFT) =====
export const deleteTile = asyncHandler(async (req, res) => {
    const tile = await Tile.findOne({ _id: req.params.id, deleted: { $ne: true } });
    if (!tile) {
        res.status(404);
        throw new Error('Tile not found');
    }

    tile.deleted = true;
    tile.deletedAt = new Date();
    tile.deletedBy = req.user._id;
    await tile.save();

    logger.info(`Tile "${tile.name}" soft deleted by ${req.user.username}`);
    res.status(200).json({ message: 'Tile archived successfully' });
});

// ===== HARD DELETE TILE =====
export const hardDeleteTile = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const tile = await Tile.findOne({ _id: id, deleted: true }).select('+deleted +deletedAt +deletedBy');
    if (!tile) {
        res.status(404);
        throw new Error('Tile not found or not archived');
    }

    const hasBookings = await Booking.exists({ 'items.tile': id });
    const hasPurchaseOrders = await PurchaseOrder.exists({ 'items.tile': id });
    const hasRestockRequests = await RestockRequest.exists({ tile: id });
    const hasPallets = await Pallet.exists({ tile: id });

    if (hasBookings || hasPurchaseOrders || hasRestockRequests || hasPallets) {
        res.status(400);
        throw new Error('Cannot permanently delete tile. It has related records.');
    }

    await Tile.deleteOne({ _id: id });
    logger.info(`Tile "${tile.name}" permanently deleted by ${req.user.username}`);
    res.status(200).json({ message: 'Tile permanently deleted' });
});

// ===== GET UNIQUE SIZES =====
export const getUniqueSizes = asyncHandler(async (req, res) => {
    const sizes = await Tile.distinct('size', { deleted: { $ne: true } });
    res.status(200).json(sizes.filter(Boolean).sort());
});

export const getUniqueTileSizes = getUniqueSizes;

// ===== GET UNIQUE SURFACES =====
export const getUniqueSurfaces = asyncHandler(async (req, res) => {
    const usedSurfaces = await Tile.distinct('surface', { deleted: { $ne: true } });
    res.status(200).json({ used: usedSurfaces.filter(Boolean).sort(), available: VALID_SURFACES });
});

// ===== GET ALL TILES FOR DROPDOWN =====
export const getAllTilesForDropdown = asyncHandler(async (req, res) => {
    const tiles = await Tile.find({ deleted: { $ne: true } }).select('name size conversionFactor').sort({ name: 1 });
    res.status(200).json(tiles);
});

// ===== GET TILES BY FACTORY =====
export const getTilesByFactory = asyncHandler(async (req, res) => {
    const { factoryId } = req.params;
    const tiles = await Tile.find({ manufacturingFactories: factoryId, deleted: { $ne: true } })
        .populate('manufacturingFactories', 'name').sort({ name: 1 });
    res.status(200).json(tiles);
});

// ===== GET TILE STOCK DETAILS WITH TRANSIT BREAKDOWN =====
export const getTileStockDetails = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const tileObjectId = new mongoose.Types.ObjectId(id);

    // Get tile details
    const tile = await Tile.findOne({ _id: id, deleted: { $ne: true } })
        .populate('manufacturingFactories', 'name address')
        .populate('createdBy', 'username')
        .lean();

    if (!tile) {
        res.status(404);
        throw new Error('Tile not found');
    }

    // Get factory stock
    const factoryStockAgg = await Pallet.aggregate([
        { $match: { tile: tileObjectId, status: 'InFactoryStock' } },
        {
            $group: {
                _id: '$factory',
                palletCount: { $sum: { $cond: [{ $eq: ['$type', 'Pallet'] }, 1, 0] } },
                khatliCount: { $sum: { $cond: [{ $eq: ['$type', 'Khatli'] }, 1, 0] } },
                totalBoxes: { $sum: '$boxCount' }
            }
        },
        { $lookup: { from: 'factories', localField: '_id', foreignField: '_id', as: 'factoryInfo' } },
        { $unwind: { path: '$factoryInfo', preserveNullAndEmptyArrays: true } },
        {
            $project: {
                _id: 0, factoryId: '$_id',
                factoryName: { $ifNull: ['$factoryInfo.name', 'Unknown'] },
                pallets: '$palletCount', khatlis: '$khatliCount', boxes: '$totalBoxes'
            }
        },
        { $sort: { factoryName: 1 } }
    ]);

    const totalFactoryStock = factoryStockAgg.reduce((sum, f) => sum + f.boxes, 0);

    // Get transit data from "In Transit" dispatch orders for this specific tile
    const transitData = await calculateTransitStockFromDispatches();
    const tileTransit = transitData.transitByTile.get(id);

    // Get loaded stock (in containers but NOT in any dispatch or in non-In Transit dispatches)
    const loadedStockAgg = await Pallet.aggregate([
        {
            $match: {
                tile: tileObjectId,
                status: 'LoadedInContainer'
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
        { $unwind: { path: '$containerInfo', preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: 'dispatchorders',
                localField: 'containerInfo.dispatchOrder',
                foreignField: '_id',
                as: 'dispatchInfo'
            }
        },
        { $unwind: { path: '$dispatchInfo', preserveNullAndEmptyArrays: true } },
        {
            $match: {
                $or: [
                    { 'dispatchInfo': null },
                    { 'dispatchInfo.status': { $ne: 'In Transit' } }
                ]
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
            total: tileTransit?.boxes || 0,
            pallets: tileTransit?.pallets || 0,
            khatlis: tileTransit?.khatlis || 0,
            byDispatchOrder: tileTransit?.byDispatchOrder || []
        },
        loadedStock: { 
            total: loadedStock.total 
        }
    });
});

// ===== GET DELETED TILES =====
export const getDeletedTiles = asyncHandler(async (req, res) => {
    const deletedTiles = await Tile.find({ deleted: true })
        .select('+deleted +deletedAt +deletedBy')
        .populate('deletedBy', 'username')
        .populate('manufacturingFactories', 'name')
        .sort({ deletedAt: -1 });
    res.status(200).json(deletedTiles);
});

// ===== RESTORE TILE =====
export const restoreTile = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const tile = await Tile.findOne({ _id: id, deleted: true }).select('+deleted +deletedAt +deletedBy');
    
    if (!tile) {
        res.status(404);
        throw new Error('Tile not found or not deleted');
    }

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
    res.status(200).json({ message: 'Tile restored successfully', tile });
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
    
    // Get ACTIVE tiles
    const existingTiles = await Tile.find({ deleted: { $ne: true } })
        .select('name number');
    
    // Get SOFT-DELETED tiles
    const softDeletedTiles = await Tile.find({ deleted: true })
        .select('name number _id +deleted');
    
    // Get all factories
    const Factory = mongoose.model('Factory');
    const allFactories = await Factory.find({ deleted: { $ne: true } })
        .select('name _id');
    
    // Create factory name map
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
    const factoriesToCreate = new Map();

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
            let surface = String(tile.surface).trim();
            // Normalize common variations
            if (surface.toLowerCase() === 'matt') surface = 'Matt';
            if (surface.toLowerCase() === 'glossy') surface = 'Glossy';
            
            if (!VALID_SURFACES.includes(surface)) {
                errors.push(`Surface must be one of: ${VALID_SURFACES.join(', ')}`);
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
                
                if (factoryMap.has(factoryKey)) {
                    factoryIds.push(factoryMap.get(factoryKey));
                }
                else if (factoriesToCreate.has(factoryKey)) {
                    factoryIds.push(factoryKey);
                }
                else {
                    if (createNew) {
                        factoriesToCreate.set(factoryKey, {
                            name: factoryName,
                            address: 'To be updated',
                            contactPerson: 'To be updated',
                            contactNumber: 'To be updated',
                            status: 'pending_details',
                            createdBy: req.user._id
                        });
                        factoryIds.push(factoryKey);
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
            let surface = String(tile.surface).trim();
            if (surface.toLowerCase() === 'matt') surface = 'Matt';
            if (surface.toLowerCase() === 'glossy') surface = 'Glossy';
            
            tilesToCreate.push({
                name: String(tile.name).trim(),
                number: (tile.number && String(tile.number).trim() !== '') ? String(tile.number).trim() : undefined,
                surface: surface,
                size: String(tile.size).trim(),
                conversionFactor: Number(tile.conversionFactor),
                restockThreshold: Number(tile.restockThreshold) || 0,
                imageUrl: tile.imageUrl ? String(tile.imageUrl).trim() : '',
                stockDetails: { 
                    availableStock: Number(tile.initialStock) || 0, 
                    bookedStock: 0, 
                    restockingStock: 0 
                },
                manufacturingFactories: factoryIds,
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
        const factoryIdMap = new Map();
        
        if (factoriesToCreate.size > 0) {
            const newFactories = Array.from(factoriesToCreate.values());
            const createdFactories = await Factory.insertMany(newFactories, { session });
            
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
        
        // Step 2: Replace temporary factory keys with real IDs
        for (const tile of tilesToCreate) {
            tile.manufacturingFactories = tile.manufacturingFactories.map(idOrKey => {
                if (typeof idOrKey === 'string' && factoryIdMap.has(idOrKey)) {
                    return factoryIdMap.get(idOrKey);
                }
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

// ===== UPDATE STOCK =====
export const updateStock = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { availableStock, bookedStock, restockingStock, inFactoryStock, inTransitStock } = req.body;

    const tile = await Tile.findOne({ _id: id, deleted: { $ne: true } });
    if (!tile) {
        res.status(404);
        throw new Error('Tile not found');
    }

    if (availableStock !== undefined) tile.stockDetails.availableStock = Number(availableStock);
    if (bookedStock !== undefined) tile.stockDetails.bookedStock = Number(bookedStock);
    if (restockingStock !== undefined) tile.stockDetails.restockingStock = Number(restockingStock);
    if (inFactoryStock !== undefined) tile.stockDetails.inFactoryStock = Number(inFactoryStock);
    if (inTransitStock !== undefined) tile.stockDetails.inTransitStock = Number(inTransitStock);

    await tile.save();
    res.status(200).json({ message: 'Stock updated successfully', stockDetails: tile.stockDetails });
});

// ===== ADJUST STOCK =====
export const adjustStock = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { adjustment, reason } = req.body;

    if (adjustment === undefined || adjustment === 0) {
        res.status(400);
        throw new Error('Adjustment value is required and cannot be zero');
    }

    const tile = await Tile.findOne({ _id: id, deleted: { $ne: true } });
    if (!tile) {
        res.status(404);
        throw new Error('Tile not found');
    }

    const previousStock = tile.stockDetails.availableStock;
    const newStock = previousStock + Number(adjustment);

    if (newStock < 0) {
        res.status(400);
        throw new Error(`Cannot reduce stock below 0. Current: ${previousStock}, Adjustment: ${adjustment}`);
    }

    tile.stockDetails.availableStock = newStock;
    await tile.save();

    logger.info(`Stock adjusted for tile "${tile.name}" by ${req.user.username}. Previous: ${previousStock}, New: ${newStock}`);
    res.status(200).json({ message: 'Stock adjusted successfully', previousStock, newStock, adjustment: Number(adjustment), reason: reason || 'Not specified' });
});

export default {
    createTile, getAllTiles, getTileById, updateTile, deleteTile, hardDeleteTile,
    getUniqueSizes, getUniqueTileSizes, getUniqueSurfaces, getAllTilesForDropdown,
    getTilesByFactory, getTileStockDetails, getTilesForBooking, getDeletedTiles,
    restoreTile, bulkCreateTiles, updateStock, adjustStock
};