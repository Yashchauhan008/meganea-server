const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Tile = require('../models/Tile');
const { generateUniqueId } = require('../utils/generateId');

// @desc    Create a new booking
// @route   POST /api/bookings
// @access  Private/Dubai-Staff
const createBooking = asyncHandler(async (req, res) => {
  const { customerName, contactNumber, tilesList, notes } = req.body;

  if (!tilesList || tilesList.length === 0) {
    res.status(400);
    throw new Error('Booking must include at least one tile');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const bookingId = await generateUniqueId(Booking, 'BKN');
    
    const booking = new Booking({
      bookingId,
      customerName,
      contactNumber,
      tilesList,
      notes,
      createdBy: req.user._id,
    });

    // Update bookedStock for each tile
    for (const item of tilesList) {
      await Tile.findByIdAndUpdate(
        item.tile,
        { $inc: { 'stockDetails.bookedStock': item.quantity } },
        { session }
      );
    }

    const createdBooking = await booking.save({ session });
    await session.commitTransaction();
    res.status(201).json(createdBooking);

  } catch (error) {
    await session.abortTransaction();
    throw new Error(`Booking creation failed: ${error.message}`);
  } finally {
    session.endSession();
  }
});

// @desc    Fulfill a booking
// @route   PUT /api/bookings/:id/fulfill
// @access  Private/Dubai-Staff
const fulfillBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    res.status(404);
    throw new Error('Booking not found');
  }

  if (booking.status !== 'Booked') {
    res.status(400);
    throw new Error(`Cannot fulfill a booking with status: ${booking.status}`);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Decrease currentStock and bookedStock
    for (const item of booking.tilesList) {
      const tile = await Tile.findById(item.tile).session(session);
      if (tile.stockDetails.currentStock < item.quantity) {
        throw new Error(`Not enough stock for tile ${tile.name}. Required: ${item.quantity}, Available: ${tile.stockDetails.currentStock}`);
      }
      await Tile.findByIdAndUpdate(
        item.tile,
        { 
          $inc: {
            'stockDetails.currentStock': -item.quantity,
            'stockDetails.bookedStock': -item.quantity,
          }
        },
        { session }
      );
    }

    booking.status = 'Fulfilled';
    booking.fulfilledAt = Date.now();
    const updatedBooking = await booking.save({ session });

    await session.commitTransaction();
    res.status(200).json(updatedBooking);

  } catch (error) {
    await session.abortTransaction();
    throw new Error(`Fulfillment failed: ${error.message}`);
  } finally {
    session.endSession();
  }
});

// @desc    Cancel a booking
// @route   PUT /api/bookings/:id/cancel
// @access  Private/Dubai-Staff or Admin
const cancelBooking = asyncHandler(async (req, res) => {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
        res.status(404);
        throw new Error('Booking not found');
    }

    if (booking.status === 'Fulfilled' || booking.status === 'Cancelled') {
        res.status(400);
        throw new Error(`Cannot cancel a booking with status: ${booking.status}`);
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Revert bookedStock
        for (const item of booking.tilesList) {
            await Tile.findByIdAndUpdate(
                item.tile,
                { $inc: { 'stockDetails.bookedStock': -item.quantity } },
                { session }
            );
        }

        booking.status = 'Cancelled';
        booking.cancelledAt = Date.now();
        const updatedBooking = await booking.save({ session });

        await session.commitTransaction();
        res.status(200).json(updatedBooking);

    } catch (error) {
        await session.abortTransaction();
        throw new Error(`Cancellation failed: ${error.message}`);
    } finally {
        session.endSession();
    }
});


// @desc    Get all bookings
// @route   GET /api/bookings
// @access  Private
const getAllBookings = asyncHandler(async (req, res) => {
    const bookings = await Booking.find({}).populate('createdBy', 'username').populate('tilesList.tile', 'name tileId');
    res.status(200).json(bookings);
});

module.exports = { createBooking, fulfillBooking, cancelBooking, getAllBookings };
