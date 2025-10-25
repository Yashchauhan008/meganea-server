

import mongoose from 'mongoose';
import Booking from '../models/bookingModel.js';
import Tile from '../models/tileModel.js';
import asyncHandler from '../utils/asyncHandler.js';
import { generateId } from '../services/idGenerator.js';
import { v2 as cloudinary } from 'cloudinary';

export const createBooking = asyncHandler(async (req, res) => {
  const { party, salesman, lpoNumber, tilesList, notes } = req.body;

  if (!tilesList || tilesList.length === 0) {
    res.status(400);
    throw new Error('Booking must contain at least one tile');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    for (const item of tilesList) {
      // We still find the tile to ensure it exists and to update it.
      const tile = await Tile.findById(item.tile).session(session);
      if (!tile) {
        throw new Error(`Tile with ID ${item.tile} not found.`);
      }

      // --- LOGIC CHANGE ---
      // The check for available stock has been REMOVED to allow over-booking.
      // The system now assumes a restock request will handle any deficit.
      
      // We still increase the booked stock amount.
      tile.stockDetails.bookedStock += item.quantity;
      await tile.save({ session });
    }

    const bookingId = await generateId('BK');

    const booking = new Booking({
      bookingId,
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
    res.status(400);
    throw new Error(error.message || 'Failed to create booking');
  } finally {
    session.endSession();
  }
});


// --- CANCEL BOOKING ---
export const cancelBooking = asyncHandler(async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const booking = await Booking.findById(req.params.id).session(session);

        if (!booking) {
            throw new Error('Booking not found');
        }

        if (booking.status === 'Cancelled' || booking.status === 'Completed') {
            throw new Error(`Cannot cancel a booking that is already ${booking.status}.`);
        }
        
        // Revert the booked stock for each tile in the booking
        for (const item of booking.tilesList) {
            await Tile.findByIdAndUpdate(
                item.tile,
                { $inc: { 'stockDetails.bookedStock': -item.quantity } },
                { session } // Ensure this operation is part of the transaction
            );
        }

        // Update the booking status
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

// --- GET ALL BOOKINGS ---
export const getAllBookings = asyncHandler(async (req, res) => {
  // Logic to filter bookings by salesman or other criteria can be added here
  const bookings = await Booking.find({})
    .populate('party', 'partyName')
    .populate('salesman', 'username')
    .sort({ createdAt: -1 });
  res.status(200).json(bookings);
});

// --- GET BOOKING BY ID ---
export const getBookingById = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
      .populate('party', 'partyName contactPerson')
      .populate('salesman', 'username')
      .populate({
          path: 'tilesList.tile',
          select: 'name tileId size conversionFactor'
      })
      .populate({
          path: 'dispatchOrders',
          options: { sort: { createdAt: -1 } }, // Show newest dispatches first
          populate: [
              {
                  path: 'dispatchedItems.tile',
                  select: 'name size'
              },
              {
                  path: 'createdBy',
                  select: 'username'
              }
          ]
      })
      .populate('createdBy', 'username'); // Also populate who created the booking itself

  if (!booking) {
      res.status(404);
      throw new Error('Booking not found');
  }
  res.status(200).json(booking);
});

export const updateBooking = asyncHandler(async (req, res) => {
  const { party, salesman, lpoNumber, tilesList, notes } = req.body;
  const { id } = req.params;

  if (!tilesList || tilesList.length === 0) {
      res.status(400);
      throw new Error('Booking must contain at least one tile');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
      const existingBooking = await Booking.findById(id).session(session);
      if (!existingBooking) {
          throw new Error('Booking not found');
      }
      if (existingBooking.status !== 'Booked') {
          throw new Error(`Cannot edit a booking with status '${existingBooking.status}'`);
      }

      // --- Stock Difference Calculation ---
      const stockAdjustments = new Map();

      // 1. Add back the old quantities to the map
      for (const item of existingBooking.tilesList) {
          const tileId = item.tile.toString();
          stockAdjustments.set(tileId, (stockAdjustments.get(tileId) || 0) - item.quantity);
      }

      // 2. Subtract the new quantities from the map
      for (const item of tilesList) {
          const tileId = item.tile.toString();
          stockAdjustments.set(tileId, (stockAdjustments.get(tileId) || 0) + item.quantity);
      }
      
      // 3. Apply the final calculated differences to the database
      for (const [tileId, adjustment] of stockAdjustments.entries()) {
          if (adjustment === 0) continue; // No change for this tile

          await Tile.findByIdAndUpdate(
              tileId,
              { $inc: { 'stockDetails.bookedStock': adjustment } },
              { session, new: true }
          );
      }
      // --- End of Stock Logic ---

      // Update the booking document itself
      existingBooking.party = party;
      existingBooking.salesman = salesman;
      existingBooking.lpoNumber = lpoNumber;
      existingBooking.notes = notes;
      existingBooking.tilesList = tilesList; // The new list from req.body
      
      const updatedBooking = await existingBooking.save({ session });

      await session.commitTransaction();
      res.status(200).json(updatedBooking);

  } catch (error) {
      await session.abortTransaction();
      res.status(400);
      throw new Error(error.message || 'Failed to update booking');
  } finally {
      session.endSession();
  }
});

export const deleteBooking = asyncHandler(async (req, res) => {
  // This is for administrative "hiding". It does NOT revert stock.
  // For reverting stock, the "cancelBooking" endpoint should be used.
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
      res.status(404);
      throw new Error('Booking not found');
  }

  // Use the static archive method from the model if you have one
  if (typeof Booking.archive === 'function') {
      await Booking.archive(req.params.id);
  } else { // Fallback to manual soft delete
      booking.deleted = true;
      await booking.save();
  }
  
  res.status(200).json({ message: 'Booking archived successfully' });
});

export const addUnprocessedImages = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    res.status(400);
    throw new Error('At least one image file is required');
  }

  const booking = await Booking.findById(req.params.id);
  if (!booking) {
    // If booking not found, delete all uploaded images to prevent orphans
    for (const file of req.files) {
      await cloudinary.uploader.destroy(file.filename);
    }
    res.status(404);
    throw new Error('Booking not found');
  }

  const images = req.files.map(file => ({
    imageUrl: file.path,
    publicId: file.filename,
    uploadedBy: req.user._id,
  }));

  // Push all new images into the unprocessedImages array
  booking.unprocessedImages.push(...images);
  await booking.save();

  res.status(200).json(booking);
});