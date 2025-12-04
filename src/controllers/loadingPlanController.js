import mongoose from 'mongoose';
import asyncHandler from '../utils/asyncHandler.js';
import LoadingPlan from '../models/loadingPlanModel.js';
import Container from '../models/containerModel.js';
import Pallet from '../models/palletModel.js';
import { generateId } from '../services/idGenerator.js';

/**
 * @desc    Create a new Loading Plan
 * @route   POST /api/loading-plans
 * @access  Private
 */
export const createLoadingPlan = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { factoryId, containers } = req.body;

    // Validation
    if (!factoryId) {
        res.status(400);
        throw new Error('Factory ID is required.');
    }
    if (!containers || !Array.isArray(containers) || containers.length === 0) {
        res.status(400);
        throw new Error('At least one container is required.');
    }
    
    for (const c of containers) {
        if (!c.containerNumber || !c.truckNumber || !c.pallets || c.pallets.length === 0) {
            res.status(400);
            throw new Error(`Data is missing. Each container must have a container number, truck number, and at least one pallet.`);
        }
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Generate loadingPlanId BEFORE creating the LoadingPlan
        const loadingPlanId = await generateId('LP');
        
        const loadingPlan = new LoadingPlan({
            loadingPlanId: loadingPlanId,  // Explicitly set the generated ID
            factory: factoryId,
            createdBy: userId,
            containers: [],
        });
        
        const createdContainerIds = [];

        for (const c of containers) {
            // Generate containerId BEFORE creating the Container
            const containerId = await generateId('CN');
            
            const newContainer = new Container({
                containerId: containerId,  // Explicitly set the generated ID
                containerNumber: c.containerNumber,
                truckNumber: c.truckNumber,
                pallets: c.pallets,
                loadingPlan: loadingPlan._id,
            });
            
            const savedContainer = await newContainer.save({ session });
            createdContainerIds.push(savedContainer._id);

            // Update pallet statuses
            await Pallet.updateMany(
                { _id: { $in: c.pallets }, status: 'InFactoryStock' },
                { $set: { status: 'LoadedInContainer', container: savedContainer._id } },
                { session }
            );
        }

        loadingPlan.containers = createdContainerIds;
        await loadingPlan.save({ session });

        await session.commitTransaction();
        
        res.status(201).json({
            message: 'Loading Plan created successfully!',
            loadingPlanId: loadingPlan.loadingPlanId,
        });

    } catch (error) {
        await session.abortTransaction();
        res.status(400).json({ message: error.message });
    } finally {
        session.endSession();
    }
});

/**
 * @desc    Get all Loading Plans
 * @route   GET /api/loading-plans
 * @access  Private
 */
export const getLoadingPlans = asyncHandler(async (req, res) => {
    const plans = await LoadingPlan.find({})
        .populate('factory', 'name')
        .populate('createdBy', 'name')
        .populate({
            path: 'containers',
            populate: {
                path: 'pallets',
                select: 'palletId tile status'
            }
        })
        .sort({ createdAt: -1 });

    res.status(200).json(plans);
});

/**
 * @desc    Get a single Loading Plan by ID
 * @route   GET /api/loading-plans/:id
 * @access  Private
 */
/**
 * @desc    Get a single Loading Plan by ID
 * @route   GET /api/loading-plans/:id
 * @access  Private
 */
export const getLoadingPlanById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // This is a highly detailed population, perfect for a detail modal.
    // It fetches the plan, its factory, creator, containers, and for each container,
    // it fetches the pallets, and for each pallet, it fetches the tile details.
    const plan = await LoadingPlan.findById(id)
        .populate('factory', 'name')
        .populate('createdBy', 'name')
        .populate({
            path: 'containers',
            populate: {
                path: 'pallets',
                model: 'Pallet', // Explicitly specify the model
                populate: {
                    path: 'tile',
                    model: 'Tile', // Explicitly specify the model
                    select: 'name'
                }
            }
        });

    if (!plan) {
        res.status(404);
        throw new Error('Loading Plan not found');
    }

    res.status(200).json(plan);
});
/**
 * @desc    Update Loading Plan status
 * @route   PUT /api/loading-plans/:id/status
 * @access  Private
 */
export const updateLoadingPlanStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['Finalized', 'Dispatched'];
    if (!validStatuses.includes(status)) {
        res.status(400);
        throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const plan = await LoadingPlan.findByIdAndUpdate(
        id,
        { status },
        { new: true, runValidators: true }
    );

    if (!plan) {
        res.status(404);
        throw new Error('Loading Plan not found');
    }

    res.status(200).json({
        message: 'Loading Plan status updated successfully',
        plan
    });
});

/**
 * @desc    Delete a Loading Plan
 * @route   DELETE /api/loading-plans/:id
 * @access  Private
 */
export const deleteLoadingPlan = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const plan = await LoadingPlan.findByIdAndDelete(id);

    if (!plan) {
        res.status(404);
        throw new Error('Loading Plan not found');
    }

    // Delete associated containers
    await Container.deleteMany({ loadingPlan: id });

    res.status(200).json({
        message: 'Loading Plan deleted successfully',
        loadingPlanId: plan.loadingPlanId
    });
});

/**
 * @desc    Get Loading Plans by Factory
 * @route   GET /api/loading-plans/factory/:factoryId
 * @access  Private
 */
export const getLoadingPlansByFactory = asyncHandler(async (req, res) => {
    const { factoryId } = req.params;

    const plans = await LoadingPlan.find({ factory: factoryId })
        .populate('factory', 'name')
        .populate('createdBy', 'name')
        .populate({
            path: 'containers',
            populate: {
                path: 'pallets',
                select: 'palletId tile status'
            }
        })
        .sort({ createdAt: -1 });

    res.status(200).json(plans);
});
