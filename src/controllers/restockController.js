import mongoose from 'mongoose';
import RestockRequest from '../models/restockRequestModel.js';
import Tile from '../models/tileModel.js';
import asyncHandler from '../utils/asyncHandler.js';
import { generateId } from '../services/idGenerator.js';

// @desc    Create a new restock request
// @route   POST /api/restocks
// export const createRestockRequest = asyncHandler(async (req, res) => {
//   const { requestedItems, notes } = req.body;

//   if (!requestedItems || requestedItems.length === 0) {
//     res.status(400);
//     throw new Error('Request must contain at least one tile');
//   }

//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     // For each item, increase the 'restockingStock'
//     for (const item of requestedItems) {
//       await Tile.findByIdAndUpdate(
//         item.tile,
//         { $inc: { 'stockDetails.restockingStock': item.quantityRequested } },
//         { session }
//       );
//     }

//     const requestId = await generateId('RQ');

//     const restockRequest = new RestockRequest({
//       requestId,
//       requestedItems,
//       notes,
//       requestedBy: req.user._id,
//     });

//     const createdRequest = await restockRequest.save({ session });

//     await session.commitTransaction();
//     res.status(201).json(createdRequest);

//   } catch (error) {
//     await session.abortTransaction();
//     res.status(400);
//     throw new Error(error.message || 'Failed to create restock request');
//   } finally {
//     session.endSession();
//   }
// });

export const createRestockRequest = asyncHandler(async (req, res) => {
  const { requestedItems, notes } = req.body;
  if (!requestedItems || requestedItems.length === 0) {
      res.status(400).throw(new Error('Request must contain at least one tile'));
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
      for (const item of requestedItems) {
          await Tile.findByIdAndUpdate(
              item.tile,
              { $inc: { 'stockDetails.restockingStock': item.quantityRequested } },
              { session, new: true, runValidators: true }
          );
      }

      const requestId = await generateId('RQ');
      const restockRequest = new RestockRequest({ requestId, requestedItems, notes, requestedBy: req.user._id });
      const createdRequest = await restockRequest.save({ session });

      await session.commitTransaction();
      res.status(201).json(createdRequest);
  } catch (error) {
      await session.abortTransaction();
      res.status(400).json({ message: error.message || 'Failed to create restock request' });
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
// export const recordArrival = asyncHandler(async (req, res) => {
//   const { tileId, quantity, notes } = req.body;
//   const numQuantity = parseInt(quantity, 10);
//   if (isNaN(numQuantity) || numQuantity <= 0) {
//       throw new Error('A valid, positive quantity is required.');
//   }
//   const { id } = req.params;

//   const session = await mongoose.startSession();
//   session.startTransaction();
//   try {
//       const restockRequest = await RestockRequest.findById(id).session(session);
//       if (!restockRequest) throw new Error('Restock request not found');

//       const itemToUpdate = restockRequest.requestedItems.find(item => item.tile.toString() === tileId);
//       if (!itemToUpdate) throw new Error('Tile not found in this restock request');

//       // This is the key transaction:
//       // 1. Decrease the 'promised' restocking stock.
//       // 2. Increase the 'physical' available stock.
//       await Tile.findByIdAndUpdate(
//           tileId,
//           {
//               $inc: {
//                   'stockDetails.availableStock': numQuantity,
//                   'stockDetails.restockingStock': -numQuantity,
//               },
//           },
//           { session, new: true, runValidators: true }
//       );

//       itemToUpdate.quantityArrived += numQuantity;
//       itemToUpdate.arrivalHistory.push({ quantity: numQuantity, notes, arrivalDate: new Date() });

//       const totalRequested = restockRequest.requestedItems.reduce((acc, item) => acc + item.quantityRequested, 0);
//       const totalArrived = restockRequest.requestedItems.reduce((acc, item) => acc + item.quantityArrived, 0);

//       if (totalArrived >= totalRequested) {
//           restockRequest.status = 'Completed';
//           restockRequest.completedAt = Date.now();
//       } else {
//           restockRequest.status = 'Partially Arrived';
//       }

//       await restockRequest.save({ session });
//       await session.commitTransaction();
//       res.status(200).json(restockRequest);
//   } catch (error) {
//       await session.abortTransaction();
//       res.status(400).json({ message: error.message || 'Failed to record arrival' });
//   } finally {
//       session.endSession();
//   }
// });
// ... inside backend/src/controllers/restockController.js

// =================================================================
// RECORD ARRIVAL: Correctly moves stock from 'restocking' to 'available'.
// =================================================================
export const recordArrival = asyncHandler(async (req, res) => {
  const { tileId, quantity, notes } = req.body;
  const numQuantity = parseInt(quantity, 10);
  if (isNaN(numQuantity) || numQuantity <= 0) {
      throw new Error('A valid, positive quantity is required.');
  }
  const { id } = req.params;

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
      const restockRequest = await RestockRequest.findById(id).session(session);
      if (!restockRequest) throw new Error('Restock request not found');

      const itemToUpdate = restockRequest.requestedItems.find(item => item.tile.toString() === tileId);
      if (!itemToUpdate) throw new Error('Tile not found in this restock request');

      // --- NEW, CRITICAL VALIDATION ---
      const remainingQty = itemToUpdate.quantityRequested - itemToUpdate.quantityArrived;
      if (numQuantity > remainingQty) {
          throw new Error(`Cannot record arrival of ${numQuantity} boxes. Only ${remainingQty} boxes are remaining for this tile.`);
      }
      // --- END OF VALIDATION ---

      // This is the key transaction:
      // 1. Decrease the 'promised' restocking stock.
      // 2. Increase the 'physical' available stock.
      await Tile.findByIdAndUpdate(
          tileId,
          {
              $inc: {
                  'stockDetails.availableStock': numQuantity,
                  'stockDetails.restockingStock': -numQuantity,
              },
          },
          { session, new: true, runValidators: true }
      );

      itemToUpdate.quantityArrived += numQuantity;
      itemToUpdate.arrivalHistory.push({ quantity: numQuantity, notes, arrivalDate: new Date() });

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
      // Use 400 for validation errors, 500 for others
      const statusCode = error.message.includes('Cannot record arrival') ? 400 : 500;
      res.status(statusCode).json({ message: error.message || 'Failed to record arrival' });
  } finally {
      session.endSession();
  }
});


// @desc    Update restock request status (e.g., to 'Processing' or 'Cancelled')
// @route   PATCH /api/restocks/:id/status
export const updateRestockRequestStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const request = await RestockRequest.findById(req.params.id);
  if (!request) throw new Error('Request not found');

  if (status === 'Cancelled' && request.status !== 'Completed' && request.status !== 'Cancelled') {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
          await revertOutstandingStock(request, session);
          request.status = 'Cancelled';
          await request.save({ session });
          await session.commitTransaction();
      } catch (error) {
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
      const originalRequest = await RestockRequest.findById(id).session(session);
      if (!originalRequest) throw new Error('Restock request not found.');
      if (originalRequest.status !== 'Pending') {
          throw new Error(`Cannot edit a request with status '${originalRequest.status}'.`);
      }

      const stockAdjustments = new Map();

      // 1. Calculate what needs to be *reverted* from the old request
      for (const oldItem of originalRequest.requestedItems) {
          const tileId = oldItem.tile.toString();
          stockAdjustments.set(tileId, (stockAdjustments.get(tileId) || 0) - oldItem.quantityRequested);
      }

      // 2. Calculate what needs to be *applied* from the new request
      for (const newItem of requestedItems) {
          const tileId = newItem.tile.toString();
          stockAdjustments.set(tileId, (stockAdjustments.get(tileId) || 0) + newItem.quantityRequested);
      }

      // 3. Apply the final net difference to the database
      for (const [tileId, adjustment] of stockAdjustments.entries()) {
          if (adjustment === 0) continue;
          await Tile.findByIdAndUpdate(
              tileId,
              { $inc: { 'stockDetails.restockingStock': adjustment } },
              { session, new: true, runValidators: true }
          );
      }

      originalRequest.requestedItems = requestedItems;
      originalRequest.notes = notes;
      const updatedRequest = await originalRequest.save({ session });

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
      if (['Completed', 'Cancelled'].includes(request.status)) {
          throw new Error(`Request is already in a final state ('${request.status}').`);
      }
      await revertOutstandingStock(request, session);
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
  const numNewQuantity = parseInt(newQuantity, 10);
  if (isNaN(numNewQuantity) || numNewQuantity < 0) {
      throw new Error('A valid, non-negative quantity is required.');
  }
  const { id } = req.params;

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
      const request = await RestockRequest.findById(id).session(session);
      if (!request) throw new Error('Restock request not found.');

      const item = request.requestedItems.id(itemId);
      if (!item) throw new Error('Item not found in this request.');

      const arrival = item.arrivalHistory.id(arrivalId);
      if (!arrival) throw new Error('Arrival record not found.');

      const oldQuantity = arrival.quantity;
      const quantityDifference = numNewQuantity - oldQuantity;

      if (quantityDifference !== 0) {
          // Adjust physical stock
          await Tile.findByIdAndUpdate(
              item.tile,
              { $inc: { 'stockDetails.availableStock': quantityDifference } },
              { session, new: true, runValidators: true }
          );
          // Adjust the total arrived quantity for the item
          item.quantityArrived += quantityDifference;
      }

      arrival.quantity = numNewQuantity;
      arrival.notes = newNotes || '';
      arrival.arrivalDate = new Date();

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

const revertOutstandingStock = async (request, session) => {
  for (const item of request.requestedItems) {
      const outstandingQty = item.quantityRequested - item.quantityArrived;
      if (outstandingQty > 0) {
          await Tile.findByIdAndUpdate(
              item.tile,
              { $inc: { 'stockDetails.restockingStock': -outstandingQty } },
              { session, new: true, runValidators: true }
          );
      }
  }
};

export const getRestockRequestForWorkbench = asyncHandler(async (req, res) => {
    const request = await RestockRequest.findById(req.params.id)
      .populate('requestedBy', 'username')
      .populate({
        path: 'requestedItems.tile',
        model: 'Tile',
        populate: { path: 'manufacturingFactories', model: 'Factory', select: 'name' }
      })
      // --- THIS IS THE KEY CHANGE ---
      // Populate the PO reference on each item, and then populate the PO's details.
      .populate({
        path: 'requestedItems.purchaseOrder',
        model: 'PurchaseOrder',
        select: 'poId' // We only need the human-readable PO ID for the UI
      });
      // -----------------------------
  
    if (!request) {
      res.status(404).throw(new Error('Restock request not found'));
    }
    
    res.status(200).json(request);
  });