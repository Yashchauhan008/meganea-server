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
    const { status, factoryId, search } = req.query;
  
    const filter = { deleted: { $ne: true } };
  
    if (status) filter.status = status;
    if (factoryId) filter.factory = factoryId;
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filter.$or = [
        { containerNumber: searchRegex },
        { truckNumber: searchRegex },
      ];
    }
  
    const containers = await Container.find(filter)
      .populate('factory', 'name address')
      .populate('loadingPlan', 'loadingPlanId')
      .populate({
        path: 'pallets', // ✅ Pallets
        select: 'palletId tile boxCount type',
        populate: { path: 'tile', select: 'name size' },
      })
      .populate({
        path: 'khatlis', // ✅ Khatlis
        select: 'palletId tile boxCount type',
        populate: { path: 'tile', select: 'name size' },
      })
      .sort({ createdAt: -1 });
  
    res.status(200).json(containers);
  });
  

  export const getContainerById = asyncHandler(async (req, res) => {
    const container = await Container.findById(req.params.id)
      .populate('factory', 'name address')
      .populate('loadingPlan', 'loadingPlanId')
      .populate('dispatchOrder', 'dispatchNumber')
      .populate({
        path: 'pallets',
        populate: { path: 'tile', select: 'name size surface' },
      })
      .populate({
        path: 'khatlis',
        populate: { path: 'tile', select: 'name size surface' },
      });
  
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
    const { id } = req.params;
    const { containerNumber, truckNumber, pallets } = req.body;
  
    const session = await mongoose.startSession();
    session.startTransaction();
  
    try {
      const container = await Container.findById(id).session(session);
  
      if (!container) {
        throw new Error('Container not found');
      }
  
      if (container.status === 'Dispatched') {
        throw new Error('Cannot edit dispatched container');
      }
  
      // Get old pallets/khatlis
      const oldPalletIds = [
        ...(container.pallets || []),
        ...(container.khatlis || []),
      ];
  
      // Revert old pallets to InFactoryStock
      if (oldPalletIds.length > 0) {
        await Pallet.updateMany(
          { _id: { $in: oldPalletIds } },
          { $set: { status: 'InFactoryStock', loadedAt: null } },
          { session }
        );
      }
  
      // Get new pallets
      const newPalletDocs = await Pallet.find({
        _id: { $in: pallets },
      }).session(session);
  
      // Separate by type
      const newPalletIds = [];
      const newKhatliIds = [];
  
      newPalletDocs.forEach((pallet) => {
        if (pallet.type === 'Pallet') {
          newPalletIds.push(pallet._id);
        } else if (pallet.type === 'Khatli') {
          newKhatliIds.push(pallet._id);
        }
      });
  
      // Update container
      container.containerNumber = containerNumber || container.containerNumber;
      container.truckNumber = truckNumber || container.truckNumber;
      container.pallets = newPalletIds; // ✅ Only Pallets
      container.khatlis = newKhatliIds; // ✅ Only Khatlis
  
      await container.save({ session });
  
      // Update new pallets status
      await Pallet.updateMany(
        { _id: { $in: pallets } },
        { $set: { status: 'LoadedInContainer', loadedAt: new Date() } },
        { session }
      );
  
      await session.commitTransaction();
  
      const updatedContainer = await Container.findById(id)
        .populate('factory')
        .populate({
          path: 'pallets',
          populate: { path: 'tile' },
        })
        .populate({
          path: 'khatlis',
          populate: { path: 'tile' },
        });
  
      res.status(200).json({
        message: 'Container updated successfully',
        container: updatedContainer,
      });
    } catch (error) {
      await session.abortTransaction();
      res.status(400);
      throw new Error(error.message);
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
