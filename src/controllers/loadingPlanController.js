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
export const getLoadingPlanById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const plan = await LoadingPlan.findById(id)
        .populate('factory', 'name')
        .populate('createdBy', 'name')
        .populate({
            path: 'containers',
            populate: {
                path: 'pallets',
                model: 'Pallet',
                populate: {
                    path: 'tile',
                    model: 'Tile',
                    // FIX: Added 'size' to the fields being selected
                    select: 'name size' 
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

// =================================================================
// NEW FUNCTION: To handle editing a loading plan
// =================================================================
/**
 * @desc    Update an existing Loading Plan
 * @route   PUT /api/loading-plans/:id
 * @access  Private
 */
// =================================================================
// THIS IS THE FULLY CORRECTED AND ROBUST UPDATE FUNCTION
// =================================================================
export const updateLoadingPlan = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { containers: updatedContainers, loadingDate } = req.body;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const plan = await LoadingPlan.findById(id).populate('containers').session(session);
        if (!plan) {
            throw new Error('Loading Plan not found');
        }

        // --- 1. Update the simple fields ---
        if (loadingDate) {
            plan.loadingDate = loadingDate;
        }

        // --- 2. Calculate Pallet Differences ---
        const originalPalletIds = new Set(plan.containers.flatMap(c => c.pallets.map(p => p.toString())));
        const newPalletIds = new Set(updatedContainers.flatMap(c => c.pallets.map(p => p._id.toString())));

        // Pallets to be REMOVED from the plan entirely
        const palletsToRevert = [...originalPalletIds].filter(pid => !newPalletIds.has(pid));
        if (palletsToRevert.length > 0) {
            await Pallet.updateMany(
                { _id: { $in: palletsToRevert } },
                { $set: { status: 'InFactoryStock', container: null } },
                { session }
            );
        }

        // --- 3. Process Each Container ---
        for (const updatedContainerData of updatedContainers) {
            const container = await Container.findById(updatedContainerData._id).session(session);
            if (container) {
                // Update container details
                container.containerNumber = updatedContainerData.containerNumber;
                container.truckNumber = updatedContainerData.truckNumber;
                container.pallets = updatedContainerData.pallets.map(p => p._id);
                await container.save({ session });

                // Update the status and container reference for all pallets NOW in this container
                await Pallet.updateMany(
                    { _id: { $in: container.pallets } },
                    { $set: { status: 'LoadedInContainer', container: container._id } },
                    { session }
                );
            }
        }
        
        // --- 4. Save the main plan document ---
        await plan.save({ session });

        // --- 5. Commit the transaction ---
        await session.commitTransaction();

        // --- 6. Fetch and return the fully populated, updated plan ---
        const finalPlan = await LoadingPlan.findById(id)
            .populate('factory', 'name')
            .populate('createdBy', 'name')
            .populate({
                path: 'containers',
                populate: { path: 'pallets', model: 'Pallet', populate: { path: 'tile', model: 'Tile', select: 'name size' } }
            });

        res.status(200).json(finalPlan);

    } catch (error) {
        await session.abortTransaction();
        res.status(400).json({ message: error.message || 'Failed to update loading plan.' });
    } finally {
        session.endSession();
    }
});

// --- deleteLoadingPlan is correct and remains unchanged ---
export const deleteLoadingPlan = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const plan = await LoadingPlan.findById(id).session(session);
        if (!plan) {
            throw new Error('Loading Plan not found');
        }

        const containersInPlan = await Container.find({ loadingPlan: plan._id }).session(session);
        const allPalletIds = containersInPlan.flatMap(c => c.pallets);

        if (allPalletIds.length > 0) {
            await Pallet.updateMany(
                { _id: { $in: allPalletIds } },
                { $set: { status: 'InFactoryStock', container: null } },
                { session }
            );
        }

        await Container.deleteMany({ loadingPlan: plan._id }, { session });
        await plan.deleteOne({ session });
        await session.commitTransaction();

        res.status(200).json({ message: 'Loading Plan and associated data deleted successfully. Pallet stock has been reverted.' });

    } catch (error) {
        await session.abortTransaction();
        res.status(400).json({ message: error.message || 'Failed to delete loading plan.' });
    } finally {
        session.endSession();
    }
});