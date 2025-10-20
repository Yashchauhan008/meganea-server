import mongoose from 'mongoose';
import Booking from '../models/bookingModel.js';
import Tile from '../models/tileModel.js';
import asyncHandler from '../utils/asyncHandler.js';
import { generateId } from '../services/idGenerator.js';
import { v2 as cloudinary } from 'cloudinary';

// @desc    Create a new booking
// @route   POST /api/bookings
// @access  Private/Admin, Private/Dubai-Staff, Private/Salesman
export const createBooking = asyncHandler(async (req, res) => {
  const { bookingType, party, salesman, lpoNumber, tilesList, notes } = req.body;

  if (!tilesList || tilesList.length === 0) {
    res.status(400);
    throw new Error('Booking must contain at least one tile');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Check stock and update bookedStock for all tiles in the transaction
    for (const item of tilesList) {
      const tile = await Tile.findById(item.tile).session(session);
      if (!tile) {
        throw new Error(`Tile with ID ${item.tile} not found.`);
      }
      if (tile.availableStock < item.quantity) {
        throw new Error(`Not enough available stock for tile ${tile.name}. Available: ${tile.availableStock}, Requested: ${item.quantity}`);
      }
      tile.stockDetails.bookedStock += item.quantity;
      await tile.save({ session });
    }

    const bookingId = await generateId('BK');

    const booking = new Booking({
      bookingId,
      bookingType,
      party,
      salesman,
      lpoNumber,
      tilesList,
      notes,
      createdBy: req.user._id,
    });

    const createdBooking = await booking.save({ session });

    await session.commitTransaction();
    res.status(201).json(createdBooking);

  } catch (error) {
    await session.abortTransaction();
    res.status(400); // Bad request for stock issues
    throw new Error(error.message || 'Failed to create booking');
  } finally {
    session.endSession();
  }
});

// @desc    Get all bookings
// @route   GET /api/bookings
// @access  Private/Admin, Private/Dubai-Staff, Private/Salesman
export const getAllBookings = asyncHandler(async (req, res) => {
  let query = {};
  if (req.user.role === 'salesman') {
    query.salesman = req.user._id;
  }
  const bookings = await Booking.find(query)
    .populate('party', 'partyName')
    .populate('salesman', 'username')
    .populate('createdBy', 'username')
    .sort({ createdAt: -1 });

  res.status(200).json(bookings);
});

// @desc    Get a single booking by ID
// @route   GET /api/bookings/:id
// @access  Private/Admin, Private/Dubai-Staff, Private/Salesman
export const getBookingById = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('party', 'partyName contactPerson')
    .populate('salesman', 'username')
    .populate('tilesList.tile', 'name tileId size')
    .populate('dispatchOrders');

  if (!booking) {
    res.status(404);
    throw new Error('Booking not found');
  }
  
  if (req.user.role === 'salesman' && booking.salesman._id.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not authorized to view this booking');
  }

  res.status(200).json(booking);
});

// @desc    Add an unprocessed delivery note image to a booking
// @route   POST /api/bookings/:id/upload-image
// @access  Private/Admin, Private/Dubai-Staff, Private/Labor
export const addUnprocessedImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('Image file is required');
  }

  const booking = await Booking.findById(req.params.id);
  if (!booking) {
    // If booking not found, delete the uploaded image to prevent orphans
    await cloudinary.uploader.destroy(req.file.filename);
    res.status(404);
    throw new Error('Booking not found');
  }

  const image = {
    imageUrl: req.file.path,
    publicId: req.file.filename,
    uploadedBy: req.user._id,
  };

  booking.unprocessedImages.push(image);
  await booking.save();

  res.status(200).json(booking);
});

// @desc    Cancel a booking
// @route   PATCH /api/bookings/:id/cancel
// @access  Private/Admin, Private/Dubai-Staff
export const cancelBooking = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const booking = await Booking.findById(req.params.id).session(session);
    if (!booking) {
      throw new Error('Booking not found');
    }

    if (booking.status === 'Completed' || booking.status === 'Cancelled') {
      throw new Error(`Booking is already ${booking.status.toLowerCase()}`);
    }
    
    if (booking.dispatchOrders.length > 0) {
        throw new Error('Cannot cancel a booking that has already been partially or fully dispatched.');
    }

    // Revert the booked stock
    for (const item of booking.tilesList) {
      await Tile.findByIdAndUpdate(
        item.tile,
        { $inc: { 'stockDetails.bookedStock': -item.quantity } },
        { session }
      );
    }

    booking.status = 'Cancelled';
    const updatedBooking = await booking.save({ session });

    await session.commitTransaction();
    res.status(200).json(updatedBooking);

  } catch (error) {
    await session.abortTransaction();
    res.status(400);
    throw new Error(error.message || 'Failed to cancel booking');
  } finally {
    session.endSession();
  }
});

// @desc    Manually update booking status (for admin overrides)
// @route   PATCH /api/bookings/:id/status
// @access  Private/Admin
export const updateBookingStatus = asyncHandler(async (req, res) => {
    // This is a simplified override. A real implementation would have more checks.
    const { status } = req.body;
    const booking = await Booking.findByIdAndUpdate(req.params.id, { status }, { new: true });

    if (!booking) {
        res.status(404);
        throw new Error('Booking not found');
    }

    res.status(200).json(booking);
});
