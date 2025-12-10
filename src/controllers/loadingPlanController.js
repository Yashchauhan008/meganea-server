import mongoose from 'mongoose';
import asyncHandler from '../utils/asyncHandler.js';
import LoadingPlan from '../models/loadingPlanModel.js';
import Container from '../models/containerModel.js';
import Pallet from '../models/palletModel.js';
import { generateId } from '../services/idGenerator.js';

const deepPopulate = [
    {
        path: 'factory',
        select: 'name'
    },
    {
        path: 'createdBy',
        select: 'username' // <-- THE FIX: Use 'username' to match the User model
    },
    {
        path: 'containers',
        populate: {
            path: 'pallets',
            model: 'Pallet',
            populate: [
                { path: 'tile', model: 'Tile', select: 'name size' },
                { path: 'factory', model: 'Factory', select: 'name' }
            ]
        }
    }
];

/**
 * @desc    Create a new Loading Plan
 * @route   POST /api/loading-plans
 * @access  Private
 */
export const createLoadingPlan = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { factoryId, containers, loadingDate } = req.body;

    if (!factoryId) {
        res.status(400).throw(new Error('Factory ID is required.'));
    }
    if (!containers || !Array.isArray(containers) || containers.length === 0) {
        res.status(400).throw(new Error('At least one container is required.'));
    }
    
    for (const c of containers) {
        if (!c.containerNumber || !c.truckNumber || !c.pallets || c.pallets.length === 0) {
            res.status(400).throw(new Error(`Data is missing. Each container must have a container number, truck number, and at least one pallet.`));
        }
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const loadingPlanId = await generateId('LP');
        
        const loadingPlan = new LoadingPlan({
            loadingPlanId: loadingPlanId,
            factory: factoryId,
            createdBy: userId,
            loadingDate: loadingDate,
            containers: [],
        });
        
        const createdContainerIds = [];

        for (const c of containers) {
            const containerId = await generateId('CN');
            
            const newContainer = new Container({
                containerId: containerId,
                containerNumber: c.containerNumber,
                truckNumber: c.truckNumber,
                pallets: c.pallets,
                loadingPlan: loadingPlan._id,
                createdBy: userId,
                factory: factoryId,
            });
            
            const savedContainer = await newContainer.save({ session });
            createdContainerIds.push(savedContainer._id);

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


export const getLoadingPlans = asyncHandler(async (req, res) => {
    const plans = await LoadingPlan.find({}).populate(deepPopulate).sort({ createdAt: -1 });
    res.status(200).json(plans);
});

export const getLoadingPlanById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const plan = await LoadingPlan.findById(id).populate(deepPopulate);
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
    const { containers: updatedContainersData, loadingDate } = req.body;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const plan = await LoadingPlan.findById(id).populate('containers').session(session);
        if (!plan) {
            throw new Error('Loading Plan not found');
        }

        // --- 1. Update simple fields ---
        plan.loadingDate = loadingDate || plan.loadingDate;

        // --- 2. Get a complete picture of all pallets involved ---
        const originalPalletIdsInPlan = new Set(plan.containers.flatMap(c => c.pallets.map(p => p.toString())));
        const finalPalletIdsInPlan = new Set(updatedContainersData.flatMap(c => c.pallets)); // These are just strings now

        // --- 3. Determine which pallets to add and which to revert ---
        const palletsToRevert = [...originalPalletIdsInPlan].filter(pId => !finalPalletIdsInPlan.has(pId));
        const palletsToAssign = [...finalPalletIdsInPlan].filter(pId => !originalPalletIdsInPlan.has(pId));

        // --- 4. Perform database updates ---
        if (palletsToRevert.length > 0) {
            await Pallet.updateMany(
                { _id: { $in: palletsToRevert } },
                { $set: { status: 'InFactoryStock', container: null } },
                { session }
            );
        }

        // Process each container to update its details and assign new pallets
        for (const updatedContainer of updatedContainersData) {
            await Container.updateOne(
                { _id: updatedContainer._id },
                {
                    $set: {
                        containerNumber: updatedContainer.containerNumber,
                        truckNumber: updatedContainer.truckNumber,
                        pallets: updatedContainer.pallets, // The final, correct list of pallet IDs
                    }
                },
                { session }
            );

            // Set the status for all pallets that are now in this container
            if (updatedContainer.pallets.length > 0) {
                await Pallet.updateMany(
                    { _id: { $in: updatedContainer.pallets } },
                    { $set: { status: 'LoadedInContainer', container: updatedContainer._id } },
                    { session }
                );
            }
        }
        
        await plan.save({ session });
        await session.commitTransaction();

        const finalPlan = await LoadingPlan.findById(id).populate(deepPopulate);
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
        const plan = await LoadingPlan.findById(id).populate('containers').session(session);
        if (!plan) {
            throw new Error('Loading Plan not found');
        }
        const palletIdsToRevert = plan.containers.flatMap(c => c.pallets);
        if (palletIdsToRevert.length > 0) {
            await Pallet.updateMany({ _id: { $in: palletIdsToRevert } }, { $set: { status: 'InFactoryStock', container: null } }, { session });
        }
        await Container.deleteMany({ _id: { $in: plan.containers.map(c => c._id) } }, { session });
        await LoadingPlan.findByIdAndDelete(id, { session });
        await session.commitTransaction();
        res.status(200).json({ message: 'Loading Plan deleted successfully.' });
    } catch (error) {
        await session.abortTransaction();
        res.status(400).json({ message: error.message });
    } finally {
        session.endSession();
    }
});