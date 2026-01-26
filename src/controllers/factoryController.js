// // FILE: backend/src/controllers/factoryController.js
// // COMPLETE FILE - Replace entire file

// import asyncHandler from '../utils/asyncHandler.js';
// import Factory from '../models/factoryModel.js';
// import Pallet from '../models/palletModel.js';
// import Container from '../models/containerModel.js';
// import PurchaseOrder from '../models/purchaseOrderModel.js';
// import LoadingPlan from '../models/loadingPlanModel.js';

// // ===== CREATE FACTORY =====
// export const createFactory = asyncHandler(async (req, res) => {
//     const { name, address, contactPerson } = req.body;
    
//     if (!name) {
//         res.status(400);
//         throw new Error('Factory name is required.');
//     }
    
//     const factoryExists = await Factory.findOne({ name, deleted: { $ne: true } });
//     if (factoryExists) {
//         res.status(400);
//         throw new Error('A factory with this name already exists.');
//     }
    
//     const factory = await Factory.create({ 
//         name, 
//         address, 
//         contactPerson,
//         createdBy: req.user._id
//     });
    
//     res.status(201).json(factory);
// });

// // ===== GET ALL FACTORIES =====
// export const getAllFactories = asyncHandler(async (req, res) => {
//     const factories = await Factory.find({ deleted: { $ne: true } })
//         .sort({ name: 1 });
//     res.status(200).json(factories);
// });

// // ===== GET FACTORY BY ID =====
// export const getFactoryById = asyncHandler(async (req, res) => {
//     const factory = await Factory.findOne({ 
//         _id: req.params.id, 
//         deleted: { $ne: true } 
//     });
    
//     if (!factory) {
//         res.status(404);
//         throw new Error('Factory not found');
//     }
    
//     res.status(200).json(factory);
// });

// // ===== UPDATE FACTORY =====
// export const updateFactory = asyncHandler(async (req, res) => {
//     const { id } = req.params;
//     const { name, address, contactPerson } = req.body;

//     const factory = await Factory.findOne({ _id: id, deleted: { $ne: true } });
//     if (!factory) {
//         res.status(404);
//         throw new Error('Factory not found');
//     }

//     // Check for duplicate name if name is being changed
//     if (name && name !== factory.name) {
//         const existingFactory = await Factory.findOne({ 
//             name, 
//             _id: { $ne: id },
//             deleted: { $ne: true }
//         });
//         if (existingFactory) {
//             res.status(400);
//             throw new Error('A factory with this name already exists.');
//         }
//     }

//     factory.name = name || factory.name;
//     factory.address = address !== undefined ? address : factory.address;
//     factory.contactPerson = contactPerson !== undefined ? contactPerson : factory.contactPerson;

//     const updatedFactory = await factory.save();
//     res.status(200).json(updatedFactory);
// });

// // ===== DELETE FACTORY =====
// export const deleteFactory = asyncHandler(async (req, res) => {
//     const { id } = req.params;
//     const { force } = req.body;

//     const factory = await Factory.findOne({ _id: id, deleted: { $ne: true } });
//     if (!factory) {
//         res.status(404);
//         throw new Error('Factory not found');
//     }

//     // 1. CHECK FOR EXISTING PALLETS
//     const palletCount = await Pallet.countDocuments({ 
//         factory: id, 
//         status: 'InFactoryStock' 
//     });

//     // 2. CHECK FOR CONTAINERS
//     const containerCount = await Container.countDocuments({ 
//         factory: id,
//         status: { $nin: ['Delivered'] }
//     });

//     // 3. CHECK FOR PENDING/ACTIVE POs
//     const poCount = await PurchaseOrder.countDocuments({ 
//         factory: id,
//         status: { $nin: ['Completed', 'Cancelled'] },
//         deleted: { $ne: true }
//     });

//     // 4. CHECK FOR LOADING PLANS
//     const loadingPlanCount = await LoadingPlan.countDocuments({ 
//         factory: id,
//         status: { $nin: ['Dispatched'] }
//     });

//     // Build error message if related data exists
//     const relatedDataMessages = [];
//     if (palletCount > 0) {
//         relatedDataMessages.push(`${palletCount} pallets/khatlis in stock`);
//     }
//     if (containerCount > 0) {
//         relatedDataMessages.push(`${containerCount} active containers`);
//     }
//     if (poCount > 0) {
//         relatedDataMessages.push(`${poCount} pending purchase orders`);
//     }
//     if (loadingPlanCount > 0) {
//         relatedDataMessages.push(`${loadingPlanCount} active loading plans`);
//     }

//     // If related data exists and not force delete
//     if (relatedDataMessages.length > 0 && !force) {
//         res.status(400);
//         throw new Error(
//             `Cannot delete factory "${factory.name}". Related data exists: ${relatedDataMessages.join(', ')}. ` +
//             `Please remove or reassign this data first.`
//         );
//     }

//     // 5. SOFT DELETE THE FACTORY
//     factory.deleted = true;
//     factory.deletedAt = new Date();
//     factory.deletedBy = req.user._id;
//     await factory.save();

//     res.status(200).json({
//         message: 'Factory deleted successfully',
//         factoryName: factory.name,
//         warning: relatedDataMessages.length > 0 
//             ? `Force deleted with existing: ${relatedDataMessages.join(', ')}` 
//             : null
//     });
// });

// // ===== GET FACTORY WITH STOCK SUMMARY =====
// export const getFactoryWithStock = asyncHandler(async (req, res) => {
//     const { id } = req.params;

//     const factory = await Factory.findOne({ _id: id, deleted: { $ne: true } });
//     if (!factory) {
//         res.status(404);
//         throw new Error('Factory not found');
//     }

//     // Get stock summary
//     const stockSummary = await Pallet.aggregate([
//         { $match: { factory: factory._id, status: 'InFactoryStock' } },
//         {
//             $group: {
//                 _id: '$type',
//                 count: { $sum: 1 },
//                 totalBoxes: { $sum: '$boxCount' }
//             }
//         }
//     ]);

//     const palletSummary = stockSummary.find(s => s._id === 'Pallet') || { count: 0, totalBoxes: 0 };
//     const khatliSummary = stockSummary.find(s => s._id === 'Khatli') || { count: 0, totalBoxes: 0 };

//     res.status(200).json({
//         factory,
//         stock: {
//             pallets: palletSummary.count,
//             khatlis: khatliSummary.count,
//             totalPalletBoxes: palletSummary.totalBoxes,
//             totalKhatliBoxes: khatliSummary.totalBoxes,
//             totalBoxes: palletSummary.totalBoxes + khatliSummary.totalBoxes
//         }
//     });
// });

// // ===== GET DELETED FACTORIES (Admin) =====
// export const getDeletedFactories = asyncHandler(async (req, res) => {
//     const deletedFactories = await Factory.find({ deleted: true })
//         .select('+deleted +deletedAt +deletedBy')
//         .populate('deletedBy', 'username')
//         .sort({ deletedAt: -1 });

//     res.status(200).json(deletedFactories);
// });

// // ===== RESTORE FACTORY (Admin) =====
// export const restoreFactory = asyncHandler(async (req, res) => {
//     const { id } = req.params;

//     const factory = await Factory.findOne({ _id: id }).select('+deleted +deletedAt');
    
//     if (!factory) {
//         res.status(404);
//         throw new Error('Factory not found');
//     }

//     if (!factory.deleted) {
//         res.status(400);
//         throw new Error('Factory is not deleted');
//     }

//     // Check if a factory with same name exists
//     const existingFactory = await Factory.findOne({ 
//         name: factory.name, 
//         _id: { $ne: id },
//         deleted: { $ne: true }
//     });
    
//     if (existingFactory) {
//         res.status(400);
//         throw new Error(`Cannot restore. Another factory with name "${factory.name}" already exists.`);
//     }

//     factory.deleted = false;
//     factory.deletedAt = undefined;
//     factory.deletedBy = undefined;
//     await factory.save();

//     res.status(200).json({
//         message: 'Factory restored successfully',
//         factory
//     });
// });

// FILE: backend/src/controllers/factoryController.js
// COMPLETE ERROR-FREE VERSION

import asyncHandler from '../utils/asyncHandler.js';
import Factory from '../models/factoryModel.js';
import Pallet from '../models/palletModel.js';
import Container from '../models/containerModel.js';
import PurchaseOrder from '../models/purchaseOrderModel.js';
import LoadingPlan from '../models/loadingPlanModel.js';
import Tile from '../models/tileModel.js';
import mongoose from 'mongoose';

// ===== CREATE FACTORY =====
export const createFactory = asyncHandler(async (req, res) => {
    const { name, address, contactPerson, contactNumber, email, status, notes } = req.body;
    
    if (!name) {
        res.status(400);
        throw new Error('Factory name is required.');
    }
    
    const factoryExists = await Factory.findOne({ name, deleted: { $ne: true } });
    if (factoryExists) {
        res.status(400);
        throw new Error('A factory with this name already exists.');
    }
    
    const factory = await Factory.create({ 
        name, 
        address, 
        contactPerson,
        contactNumber,
        email,
        status: status || 'Active',
        notes,
        createdBy: req.user._id
    });
    
    res.status(201).json(factory);
});

// ===== GET ALL FACTORIES =====
export const getAllFactories = asyncHandler(async (req, res) => {
    const { status, includeInactive } = req.query;
    
    const query = { deleted: { $ne: true } };
    
    // Filter by status if provided
    if (status) {
        query.status = status;
    } else if (includeInactive !== 'true') {
        // By default, only show Active and Maintenance factories
        query.status = { $in: ['Active', 'Maintenance'] };
    }
    
    const factories = await Factory.find(query)
        .populate('createdBy', 'username')
        .sort({ name: 1 });
        
    res.status(200).json(factories);
});

// ===== GET FACTORY BY ID =====
export const getFactoryById = asyncHandler(async (req, res) => {
    const factory = await Factory.findOne({ 
        _id: req.params.id, 
        deleted: { $ne: true } 
    })
    .populate('createdBy', 'username');
    
    if (!factory) {
        res.status(404);
        throw new Error('Factory not found');
    }
    
    res.status(200).json(factory);
});

// ===== GET FACTORY DETAILS WITH TILES =====
export const getFactoryDetails = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const factory = await Factory.findOne({ _id: id, deleted: { $ne: true } })
        .populate('createdBy', 'username');
    
    if (!factory) {
        res.status(404);
        throw new Error('Factory not found');
    }
    
    // Get tiles manufactured by this factory
    const tiles = await Tile.find({ 
        manufacturingFactories: id,
        deleted: { $ne: true }
    }).select('name number size surface');
    
    // Get stock breakdown by tile
    const stockByTile = await Pallet.aggregate([
        {
            $match: {
                factory: new mongoose.Types.ObjectId(id),
                status: 'InFactoryStock'
            }
        },
        {
            $group: {
                _id: '$tile',
                pallets: { $sum: { $cond: [{ $eq: ['$type', 'Pallet'] }, 1, 0] } },
                khatlis: { $sum: { $cond: [{ $eq: ['$type', 'Khatli'] }, 1, 0] } },
                totalBoxes: { $sum: '$boxCount' }
            }
        },
        {
            $lookup: {
                from: 'tiles',
                localField: '_id',
                foreignField: '_id',
                as: 'tileInfo'
            }
        },
        { $unwind: { path: '$tileInfo', preserveNullAndEmptyArrays: true } },
        {
            $project: {
                _id: 0,
                tileId: '$_id',
                tileName: '$tileInfo.name',
                tileNumber: '$tileInfo.number',
                tileSize: '$tileInfo.size',
                pallets: 1,
                khatlis: 1,
                totalBoxes: 1
            }
        },
        { $sort: { totalBoxes: -1 } }
    ]);
    
    const stats = {
        totalTiles: tiles.length,
        totalPallets: stockByTile.reduce((sum, s) => sum + (s.pallets || 0), 0),
        totalKhatlis: stockByTile.reduce((sum, s) => sum + (s.khatlis || 0), 0),
        totalBoxes: stockByTile.reduce((sum, s) => sum + (s.totalBoxes || 0), 0)
    };
    
    res.status(200).json({
        factory,
        tiles,
        stockByTile,
        stats
    });
});

// ===== UPDATE FACTORY =====
export const updateFactory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, address, contactPerson, contactNumber, email, status, notes } = req.body;

    const factory = await Factory.findOne({ _id: id, deleted: { $ne: true } });
    if (!factory) {
        res.status(404);
        throw new Error('Factory not found');
    }

    // Check for duplicate name if name is being changed
    if (name && name !== factory.name) {
        const existingFactory = await Factory.findOne({ 
            name, 
            _id: { $ne: id },
            deleted: { $ne: true }
        });
        if (existingFactory) {
            res.status(400);
            throw new Error('A factory with this name already exists.');
        }
    }

    // Update fields
    factory.name = name || factory.name;
    factory.address = address !== undefined ? address : factory.address;
    factory.contactPerson = contactPerson !== undefined ? contactPerson : factory.contactPerson;
    factory.contactNumber = contactNumber !== undefined ? contactNumber : factory.contactNumber;
    factory.email = email !== undefined ? email : factory.email;
    factory.status = status || factory.status;
    factory.notes = notes !== undefined ? notes : factory.notes;

    const updatedFactory = await factory.save();
    
    res.status(200).json(updatedFactory);
});

// ===== UPDATE FACTORY STATUS =====
export const updateFactoryStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!['Active', 'Inactive', 'Discontinued', 'Maintenance'].includes(status)) {
        res.status(400);
        throw new Error('Invalid status. Must be Active, Inactive, Discontinued, or Maintenance.');
    }

    const factory = await Factory.findOne({ _id: id, deleted: { $ne: true } });
    if (!factory) {
        res.status(404);
        throw new Error('Factory not found');
    }

    const oldStatus = factory.status;
    factory.status = status;
    if (notes) {
        factory.notes = notes;
    }
    
    await factory.save();

    res.status(200).json({
        message: `Factory status updated from ${oldStatus} to ${status}`,
        factory
    });
});

// ===== DELETE FACTORY (Soft Delete) =====
export const deleteFactory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { force } = req.body;

    const factory = await Factory.findOne({ _id: id, deleted: { $ne: true } });
    if (!factory) {
        res.status(404);
        throw new Error('Factory not found');
    }

    // Check for related data
    const palletCount = await Pallet.countDocuments({ 
        factory: id, 
        status: 'InFactoryStock' 
    });

    const containerCount = await Container.countDocuments({ 
        factory: id,
        status: { $nin: ['Delivered'] }
    });

    const poCount = await PurchaseOrder.countDocuments({ 
        factory: id,
        status: { $nin: ['Completed', 'Cancelled'] },
        deleted: { $ne: true }
    });

    const loadingPlanCount = await LoadingPlan.countDocuments({ 
        factory: id,
        status: { $nin: ['Dispatched'] }
    });

    // Build warning message
    const relatedDataMessages = [];
    if (palletCount > 0) {
        relatedDataMessages.push(`${palletCount} pallets/khatlis in stock`);
    }
    if (containerCount > 0) {
        relatedDataMessages.push(`${containerCount} active containers`);
    }
    if (poCount > 0) {
        relatedDataMessages.push(`${poCount} pending purchase orders`);
    }
    if (loadingPlanCount > 0) {
        relatedDataMessages.push(`${loadingPlanCount} active loading plans`);
    }

    // Block delete if related data exists and not force
    if (relatedDataMessages.length > 0 && !force) {
        res.status(400);
        throw new Error(
            `Cannot delete factory "${factory.name}". Related data exists: ${relatedDataMessages.join(', ')}. ` +
            `Please complete or cancel related items first, or change factory status to "Discontinued".`
        );
    }

    // SOFT DELETE
    factory.deleted = true;
    factory.deletedAt = new Date();
    factory.deletedBy = req.user._id;
    await factory.save();

    res.status(200).json({
        message: 'Factory deleted successfully',
        factoryName: factory.name,
        warning: relatedDataMessages.length > 0 
            ? `Deleted with existing: ${relatedDataMessages.join(', ')}. Stock is now assigned to deleted factory.` 
            : null
    });
});

// ===== GET FACTORY WITH STOCK SUMMARY =====
export const getFactoryWithStock = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const factory = await Factory.findOne({ _id: id, deleted: { $ne: true } });
    if (!factory) {
        res.status(404);
        throw new Error('Factory not found');
    }

    // Get stock summary
    const stockSummary = await Pallet.aggregate([
        { $match: { factory: factory._id, status: 'InFactoryStock' } },
        {
            $group: {
                _id: '$type',
                count: { $sum: 1 },
                totalBoxes: { $sum: '$boxCount' }
            }
        }
    ]);

    const palletSummary = stockSummary.find(s => s._id === 'Pallet') || { count: 0, totalBoxes: 0 };
    const khatliSummary = stockSummary.find(s => s._id === 'Khatli') || { count: 0, totalBoxes: 0 };

    res.status(200).json({
        factory,
        stock: {
            pallets: palletSummary.count,
            khatlis: khatliSummary.count,
            totalPalletBoxes: palletSummary.totalBoxes,
            totalKhatliBoxes: khatliSummary.totalBoxes,
            totalBoxes: palletSummary.totalBoxes + khatliSummary.totalBoxes
        }
    });
});

// ===== GET DELETED FACTORIES (Admin) =====
export const getDeletedFactories = asyncHandler(async (req, res) => {
    const deletedFactories = await Factory.find({ deleted: true })
        .select('+deleted +deletedAt +deletedBy')
        .populate('deletedBy', 'username')
        .sort({ deletedAt: -1 });

    res.status(200).json(deletedFactories);
});

// ===== RESTORE FACTORY (Admin) =====
export const restoreFactory = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const factory = await Factory.findOne({ _id: id, deleted: true })
        .select('+deleted +deletedAt +deletedBy');
    
    if (!factory) {
        res.status(404);
        throw new Error('Factory not found or not deleted');
    }

    // Check if a factory with same name exists
    const existingFactory = await Factory.findOne({ 
        name: factory.name, 
        _id: { $ne: id },
        deleted: { $ne: true }
    });
    
    if (existingFactory) {
        res.status(400);
        throw new Error(`Cannot restore. Another factory with name "${factory.name}" already exists.`);
    }

    factory.deleted = false;
    factory.deletedAt = undefined;
    factory.deletedBy = undefined;
    await factory.save();

    res.status(200).json({
        message: 'Factory restored successfully',
        factory
    });
});