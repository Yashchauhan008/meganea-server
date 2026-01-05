// FILE: backend/src/controllers/factoryController.js
// COMPLETE FILE - Replace entire file

import asyncHandler from '../utils/asyncHandler.js';
import Factory from '../models/factoryModel.js';
import Pallet from '../models/palletModel.js';
import Container from '../models/containerModel.js';
import PurchaseOrder from '../models/purchaseOrderModel.js';
import LoadingPlan from '../models/loadingPlanModel.js';

// ===== CREATE FACTORY =====
export const createFactory = asyncHandler(async (req, res) => {
    const { name, address, contactPerson } = req.body;
    
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
        createdBy: req.user._id
    });
    
    res.status(201).json(factory);
});

// ===== GET ALL FACTORIES =====
export const getAllFactories = asyncHandler(async (req, res) => {
    const factories = await Factory.find({ deleted: { $ne: true } })
        .sort({ name: 1 });
    res.status(200).json(factories);
});

// ===== GET FACTORY BY ID =====
export const getFactoryById = asyncHandler(async (req, res) => {
    const factory = await Factory.findOne({ 
        _id: req.params.id, 
        deleted: { $ne: true } 
    });
    
    if (!factory) {
        res.status(404);
        throw new Error('Factory not found');
    }
    
    res.status(200).json(factory);
});

// ===== UPDATE FACTORY =====
export const updateFactory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, address, contactPerson } = req.body;

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

    factory.name = name || factory.name;
    factory.address = address !== undefined ? address : factory.address;
    factory.contactPerson = contactPerson !== undefined ? contactPerson : factory.contactPerson;

    const updatedFactory = await factory.save();
    res.status(200).json(updatedFactory);
});

// ===== DELETE FACTORY =====
export const deleteFactory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { force } = req.body;

    const factory = await Factory.findOne({ _id: id, deleted: { $ne: true } });
    if (!factory) {
        res.status(404);
        throw new Error('Factory not found');
    }

    // 1. CHECK FOR EXISTING PALLETS
    const palletCount = await Pallet.countDocuments({ 
        factory: id, 
        status: 'InFactoryStock' 
    });

    // 2. CHECK FOR CONTAINERS
    const containerCount = await Container.countDocuments({ 
        factory: id,
        status: { $nin: ['Delivered'] }
    });

    // 3. CHECK FOR PENDING/ACTIVE POs
    const poCount = await PurchaseOrder.countDocuments({ 
        factory: id,
        status: { $nin: ['Completed', 'Cancelled'] },
        deleted: { $ne: true }
    });

    // 4. CHECK FOR LOADING PLANS
    const loadingPlanCount = await LoadingPlan.countDocuments({ 
        factory: id,
        status: { $nin: ['Dispatched'] }
    });

    // Build error message if related data exists
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

    // If related data exists and not force delete
    if (relatedDataMessages.length > 0 && !force) {
        res.status(400);
        throw new Error(
            `Cannot delete factory "${factory.name}". Related data exists: ${relatedDataMessages.join(', ')}. ` +
            `Please remove or reassign this data first.`
        );
    }

    // 5. SOFT DELETE THE FACTORY
    factory.deleted = true;
    factory.deletedAt = new Date();
    factory.deletedBy = req.user._id;
    await factory.save();

    res.status(200).json({
        message: 'Factory deleted successfully',
        factoryName: factory.name,
        warning: relatedDataMessages.length > 0 
            ? `Force deleted with existing: ${relatedDataMessages.join(', ')}` 
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

    const factory = await Factory.findOne({ _id: id }).select('+deleted +deletedAt');
    
    if (!factory) {
        res.status(404);
        throw new Error('Factory not found');
    }

    if (!factory.deleted) {
        res.status(400);
        throw new Error('Factory is not deleted');
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