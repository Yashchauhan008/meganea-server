import mongoose from 'mongoose';
import RestockRequest from '../models/restockRequestModel.js';
import Tile from '../models/tileModel.js';
import asyncHandler from '../utils/asyncHandler.js';
import { generateId } from '../services/idGenerator.js';

// @desc    Create a new restock request
// @route   POST /api/restocks
export const createRestockRequest = asyncHandler(async (req, res) => {
  const { requestedItems, notes } = req.body;

  if (!requestedItems || requestedItems.length === 0) {
    res.status(400);
    throw new Error('Request must contain at least one tile');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // For each item, increase the 'restockingStock'
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
export const getAllRestockRequests = asyncHandler(async (req, res) => {
  const requests = await RestockRequest.find({})
    .populate('requestedBy', 'username')
    .populate('requestedItems.tile', 'name tileId')
    .sort({ createdAt: -1 });
  res.status(200).json(requests);
});

// @desc    Get a single restock request by ID
// @route   GET /api/restocks/:id
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
export const recordArrival = asyncHandler(async (req, res) => {
  const { tileId, quantity, notes } = req.body;
  const { id } = req.params;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const restockRequest = await RestockRequest.findById(id).session(session);
    if (!restockRequest) throw new Error('Restock request not found');

    const itemToUpdate = restockRequest.requestedItems.find(item => item.tile.toString() === tileId);
    if (!itemToUpdate) throw new Error('Tile not found in this restock request');

    // Update stock levels: increase physical stock, decrease restocking promise
    await Tile.findByIdAndUpdate(
      tileId,
      {
        $inc: {
          'stockDetails.availableStock': quantity,
          'stockDetails.restockingStock': -quantity,
        },
      },
      { session }
    );

    // Update the requested item's arrival details
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
export const updateRestockRequestStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    const request = await RestockRequest.findById(req.params.id);

    if (!request) {
        res.status(404);
        throw new Error('Request not found');
    }

    // Handle cancellation: revert the 'restocking' promise for any outstanding items
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
            request.status = status;
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


export const updateShippedQuantity = asyncHandler(async (req, res) => {
  const { itemId, quantityShipped } = req.body;
  const { id } = req.params;

  if (quantityShipped === undefined || quantityShipped < 0) {
      res.status(400);
      throw new Error('A valid shipped quantity is required.');
  }

  const request = await RestockRequest.findById(id);
  if (!request) {
      res.status(404);
      throw new Error('Restock request not found.');
  }

  const itemToUpdate = request.requestedItems.id(itemId);
  if (!itemToUpdate) {
      res.status(404);
      throw new Error('Item not found in this restock request.');
  }

  // Ensure they can't ship more than what was requested
  if (quantityShipped > itemToUpdate.quantityRequested) {
      res.status(400);
      throw new Error('Shipped quantity cannot be greater than the requested quantity.');
  }

  // Update the value
  itemToUpdate.quantityShipped = quantityShipped;

  await request.save();

  res.status(200).json(request);
});


export const editRestockRequest = asyncHandler(async (req, res) => {
  const { requestedItems, notes } = req.body;
  const { id } = req.params;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
      const request = await RestockRequest.findById(id).session(session);
      if (!request) throw new Error('Restock request not found.');
      if (request.status !== 'Pending') {
          throw new Error(`Cannot edit a request with status '${request.status}'.`);
      }

      // --- Stock Difference Calculation ---
      const stockAdjustments = new Map();
      // 1. Revert old quantities
      for (const item of request.requestedItems) {
          stockAdjustments.set(item.tile.toString(), (stockAdjustments.get(item.tile.toString()) || 0) - item.quantityRequested);
      }
      // 2. Apply new quantities
      for (const item of requestedItems) {
          stockAdjustments.set(item.tile.toString(), (stockAdjustments.get(item.tile.toString()) || 0) + item.quantity);
      }

      // 3. Apply the final differences to Tile.restockingStock
      for (const [tileId, adjustment] of stockAdjustments.entries()) {
          if (adjustment === 0) continue;
          await Tile.findByIdAndUpdate(tileId, { $inc: { 'stockDetails.restockingStock': adjustment } }, { session });
      }
      // --- End of Stock Logic ---

      request.requestedItems = requestedItems;
      request.notes = notes;
      const updatedRequest = await request.save({ session });

      await session.commitTransaction();
      res.status(200).json(updatedRequest);

  } catch (error) {
      await session.abortTransaction();
      res.status(400).json({ message: error.message || 'Failed to edit restock request.' });
  } finally {
      session.endSession();
  }
});


export const forceCompleteRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
      const request = await RestockRequest.findById(id).session(session);
      if (!request) throw new Error('Restock request not found.');
      if (request.status === 'Completed' || request.status === 'Cancelled') {
          throw new Error(`Request is already in a final state ('${request.status}').`);
      }

      // For every item, calculate the outstanding 'restocking' quantity and remove it.
      for (const item of request.requestedItems) {
          const outstandingQty = item.quantityRequested - item.quantityArrived;
          if (outstandingQty > 0) {
              await Tile.findByIdAndUpdate(
                  item.tile,
                  { $inc: { 'stockDetails.restockingStock': -outstandingQty } },
                  { session }
              );
          }
      }

      request.status = 'Completed with Discrepancy';
      request.completedAt = new Date();
      await request.save({ session });

      await session.commitTransaction();
      res.status(200).json(request);

  } catch (error) {
      await session.abortTransaction();
      res.status(400).json({ message: error.message || 'Failed to force complete request.' });
  } finally {
      session.endSession();
  }
});


export const editArrivalHistory = asyncHandler(async (req, res) => {
  const { itemId, arrivalId, newQuantity, newNotes } = req.body;
  const { id } = req.params;

  if (newQuantity === undefined || newQuantity < 0) {
      res.status(400);
      throw new Error('A valid new quantity is required.');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
      const request = await RestockRequest.findById(id).session(session);
      if (!request) throw new Error('Restock request not found.');

      const item = request.requestedItems.id(itemId);
      if (!item) throw new Error('Item not found in this request.');

      const arrival = item.arrivalHistory.id(arrivalId);
      if (!arrival) throw new Error('Arrival record not found.');

      // --- Core Stock Logic ---
      // 1. Calculate the difference between the old and new quantity.
      const oldQuantity = arrival.quantity;
      const quantityDifference = newQuantity - oldQuantity;

      // 2. Update the tile's main stock with this difference.
      // If new quantity is 12 and old was 10, difference is +2. availableStock increases by 2.
      // If new quantity is 8 and old was 10, difference is -2. availableStock decreases by 2.
      if (quantityDifference !== 0) {
          await Tile.findByIdAndUpdate(
              item.tile,
              { $inc: { 'stockDetails.availableStock': quantityDifference } },
              { session }
          );
      }
      
      // 3. Update the restock request's total arrived quantity.
      item.quantityArrived += quantityDifference;
      // --- End of Stock Logic ---

      // 4. Update the actual arrival history entry.
      arrival.quantity = newQuantity;
      arrival.notes = newNotes;
      arrival.arrivalDate = new Date(); // Optionally update the date to reflect the edit time

      await request.save({ session });
      await session.commitTransaction();

      res.status(200).json(request);

  } catch (error) {
      await session.abortTransaction();
      res.status(400).json({ message: error.message || 'Failed to edit arrival history.' });
  } finally {
      session.endSession();
  }
});