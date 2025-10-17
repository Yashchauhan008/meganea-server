const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const RestockRequest = require('../models/RestockRequest');
const Tile = require('../models/Tile');
const { generateUniqueId } = require('../utils/generateId');

// @desc    Create a restock request
// @route   POST /api/restock-requests
// @access  Private/Dubai-Staff
const createRestockRequest = asyncHandler(async (req, res) => {
  const { requestedItems, notes } = req.body;

  if (!requestedItems || requestedItems.length === 0) {
    res.status(400);
    throw new Error('Request must contain at least one item');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const requestId = await generateUniqueId(RestockRequest, 'REQ-IN');
    const request = new RestockRequest({
      requestId,
      requestedItems,
      notes,
      requestedBy: req.user._id,
    });

    // Update restockingStock for each tile
    for (const item of requestedItems) {
      await Tile.findByIdAndUpdate(
        item.tile,
        { $inc: { 'stockDetails.restockingStock': item.quantity } },
        { session }
      );
    }

    const createdRequest = await request.save({ session });
    await session.commitTransaction();
    res.status(201).json(createdRequest);

  } catch (error) {
    await session.abortTransaction();
    throw new Error(`Restock request creation failed: ${error.message}`);
  } finally {
    session.endSession();
  }
});

// @desc    Record a container arrival
// @route   PUT /api/restock-requests/:id/arrival
// @access  Private/Dubai-Staff
const recordContainerArrival = asyncHandler(async (req, res) => {
    const { containerId, arrivedItems } = req.body; // arrivedItems: [{ tileId, quantity }]
    const request = await RestockRequest.findById(req.params.id).populate('requestedItems.tile');

    if (!request) {
        res.status(404);
        throw new Error('Restock request not found');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        for (const arrivedItem of arrivedItems) {
            const requestedItem = request.requestedItems.find(
                (item) => item.tile._id.toString() === arrivedItem.tileId
            );

            if (!requestedItem) {
                throw new Error(`Tile with ID ${arrivedItem.tileId} not found in this request.`);
            }

            // Log the arrival
            requestedItem.arrivalHistory.push({
                containerId,
                quantity: arrivedItem.quantity,
                arrivalDate: new Date(),
            });

            // Update stock levels
            await Tile.findByIdAndUpdate(
                arrivedItem.tileId,
                {
                    $inc: {
                        'stockDetails.currentStock': arrivedItem.quantity,
                        'stockDetails.restockingStock': -arrivedItem.quantity,
                    },
                },
                { session }
            );

            // Update item status
            const totalArrived = requestedItem.arrivalHistory.reduce((sum, entry) => sum + entry.quantity, 0);
            if (totalArrived >= requestedItem.quantity) {
                requestedItem.status = 'Arrived';
            }
        }
        
        // Update overall request status
        const allArrived = request.requestedItems.every(item => item.status === 'Arrived');
        if (allArrived) {
            request.status = 'Completed';
            request.completedAt = new Date();
        } else {
            request.status = 'Partially Arrived';
        }

        const updatedRequest = await request.save({ session });
        await session.commitTransaction();
        res.status(200).json(updatedRequest);

    } catch (error) {
        await session.abortTransaction();
        throw new Error(`Arrival recording failed: ${error.message}`);
    } finally {
        session.endSession();
    }
});


// @desc    Get all restock requests
// @route   GET /api/restock-requests
// @access  Private
const getAllRestockRequests = asyncHandler(async (req, res) => {
    const requests = await RestockRequest.find({})
        .populate('requestedBy', 'username')
        .populate('requestedItems.tile', 'name tileId');
    res.status(200).json(requests);
});

module.exports = { createRestockRequest, recordContainerArrival, getAllRestockRequests };
