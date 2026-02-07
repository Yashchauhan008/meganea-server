// backend/controllers/dubaiDispatchController.js

import mongoose from 'mongoose';
import DubaiDispatchOrder from '../models/dubaiDispatchOrderModel.js';
import Booking from '../models/bookingModel.js';
import Tile from '../models/tileModel.js';
import asyncHandler from '../utils/asyncHandler.js';
import { generateId } from '../services/idGenerator.js';

// @desc    Create a new Dubai dispatch order
// @route   POST /api/dubai-dispatches
// @access  Private (Admin, Dubai-Staff)
export const createDubaiDispatchOrder = asyncHandler(async (req, res) => {
  const { bookingId, unprocessedImageId, dispatchedItems, invoiceNumber } = req.body;

  if (!dispatchedItems || dispatchedItems.length === 0) {
    res.status(400);
    throw new Error('Dispatch order must contain at least one item');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const booking = await Booking.findById(bookingId).session(session);
    if (!booking) throw new Error('Booking not found');

    const unprocessedImage = booking.unprocessedImages.id(unprocessedImageId);
    if (!unprocessedImage) throw new Error('Unprocessed image not found in this booking');

    const relatedDispatches = await DubaiDispatchOrder.find({ booking: bookingId }).session(session);
    const previouslyDispatchedTotals = new Map();
    relatedDispatches.forEach(order => {
        order.dispatchedItems.forEach(item => {
            const tileId = item.tile.toString();
            previouslyDispatchedTotals.set(tileId, (previouslyDispatchedTotals.get(tileId) || 0) + item.quantity);
        });
    });

    for (const item of dispatchedItems) {
      const tileId = item.tile.toString();
      const bookingItem = booking.tilesList.find(t => t.tile.toString() === tileId);
      if (!bookingItem) throw new Error(`Tile ${tileId} is not part of the original booking.`);

      const totalDispatchedForTile = (previouslyDispatchedTotals.get(tileId) || 0) + item.quantity;
      if (totalDispatchedForTile > bookingItem.quantity) {
          throw new Error(`Dispatch for tile exceeds booked quantity.`);
      }
      
      // Atomically decrement both the physical stock (availableStock) and the promised stock (bookedStock).
      await Tile.findByIdAndUpdate(
        tileId, 
        { 
          $inc: { 
            'stockDetails.availableStock': -item.quantity,
            'stockDetails.bookedStock': -item.quantity
          } 
        }, 
        { session }
      );
    }

    const dispatchNumber = await generateId('DDO');
    const dispatchOrder = new DubaiDispatchOrder({
      dispatchNumber, 
      booking: bookingId, 
      invoiceNumber,
      sourceImage: { 
        imageUrl: unprocessedImage.imageUrl, 
        publicId: unprocessedImage.publicId, 
        unprocessedImageId: unprocessedImage._id 
      },
      dispatchedItems, 
      createdBy: req.user._id,
    });
    
    const createdDispatchOrder = await dispatchOrder.save({ session });

    booking.unprocessedImages.pull(unprocessedImageId);
    booking.dispatchOrders.push(createdDispatchOrder._id);

    const totalBookedQty = booking.tilesList.reduce((acc, item) => acc + item.quantity, 0);
    const newTotalDispatched = Array.from(previouslyDispatchedTotals.values()).reduce((a, b) => a + b, 0)
                             + dispatchedItems.reduce((acc, item) => acc + item.quantity, 0);

    if (newTotalDispatched >= totalBookedQty) {
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

// @desc    Get all Dubai dispatch orders
// @route   GET /api/dubai-dispatches
// @access  Private (Admin, Dubai-Staff)
export const getAllDubaiDispatchOrders = asyncHandler(async (req, res) => {
    const orders = await DubaiDispatchOrder.find({})
      .populate({
          path: 'booking',
          select: 'bookingId company tilesList dispatchOrders',
          populate: [
              { 
                  path: 'company', 
                  select: 'companyName' 
              },
              { 
                  path: 'tilesList.tile', 
                  select: 'name size conversionFactor'
              },
              { 
                  path: 'dispatchOrders',
                  populate: { 
                      path: 'dispatchedItems.tile', 
                      select: 'name size' 
                  }
              }
          ]
      })
      .populate('createdBy', 'username')
      .populate({
          path: 'dispatchedItems.tile',
          select: 'name size'
      })
      .sort({ createdAt: -1 });
  
    res.status(200).json(orders);
});

// @desc    Get a single Dubai dispatch order by ID
// @route   GET /api/dubai-dispatches/:id
// @access  Private (Admin, Dubai-Staff)
export const getDubaiDispatchOrderById = asyncHandler(async (req, res) => {
  const order = await DubaiDispatchOrder.findById(req.params.id)
    .populate('booking', 'bookingId')
    .populate('dispatchedItems.tile', 'name tileId');

  if (!order) {
    res.status(404);
    throw new Error('Dubai dispatch order not found');
  }
  res.status(200).json(order);
});

// @desc    Update a Dubai dispatch order
// @route   PUT /api/dubai-dispatches/:id
// @access  Private (Admin, Dubai-Staff)
export const updateDubaiDispatchOrder = asyncHandler(async (req, res) => {
    const { invoiceNumber, dispatchedItems: newItems } = req.body;
    const { id } = req.params;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const dispatch = await DubaiDispatchOrder.findById(id).session(session);
        if (!dispatch) throw new Error('Dispatch Order not found.');

        const booking = await Booking.findById(dispatch.booking).session(session);
        if (!booking) throw new Error('Associated booking not found.');

        // Intelligent Stock Difference Calculation
        const stockAdjustments = new Map();

        // 1. Add back the OLD quantities from this dispatch to the map
        for (const oldItem of dispatch.dispatchedItems) {
            const tileId = oldItem.tile.toString();
            stockAdjustments.set(tileId, (stockAdjustments.get(tileId) || 0) + oldItem.quantity);
        }

        // 2. Subtract the NEW quantities from the map
        for (const newItem of newItems) {
            const tileId = newItem.tile.toString();
            stockAdjustments.set(tileId, (stockAdjustments.get(tileId) || 0) - newItem.quantity);
        }

        // 3. Apply the final calculated differences to the database
        for (const [tileId, adjustment] of stockAdjustments.entries()) {
            if (adjustment === 0) continue;

            const bookingItem = booking.tilesList.find(bi => bi.tile.toString() === tileId);
            const otherDispatches = await DubaiDispatchOrder.find({ 
                booking: booking._id, 
                _id: { $ne: id } 
            }).session(session);
            
            let totalInOtherDispatches = 0;
            otherDispatches.forEach(od => {
                const item = od.dispatchedItems.find(oi => oi.tile.toString() === tileId);
                if (item) totalInOtherDispatches += item.quantity;
            });

            const newQuantityForTile = newItems.find(ni => ni.tile.toString() === tileId)?.quantity || 0;

            if ((totalInOtherDispatches + newQuantityForTile) > bookingItem.quantity) {
                throw new Error(`Editing failed: The new quantity for a tile exceeds the total amount booked.`);
            }

            await Tile.findByIdAndUpdate(
                tileId,
                { 
                    $inc: { 
                        'stockDetails.availableStock': adjustment, 
                        'stockDetails.bookedStock': adjustment 
                    } 
                },
                { session }
            );
        }

        // Update the dispatch document itself
        dispatch.invoiceNumber = invoiceNumber;
        dispatch.dispatchedItems = newItems;
        await dispatch.save({ session });

        // Recalculate and update the parent booking's status
        const allDispatches = await DubaiDispatchOrder.find({ booking: booking._id }).session(session);
        const totalBookedQty = booking.tilesList.reduce((acc, item) => acc + item.quantity, 0);
        const totalDispatchedQty = allDispatches.reduce((total, order) => 
            total + order.dispatchedItems.reduce((sum, item) => sum + item.quantity, 0), 0);

        if (totalDispatchedQty >= totalBookedQty) {
            booking.status = 'Completed';
        } else if (totalDispatchedQty > 0) {
            booking.status = 'Partially Dispatched';
        } else {
            booking.status = 'Booked';
        }
        await booking.save({ session });

        await session.commitTransaction();
        res.status(200).json(dispatch);

    } catch (error) {
        await session.abortTransaction();
        res.status(400);
        throw new Error(error.message || 'Failed to update dispatch order.');
    } finally {
        session.endSession();
    }
});

// @desc    Delete a Dubai dispatch order (reverting stock)
// @route   DELETE /api/dubai-dispatches/:id
// @access  Private (Admin)
export const deleteDubaiDispatchOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const dispatch = await DubaiDispatchOrder.findById(id).session(session);
        if (!dispatch) throw new Error('Dispatch Order not found.');

        // Revert the stock for all items in this dispatch
        for (const item of dispatch.dispatchedItems) {
            await Tile.findByIdAndUpdate(
                item.tile,
                { 
                    $inc: { 
                        'stockDetails.availableStock': item.quantity, 
                        'stockDetails.bookedStock': item.quantity 
                    } 
                },
                { session }
            );
        }

        // Update the parent booking's status
        const booking = await Booking.findById(dispatch.booking).session(session);
        if (booking) {
            booking.dispatchOrders.pull(dispatch._id);
            
            const allOtherDispatches = await DubaiDispatchOrder.find({ 
                booking: booking._id, 
                _id: { $ne: id } 
            }).session(session);
            
            const totalBookedQty = booking.tilesList.reduce((acc, item) => acc + item.quantity, 0);
            const remainingDispatchedQty = allOtherDispatches.reduce((total, order) => 
                total + order.dispatchedItems.reduce((sum, item) => sum + item.quantity, 0), 0);

            if (remainingDispatchedQty >= totalBookedQty) {
                booking.status = 'Completed';
            } else if (remainingDispatchedQty > 0) {
                booking.status = 'Partially Dispatched';
            } else {
                booking.status = 'Booked';
            }
            
            // Add image back to unprocessedImages
            booking.unprocessedImages.push({
                imageUrl: dispatch.sourceImage.imageUrl,
                publicId: dispatch.sourceImage.publicId,
                _id: dispatch.sourceImage.unprocessedImageId,
                uploadedBy: dispatch.createdBy,
                uploadedAt: dispatch.dispatchedAt
            });
            
            await booking.save({ session });
        }

        // Permanently delete the dispatch order document
        await dispatch.deleteOne({ session });

        await session.commitTransaction();
        res.status(200).json({ message: 'Dispatch order deleted and stock reverted successfully.' });

    } catch (error) {
        await session.abortTransaction();
        res.status(400);
        throw new Error(error.message || 'Failed to delete dispatch order.');
    } finally {
        session.endSession();
    }
});