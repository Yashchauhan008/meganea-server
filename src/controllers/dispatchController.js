import mongoose from 'mongoose';
import DispatchOrder from '../models/dispatchOrderModel.js';
import Booking from '../models/bookingModel.js';
import Tile from '../models/tileModel.js';
import asyncHandler from '../utils/asyncHandler.js';
import { generateId } from '../services/idGenerator.js';

// @desc    Create a new dispatch order from an unprocessed image
// @route   POST /api/dispatches
// @access  Private/Admin, Private/Dubai-Staff
export const createDispatchOrder = asyncHandler(async (req, res) => {
  const { bookingId, unprocessedImageId, dispatchedItems, invoiceNumber } = req.body;

  if (!dispatchedItems || dispatchedItems.length === 0) {
    res.status(400);
    throw new Error('Dispatch order must contain at least one item');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const booking = await Booking.findById(bookingId).session(session);
    if (!booking) {
      throw new Error('Booking not found');
    }

    const unprocessedImage = booking.unprocessedImages.id(unprocessedImageId);
    if (!unprocessedImage) {
      throw new Error('Unprocessed image not found in this booking');
    }

    // This logic calculates total dispatched quantities for each tile in the booking so far.
    const dispatchedTotals = {};
    const relatedDispatches = await DispatchOrder.find({ booking: bookingId }).session(session);
    relatedDispatches.forEach(order => {
        order.dispatchedItems.forEach(item => {
            dispatchedTotals[item.tile.toString()] = (dispatchedTotals[item.tile.toString()] || 0) + item.quantity;
        });
    });

    // Validate and update stock
    for (const item of dispatchedItems) {
      const tile = await Tile.findById(item.tile).session(session);
      if (!tile) {
        throw new Error(`Tile with ID ${item.tile} not found`);
      }

      // Check if dispatch quantity exceeds booked quantity
      const bookingItem = booking.tilesList.find(t => t.tile.toString() === item.tile.toString());
      if (!bookingItem) {
        throw new Error(`Tile ${tile.name} is not part of the original booking.`);
      }
      
      const totalDispatchedForTile = (dispatchedTotals[item.tile.toString()] || 0) + item.quantity;
      if (totalDispatchedForTile > bookingItem.quantity) {
          throw new Error(`Dispatch quantity for ${tile.name} exceeds booked quantity. Booked: ${bookingItem.quantity}, Total Dispatched (including this one): ${totalDispatchedForTile}`);
      }
      
      // Decrease current stock and booked stock
      tile.stockDetails.currentStock -= item.quantity;
      tile.stockDetails.bookedStock -= item.quantity;
      
      if (tile.stockDetails.currentStock < 0 || tile.stockDetails.bookedStock < 0) {
          throw new Error(`Stock calculation error for tile ${tile.name}. Please check inventory.`);
      }

      await tile.save({ session });
    }

    const dispatchNumber = await generateId('DO');

    const dispatchOrder = new DispatchOrder({
      dispatchNumber,
      booking: bookingId,
      salesman: booking.salesman,
      invoiceNumber,
      sourceImage: {
          imageUrl: unprocessedImage.imageUrl,
          publicId: unprocessedImage.publicId,
          unprocessedImageId: unprocessedImage._id,
      },
      dispatchedItems,
      createdBy: req.user._id,
    });
    
    const createdDispatchOrder = await dispatchOrder.save({ session });

    // Remove the image from the unprocessed list
    booking.unprocessedImages.pull(unprocessedImageId);
    booking.dispatchOrders.push(createdDispatchOrder._id);

    // Update booking status
    let totalBookedQty = booking.tilesList.reduce((acc, item) => acc + item.quantity, 0);
    let totalDispatchedQty = (await DispatchOrder.find({ booking: bookingId }).session(session)).reduce((acc, order) => acc + order.dispatchedItems.reduce((sum, item) => sum + item.quantity, 0), 0);
    
    if (totalDispatchedQty >= totalBookedQty) {
        booking.status = 'Completed';
        booking.completedAt = Date.now();
    } else {
        booking.status = 'Partially Dispatched';
    }

    await booking.save({ session });

    await session.commitTransaction();
    res.status(201).json(createdDispatchOrder);

  } catch (error) {
    await session.abortTransaction();
    res.status(400);
    throw new Error(error.message || 'Failed to create dispatch order');
  } finally {
    session.endSession();
  }
});

// @desc    Get all dispatch orders
// @route   GET /api/dispatches
// @access  Private/Admin, Private/Dubai-Staff
export const getAllDispatchOrders = asyncHandler(async (req, res) => {
  const orders = await DispatchOrder.find({})
    .populate('booking', 'bookingId')
    .populate('salesman', 'username')
    .populate('createdBy', 'username')
    .sort({ createdAt: -1 });
  res.status(200).json(orders);
});

// @desc    Get a single dispatch order by ID
// @route   GET /api/dispatches/:id
// @access  Private/Admin, Private/Dubai-Staff
export const getDispatchOrderById = asyncHandler(async (req, res) => {
  const order = await DispatchOrder.findById(req.params.id)
    .populate('booking', 'bookingId party')
    .populate('salesman', 'username')
    .populate('dispatchedItems.tile', 'name tileId');

  if (!order) {
    res.status(404);
    throw new Error('Dispatch order not found');
  }
  res.status(200).json(order);
});
