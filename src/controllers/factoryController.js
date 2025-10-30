import asyncHandler from '../utils/asyncHandler.js';
import Factory from '../models/factoryModel.js';

// @desc    Create a new factory
// @route   POST /api/factories
// @access  Private/Admin/India-Staff
export const createFactory = asyncHandler(async (req, res) => {
    const { name, address, contactPerson } = req.body;
    const factoryExists = await Factory.findOne({ name });
    if (factoryExists) {
        res.status(400);
        throw new Error('A factory with this name already exists.');
    }
    const factory = await Factory.create({ name, address, contactPerson });
    res.status(201).json(factory);
});

// @desc    Get all factories
// @route   GET /api/factories
// @access  Private/Admin/India-Staff
export const getAllFactories = asyncHandler(async (req, res) => {
    const factories = await Factory.find({});
    res.status(200).json(factories);
});
