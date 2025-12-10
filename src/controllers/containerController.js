import asyncHandler from '../utils/asyncHandler.js';
import Container from '../models/containerModel.js';
import Pallet from '../models/palletModel.js';
import mongoose from 'mongoose';

// =================================================================
// THIS IS THE CORRECTED POPULATION LOGIC
// =================================================================
const deepPopulate = [
    {
        path: 'pallets',
        // Correctly populate the nested documents within the 'pallets' array
        populate: [
            { path: 'tile', model: 'Tile', select: 'name size' },
            { path: 'factory', model: 'Factory', select: 'name' }
        ]
    },
    {
        path: 'loadingPlan',
        select: 'loadingPlanId factory',
        // Correctly populate the factory within the loading plan
        populate: { path: 'factory', model: 'Factory', select: 'name' }
    },
    // Populate the top-level factory and createdBy fields
    { path: 'factory', model: 'Factory', select: 'name' },
    { path: 'createdBy', model: 'User', select: 'username' }
];

// This function was broken by the previous error. It is now fixed.
export const getAllContainers = asyncHandler(async (req, res) => {
    const containers = await Container.find({})
        .populate(deepPopulate)
        .sort({ createdAt: -1 });
    res.status(200).json(containers);
});

export const getContainerById = asyncHandler(async (req, res) => {
    const container = await Container.findById(req.params.id).populate(deepPopulate);
    if (!container) {
        res.status(404);
        throw new Error('Container not found');
    }
    res.status(200).json(container);
});

export const createContainer = asyncHandler(async (req, res) => {
    const { containerNumber, truckNumber, pallets, factory, loadingPlan } = req.body;
    const userId = req.user._id;

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const containerId = await generateId('CN');
        const newContainer = new Container({
            containerId,
            containerNumber,
            truckNumber,
            pallets,
            factory,
            loadingPlan,
            createdBy: userId,
            status: pallets.length > 0 ? 'Loaded' : 'Empty',
        });

        const savedContainer = await newContainer.save({ session });

        if (pallets && pallets.length > 0) {
            await Pallet.updateMany(
                { _id: { $in: pallets } },
                { $set: { status: 'LoadedInContainer', container: savedContainer._id } },
                { session }
            );
        }

        await session.commitTransaction();
        const populatedContainer = await Container.findById(savedContainer._id).populate(deepPopulate);
        res.status(201).json(populatedContainer);

    } catch (error) {
        await session.abortTransaction();
        res.status(400).json({ message: error.message });
    } finally {
        session.endSession();
    }
});

export const updateContainer = asyncHandler(async (req, res) => {
    const { containerNumber, truckNumber, pallets: newPalletIds } = req.body;
    const { id } = req.params;
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const container = await Container.findById(id).session(session);
        if (!container) throw new Error('Container not found');

        const originalPalletIds = container.pallets.map(p => p.toString());
        
        container.containerNumber = containerNumber || container.containerNumber;
        container.truckNumber = truckNumber || container.truckNumber;
        container.pallets = newPalletIds;
        container.status = newPalletIds.length > 0 ? 'Loaded' : 'Empty';

        const removedPalletIds = originalPalletIds.filter(pId => !newPalletIds.includes(pId));
        if (removedPalletIds.length > 0) {
            await Pallet.updateMany({ _id: { $in: removedPalletIds } }, { $set: { status: 'InFactoryStock', container: null } }, { session });
        }

        const addedPalletIds = newPalletIds.filter(pId => !originalPalletIds.includes(pId));
        if (addedPalletIds.length > 0) {
            await Pallet.updateMany({ _id: { $in: addedPalletIds } }, { $set: { status: 'LoadedInContainer', container: container._id } }, { session });
        }
        
        await container.save({ session });
        await session.commitTransaction();
        
        const populatedContainer = await Container.findById(id).populate(deepPopulate);
        res.status(200).json(populatedContainer);

    } catch (error) {
        await session.abortTransaction();
        res.status(400).json({ message: error.message });
    } finally {
        session.endSession();
    }
});

export const updateContainerStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    const { id } = req.params;
    const validStatuses = ['Loaded', 'Dispatched', 'In Transit', 'Delivered', 'Empty'];
    if (!validStatuses.includes(status)) {
        res.status(400);
        throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }
    const container = await Container.findByIdAndUpdate(id, { status }, { new: true })
        .populate(deepPopulate);
    if (!container) {
        res.status(404);
        throw new Error('Container not found');
    }
    res.status(200).json(container);
});
