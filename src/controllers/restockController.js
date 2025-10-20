import mongoose from 'mongoose';
import RestockRequest from '../models/restockRequestModel.js';
import Tile from '../models/tileModel.js';
import asyncHandler from '../utils/asyncHandler.js';
import { generateId } from '../services/idGenerator.js';

// @desc    Create a new restock request
// @route   POST /api/restocks
// @access  Private/Admin, Private/Dubai-Staff
export const createRestockRequest = asyncHandler(async (req, res) => {
  const { requestedItems, notes } = req.body;

  if (!requestedItems || requestedItems.length === 0) {
    res.status(400);
    throw new Error('Request must contain at least one tile');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    for (const item of requestedItems) {
      await Tile.findByIdAndUpdate(
        item.tile,
        { $inc: { 'stockDetails.restockingStock': item.quantityRequested } },
        { session }
      );
    }

    const requestId = await generateId('RQ');

    const restockRequest = new RestockRequest({
      requestId,
      requestedItems,
      notes,
      requestedBy: req.user._id,
    });

    const createdRequest = await restockRequest.save({ session });

    await session.commitTransaction();
    res.status(201).json(createdRequest);

  } catch (error) {
    await session.abortTransaction();
    res.status(400);
    throw new Error(error.message || 'Failed to create restock request');
  } finally {
    session.endSession();
  }
});

// @desc    Get all restock requests
// @route   GET /api/restocks
// @access  Private/Admin, Private/Staff
export const getAllRestockRequests = asyncHandler(async (req, res) => {
  const requests = await RestockRequest.find({})
    .populate('requestedBy', 'username')
    .populate('requestedItems.tile', 'name tileId')
    .sort({ createdAt: -1 });
  res.status(200).json(requests);
});

// @desc    Get a single restock request by ID
// @route   GET /api/restocks/:id
// @access  Private/Admin, Private/Staff
export const getRestockRequestById = asyncHandler(async (req, res) => {
  const request = await RestockRequest.findById(req.params.id)
    .populate('requestedBy', 'username')
    .populate('requestedItems.tile', 'name tileId size');

  if (!request) {
    res.status(404);
    throw new Error('Restock request not found');
  }
  res.status(200).json(request);
});

// @desc    Record an arrival of stock against a request
// @route   POST /api/restocks/:id/record-arrival
// @access  Private/Admin, Private/Dubai-Staff
export const recordArrival = asyncHandler(async (req, res) => {
  const { tileId, quantity, notes } = req.body;
  const { id } = req.params;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const restockRequest = await RestockRequest.findById(id).session(session);
    if (!restockRequest) {
      throw new Error('Restock request not found');
    }

    const itemToUpdate = restockRequest.requestedItems.find(item => item.tile.toString() === tileId);
    if (!itemToUpdate) {
      throw new Error('Tile not found in this restock request');
    }

    // Update stock levels
    await Tile.findByIdAndUpdate(
      tileId,
      {
        $inc: {
          'stockDetails.currentStock': quantity,
          'stockDetails.restockingStock': -quantity,
        },
      },
      { session }
    );

    // Update the requested item
    itemToUpdate.quantityArrived += quantity;
    itemToUpdate.arrivalHistory.push({ quantity, notes });

    // Update overall request status
    const totalRequested = restockRequest.requestedItems.reduce((acc, item) => acc + item.quantityRequested, 0);
    const totalArrived = restockRequest.requestedItems.reduce((acc, item) => acc + item.quantityArrived, 0);

    if (totalArrived >= totalRequested) {
      restockRequest.status = 'Completed';
      restockRequest.completedAt = Date.now();
    } else {
      restockRequest.status = 'Partially Arrived';
    }

    await restockRequest.save({ session });

    await session.commitTransaction();
    res.status(200).json(restockRequest);

  } catch (error) {
    await session.abortTransaction();
    res.status(400);
    throw new Error(error.message || 'Failed to record arrival');
  } finally {
    session.endSession();
  }
});

// @desc    Update restock request status (e.g., to 'Processing' or 'Cancelled')
// @route   PATCH /api/restocks/:id/status
// @access  Private/Admin, Private/India-Staff
export const updateRestockRequestStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    const request = await RestockRequest.findById(req.params.id);

    if (!request) {
        res.status(404);
        throw new Error('Request not found');
    }

    // Add logic for cancellation (e.g., reverting restockingStock) if needed
    if (status === 'Cancelled' && request.status !== 'Completed') {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            for (const item of request.requestedItems) {
                const remainingRestockQty = item.quantityRequested - item.quantityArrived;
                if (remainingRestockQty > 0) {
                    await Tile.findByIdAndUpdate(item.tile, {
                        $inc: { 'stockDetails.restockingStock': -remainingRestockQty }
                    }, { session });
                }
            }
            request.status = 'Cancelled';
            await request.save({ session });
            await session.commitTransaction();
        } catch(error) {
            await session.abortTransaction();
            throw new Error('Failed to cancel request and revert stock.');
        } finally {
            session.endSession();
        }
    } else {
        request.status = status;
        await request.save();
    }

    res.status(200).json(request);
});
