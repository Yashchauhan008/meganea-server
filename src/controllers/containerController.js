import asyncHandler from '../utils/asyncHandler.js';
import Container from '../models/containerModel.js';
import mongoose from 'mongoose';

/**
 * @desc    Get all containers with populated details
 * @route   GET /api/containers
 * @access  Private (Admin, India-Staff)
 */
export const getAllContainers = asyncHandler(async (req, res) => {
    const containers = await Container.find({})
        .populate({
            path: 'loadingPlan',
            select: 'loadingPlanId factory', // Select fields from LoadingPlan
            populate: {
                path: 'factory',
                select: 'name' // Select factory name from Factory model
            }
        })
        .populate({
            path: 'pallets',
            select: 'palletId type boxCount tile', // Select fields from Pallet
            populate: {
                path: 'tile',
                select: 'name size' // Select fields from Tile model
            }
        })
        .sort({ createdAt: -1 }); // Show newest first

    res.status(200).json(containers);
});

/**
 * @desc    Update the status of a single container
 * @route   PUT /api/containers/:id/status
 * @access  Private (Admin, India-Staff)
 */
export const updateContainerStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400);
        throw new Error('Invalid container ID');
    }

    // Define the valid statuses a container can have
    const validStatuses = ['Loaded', 'Dispatched', 'In Transit', 'Delivered'];
    if (!status || !validStatuses.includes(status)) {
        res.status(400);
        throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const container = await Container.findById(id);

    if (!container) {
        res.status(404);
        throw new Error('Container not found');
    }

    container.status = status;
    await container.save();

    // It's good practice to send back the fully populated container after an update
    const populatedContainer = await Container.findById(id)
        .populate({
            path: 'loadingPlan',
            populate: { path: 'factory', select: 'name' }
        })
        .populate({
            path: 'pallets',
            populate: { path: 'tile', select: 'name size' }
        });

    res.status(200).json(populatedContainer);
});
