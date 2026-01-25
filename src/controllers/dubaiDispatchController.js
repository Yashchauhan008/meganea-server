import mongoose from 'mongoose';
import DubaiDispatchOrder from '../models/dubaiDispatchOrderModel.js';
import Booking from '../models/bookingModel.js';
import Tile from '../models/tileModel.js';
import asyncHandler from '../utils/asyncHandler.js';
import { generateId } from '../services/idGenerator.js';

/**
 * Dubai Dispatch Order Controller
 * 
 * Handles all operations for Dubai's booking-based dispatch system.
 * Completely independent from India's container-based dispatch system.
 */

/**
 * @desc    Create a new Dubai dispatch order from processing a delivery note
 * @route   POST /api/dubai-dispatches
 * @access  Private (Admin, Dubai-Staff)
 */
export const createDubaiDispatch = asyncHandler(async (req, res) => {
  const {
    bookingId,
    unprocessedImageId,
    dispatchedItems,
    invoiceNumber,
    deliveryDate,
    destination,
    driverName,
    vehicleNumber,
    notes,
  } = req.body;

  // Validation
  if (!bookingId || !unprocessedImageId) {
    res.status(400);
    throw new Error('Booking ID and image ID are required');
  }

  if (!dispatchedItems || dispatchedItems.length === 0) {
    res.status(400);
    throw new Error('Dispatch order must contain at least one item');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Get the booking with all necessary data
    const booking = await Booking.findById(bookingId)
      .populate('company', 'companyName')
      .populate('tilesList.tile', 'name size')
      .session(session);

    if (!booking) {
      throw new Error('Booking not found');
    }

    // 2. Find the unprocessed image
    const unprocessedImage = booking.unprocessedImages.id(unprocessedImageId);
    if (!unprocessedImage) {
      throw new Error('Unprocessed image not found in this booking');
    }

    // 3. Calculate what has been dispatched already (from Dubai dispatches only)
    const existingDispatches = await DubaiDispatchOrder.find({
      booking: bookingId,
    }).session(session);

    const previouslyDispatchedTotals = new Map();
    existingDispatches.forEach((dispatch) => {
      dispatch.dispatchedItems.forEach((item) => {
        const tileId = item.tile.toString();
        previouslyDispatchedTotals.set(
          tileId,
          (previouslyDispatchedTotals.get(tileId) || 0) + item.quantity
        );
      });
    });

    // 4. Validate each item and prepare data
    const validatedItems = [];
    for (const item of dispatchedItems) {
      const tileId = item.tile.toString();

      // Find this tile in the booking
      const bookingItem = booking.tilesList.find(
        (t) => t.tile._id.toString() === tileId
      );

      if (!bookingItem) {
        throw new Error(
          `Tile ${item.tile} is not part of the original booking`
        );
      }

      // Check if dispatching this quantity would exceed the booked amount
      const previouslyDispatched = previouslyDispatchedTotals.get(tileId) || 0;
      const totalAfterThisDispatch = previouslyDispatched + item.quantity;

      if (totalAfterThisDispatch > bookingItem.quantity) {
        throw new Error(
          `Cannot dispatch ${item.quantity} boxes of ${bookingItem.tile.name}. ` +
            `Booked: ${bookingItem.quantity}, Already dispatched: ${previouslyDispatched}, ` +
            `Remaining: ${bookingItem.quantity - previouslyDispatched}`
        );
      }

      // Get full tile details for denormalization
      const tileDetails = await Tile.findById(tileId).session(session);
      if (!tileDetails) {
        throw new Error(`Tile ${tileId} not found in inventory`);
      }

      // Update tile stock (reduce both available and booked)
      await Tile.findByIdAndUpdate(
        tileId,
        {
          $inc: {
            'stockDetails.availableStock': -item.quantity,
            'stockDetails.bookedStock': -item.quantity,
          },
        },
        { session }
      );

      // Prepare validated item with denormalized data
      validatedItems.push({
        tile: tileId,
        tileName: tileDetails.name,
        tileSize: tileDetails.size,
        quantity: item.quantity,
      });
    }

    // 5. Generate unique dispatch number
    const dispatchNumber = await generateId('DDO');

    // 6. Create the Dubai dispatch order
    const dubaiDispatch = new DubaiDispatchOrder({
      dispatchNumber,
      booking: bookingId,
      companyName: booking.company.companyName,
      sourceImage: {
        imageUrl: unprocessedImage.imageUrl,
        publicId: unprocessedImage.publicId,
        unprocessedImageId: unprocessedImage._id,
        uploadedBy: unprocessedImage.uploadedBy,
        uploadedAt: unprocessedImage.uploadedAt,
      },
      dispatchedItems: validatedItems,
      invoiceNumber: invoiceNumber || '',
      deliveryDate: deliveryDate || Date.now(),
      destination: destination || booking.company.companyName,
      driverName: driverName || '',
      vehicleNumber: vehicleNumber || '',
      notes: notes || '',
      createdBy: req.user._id,
      processedAt: Date.now(),
      status: 'Pending',
    });

    const savedDispatch = await dubaiDispatch.save({ session });

    // 7. Update the booking
    // Remove the processed image from unprocessedImages
    booking.unprocessedImages.pull(unprocessedImageId);

    // Add this dispatch to the booking's dispatchOrders array
    booking.dispatchOrders.push(savedDispatch._id);

    // 8. Update booking status based on dispatch completion
    const totalBookedQty = booking.tilesList.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    // Calculate total dispatched including this new dispatch
    const totalDispatched =
      Array.from(previouslyDispatchedTotals.values()).reduce(
        (a, b) => a + b,
        0
      ) + validatedItems.reduce((sum, item) => sum + item.quantity, 0);

    if (totalDispatched >= totalBookedQty) {
      booking.status = 'Completed';
      booking.completedAt = Date.now();
    } else if (totalDispatched > 0) {
      booking.status = 'Partially Dispatched';
    }

    await booking.save({ session });

    // 9. Commit the transaction
    await session.commitTransaction();

    // 10. Return the created dispatch with populated data
    const populatedDispatch = await DubaiDispatchOrder.getWithDetails(
      savedDispatch._id
    );

    res.status(201).json({
      success: true,
      data: populatedDispatch,
      message: 'Dubai dispatch order created successfully',
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(400);
    throw new Error(error.message || 'Failed to create Dubai dispatch order');
  } finally {
    session.endSession();
  }
});

/**
 * @desc    Get all Dubai dispatch orders
 * @route   GET /api/dubai-dispatches
 * @access  Private (Admin, Dubai-Staff, Salesman)
 */
export const getAllDubaiDispatches = asyncHandler(async (req, res) => {
  const {
    status,
    companyName,
    invoiceNumber,
    dateFrom,
    dateTo,
    page = 1,
    limit = 50,
  } = req.query;

  // Build filter
  const filter = {};

  if (status) {
    filter.status = status;
  }

  if (companyName) {
    filter.companyName = { $regex: companyName, $options: 'i' };
  }

  if (invoiceNumber) {
    filter.invoiceNumber = { $regex: invoiceNumber, $options: 'i' };
  }

  if (dateFrom || dateTo) {
    filter.deliveryDate = {};
    if (dateFrom) {
      filter.deliveryDate.$gte = new Date(dateFrom);
    }
    if (dateTo) {
      filter.deliveryDate.$lte = new Date(dateTo);
    }
  }

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Get dispatches
  const dispatches = await DubaiDispatchOrder.find(filter)
    .populate({
      path: 'booking',
      select: 'bookingId company status',
      populate: { path: 'company', select: 'companyName' },
    })
    .populate('dispatchedItems.tile', 'name size')
    .populate('createdBy', 'username email')
    .populate('verifiedBy', 'username')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  // Get total count for pagination
  const total = await DubaiDispatchOrder.countDocuments(filter);

  res.status(200).json({
    success: true,
    data: dispatches,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      limit: parseInt(limit),
    },
  });
});

/**
 * @desc    Get a single Dubai dispatch order by ID
 * @route   GET /api/dubai-dispatches/:id
 * @access  Private (Admin, Dubai-Staff, Salesman)
 */
export const getDubaiDispatchById = asyncHandler(async (req, res) => {
  const dispatch = await DubaiDispatchOrder.getWithDetails(req.params.id);

  if (!dispatch) {
    res.status(404);
    throw new Error('Dubai dispatch order not found');
  }

  res.status(200).json({
    success: true,
    data: dispatch,
  });
});

/**
 * @desc    Update a Dubai dispatch order
 * @route   PUT /api/dubai-dispatches/:id
 * @access  Private (Admin, Dubai-Staff)
 */
export const updateDubaiDispatch = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    dispatchedItems: newItems,
    invoiceNumber,
    deliveryDate,
    destination,
    driverName,
    vehicleNumber,
    notes,
  } = req.body;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Get the dispatch
    const dispatch = await DubaiDispatchOrder.findById(id).session(session);
    if (!dispatch) {
      throw new Error('Dubai dispatch order not found');
    }

    // 2. Get the booking
    const booking = await Booking.findById(dispatch.booking).session(session);
    if (!booking) {
      throw new Error('Associated booking not found');
    }

    // 3. If items are being updated, handle stock adjustments
    if (newItems && Array.isArray(newItems)) {
      // Calculate stock adjustments needed
      const stockAdjustments = new Map();

      // Add back OLD quantities
      for (const oldItem of dispatch.dispatchedItems) {
        const tileId = oldItem.tile.toString();
        stockAdjustments.set(
          tileId,
          (stockAdjustments.get(tileId) || 0) + oldItem.quantity
        );
      }

      // Subtract NEW quantities
      for (const newItem of newItems) {
        const tileId = newItem.tile.toString();
        stockAdjustments.set(
          tileId,
          (stockAdjustments.get(tileId) || 0) - newItem.quantity
        );
      }

      // Validate and apply adjustments
      for (const [tileId, adjustment] of stockAdjustments.entries()) {
        if (adjustment === 0) continue; // No change needed

        // Validate against booking limits
        const bookingItem = booking.tilesList.find(
          (bi) => bi.tile.toString() === tileId
        );

        if (!bookingItem) {
          throw new Error(`Tile ${tileId} is not in the original booking`);
        }

        // Get other dispatches for this booking (excluding current)
        const otherDispatches = await DubaiDispatchOrder.find({
          booking: booking._id,
          _id: { $ne: id },
        }).session(session);

        let totalInOtherDispatches = 0;
        otherDispatches.forEach((od) => {
          const item = od.dispatchedItems.find(
            (i) => i.tile.toString() === tileId
          );
          if (item) totalInOtherDispatches += item.quantity;
        });

        const newQuantityForTile =
          newItems.find((ni) => ni.tile.toString() === tileId)?.quantity || 0;

        if (totalInOtherDispatches + newQuantityForTile > bookingItem.quantity) {
          throw new Error(
            `Cannot update: New quantity for ${bookingItem.tile.name} exceeds booked amount`
          );
        }

        // Apply stock adjustment (positive = add back, negative = subtract)
        await Tile.findByIdAndUpdate(
          tileId,
          {
            $inc: {
              'stockDetails.availableStock': adjustment,
              'stockDetails.bookedStock': adjustment,
            },
          },
          { session }
        );
      }

      // Update items with denormalized data
      const validatedItems = [];
      for (const item of newItems) {
        const tileDetails = await Tile.findById(item.tile).session(session);
        validatedItems.push({
          tile: item.tile,
          tileName: tileDetails.name,
          tileSize: tileDetails.size,
          quantity: item.quantity,
        });
      }

      dispatch.dispatchedItems = validatedItems;
    }

    // 4. Update other fields
    if (invoiceNumber !== undefined) dispatch.invoiceNumber = invoiceNumber;
    if (deliveryDate !== undefined) dispatch.deliveryDate = deliveryDate;
    if (destination !== undefined) dispatch.destination = destination;
    if (driverName !== undefined) dispatch.driverName = driverName;
    if (vehicleNumber !== undefined) dispatch.vehicleNumber = vehicleNumber;
    if (notes !== undefined) dispatch.notes = notes;

    await dispatch.save({ session });

    // 5. Recalculate booking status
    const totalBookedQty = booking.tilesList.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    const allDispatches = await DubaiDispatchOrder.find({
      booking: booking._id,
    }).session(session);

    const totalDispatched = allDispatches.reduce((sum, d) => {
      return (
        sum + d.dispatchedItems.reduce((s, item) => s + item.quantity, 0)
      );
    }, 0);

    if (totalDispatched >= totalBookedQty) {
      booking.status = 'Completed';
      booking.completedAt = Date.now();
    } else if (totalDispatched > 0) {
      booking.status = 'Partially Dispatched';
    } else {
      booking.status = 'Confirmed';
      booking.completedAt = null;
    }

    await booking.save({ session });

    await session.commitTransaction();

    const updatedDispatch = await DubaiDispatchOrder.getWithDetails(id);

    res.status(200).json({
      success: true,
      data: updatedDispatch,
      message: 'Dubai dispatch order updated successfully',
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(400);
    throw new Error(error.message || 'Failed to update Dubai dispatch order');
  } finally {
    session.endSession();
  }
});

/**
 * @desc    Delete a Dubai dispatch order (soft delete with stock reversion)
 * @route   DELETE /api/dubai-dispatches/:id
 * @access  Private (Admin only)
 */
export const deleteDubaiDispatch = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const dispatch = await DubaiDispatchOrder.findById(id).session(session);
    if (!dispatch) {
      throw new Error('Dubai dispatch order not found');
    }

    const booking = await Booking.findById(dispatch.booking).session(session);
    if (!booking) {
      throw new Error('Associated booking not found');
    }

    // Revert stock for each item
    for (const item of dispatch.dispatchedItems) {
      await Tile.findByIdAndUpdate(
        item.tile,
        {
          $inc: {
            'stockDetails.availableStock': item.quantity,
            'stockDetails.bookedStock': item.quantity,
          },
        },
        { session }
      );
    }

    // Remove from booking's dispatchOrders array
    booking.dispatchOrders.pull(dispatch._id);

    // Recalculate booking status
    const totalBookedQty = booking.tilesList.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    const otherDispatches = await DubaiDispatchOrder.find({
      booking: booking._id,
      _id: { $ne: id },
    }).session(session);

    const totalDispatched = otherDispatches.reduce((sum, d) => {
      return (
        sum + d.dispatchedItems.reduce((s, item) => s + item.quantity, 0)
      );
    }, 0);

    if (totalDispatched >= totalBookedQty) {
      booking.status = 'Completed';
    } else if (totalDispatched > 0) {
      booking.status = 'Partially Dispatched';
    } else {
      booking.status = 'Confirmed';
      booking.completedAt = null;
    }

    await booking.save({ session });

    // Soft delete the dispatch
    await DubaiDispatchOrder.archive(id, req.user._id);

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Dubai dispatch order deleted successfully',
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(400);
    throw new Error(error.message || 'Failed to delete Dubai dispatch order');
  } finally {
    session.endSession();
  }
});

/**
 * @desc    Verify a Dubai dispatch order
 * @route   PATCH /api/dubai-dispatches/:id/verify
 * @access  Private (Admin, Dubai-Staff)
 */
export const verifyDubaiDispatch = asyncHandler(async (req, res) => {
  const { remarks } = req.body;

  const dispatch = await DubaiDispatchOrder.findById(req.params.id);

  if (!dispatch) {
    res.status(404);
    throw new Error('Dubai dispatch order not found');
  }

  await dispatch.changeStatus('Verified', req.user._id, remarks || '');

  const updatedDispatch = await DubaiDispatchOrder.getWithDetails(
    req.params.id
  );

  res.status(200).json({
    success: true,
    data: updatedDispatch,
    message: 'Dubai dispatch order verified successfully',
  });
});

/**
 * @desc    Update Dubai dispatch status
 * @route   PATCH /api/dubai-dispatches/:id/status
 * @access  Private (Admin, Dubai-Staff)
 */
export const updateDubaiDispatchStatus = asyncHandler(async (req, res) => {
  const { status, remarks } = req.body;

  if (!status) {
    res.status(400);
    throw new Error('Status is required');
  }

  const dispatch = await DubaiDispatchOrder.findById(req.params.id);

  if (!dispatch) {
    res.status(404);
    throw new Error('Dubai dispatch order not found');
  }

  await dispatch.changeStatus(status, req.user._id, remarks || '');

  const updatedDispatch = await DubaiDispatchOrder.getWithDetails(
    req.params.id
  );

  res.status(200).json({
    success: true,
    data: updatedDispatch,
    message: 'Dubai dispatch status updated successfully',
  });
});

/**
 * @desc    Get Dubai dispatch statistics
 * @route   GET /api/dubai-dispatches/stats
 * @access  Private (Admin, Dubai-Staff)
 */
export const getDubaiDispatchStats = asyncHandler(async (req, res) => {
  const { dateFrom, dateTo } = req.query;

  const filters = {};

  if (dateFrom || dateTo) {
    filters.deliveryDate = {};
    if (dateFrom) filters.deliveryDate.$gte = new Date(dateFrom);
    if (dateTo) filters.deliveryDate.$lte = new Date(dateTo);
  }

  const stats = await DubaiDispatchOrder.getStats(filters);

  res.status(200).json({
    success: true,
    data: stats,
  });
});

/**
 * @desc    Get dispatches for a specific booking
 * @route   GET /api/bookings/:bookingId/dubai-dispatches
 * @access  Private (Admin, Dubai-Staff, Salesman)
 */
export const getDispatchesByBooking = asyncHandler(async (req, res) => {
  const dispatches = await DubaiDispatchOrder.getByBooking(
    req.params.bookingId
  );

  res.status(200).json({
    success: true,
    data: dispatches,
  });
});