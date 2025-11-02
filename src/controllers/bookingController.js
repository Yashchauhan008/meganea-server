

import mongoose from 'mongoose';
import Booking from '../models/bookingModel.js';
import Tile from '../models/tileModel.js';
import asyncHandler from '../utils/asyncHandler.js';
import { generateId } from '../services/idGenerator.js';
import { v2 as cloudinary } from 'cloudinary';

export const createBooking = asyncHandler(async (req, res) => {
  const { company, salesman, lpoNumber, tilesList, notes } = req.body;

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
      company,
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
    .populate('company', 'companyName')
    .populate('salesman', 'username')
    .sort({ createdAt: -1 });
  res.status(200).json(bookings);
});

// --- GET BOOKING BY ID ---
export const getBookingById = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
      .populate('company', 'companyName contactPerson')
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
  const { company, salesman, lpoNumber, tilesList, notes } = req.body;
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
      existingBooking.company = company;
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

/**
 * @desc    Delete a single unprocessed image from a booking
 * @route   DELETE /api/bookings/:bookingId/unprocessed-images/:imageId
 * @access  Private (Owner, Admin, Dubai-Staff)
 */
export const deleteUnprocessedImage = asyncHandler(async (req, res) => {
  const { bookingId, imageId } = req.params;
  const userId = req.user._id;
  const userRole = req.user.role;

  const booking = await Booking.findById(bookingId);

  if (!booking) {
    res.status(404);
    throw new Error('Booking not found');
  }

  const imageToDelete = booking.unprocessedImages.id(imageId);

  if (!imageToDelete) {
    res.status(404);
    throw new Error('Image not found in this booking');
  }

  // --- SECURITY CHECK ---
  // Allow deletion if:
  // 1. The user is an 'admin' or 'dubai-staff'.
  // 2. The user is the one who originally uploaded the image.
  const isOwner = imageToDelete.uploadedBy && imageToDelete.uploadedBy.toString() === userId.toString();
  const isAdminOrStaff = userRole === 'admin' || userRole === 'dubai-staff';

  if (!isOwner && !isAdminOrStaff) {
    res.status(403); // Forbidden
    throw new Error('You are not authorized to delete this note.');
  }

  // Proceed with deletion
  try {
    // 1. Delete the image from Cloudinary to save space
    if (imageToDelete.publicId) {
      await cloudinary.uploader.destroy(imageToDelete.publicId);
    }

    // 2. Remove the image sub-document from the booking's array
    booking.unprocessedImages.pull(imageId);
    
    // 3. Save the parent booking document
    await booking.save();

    res.status(200).json({ message: 'Delivery note deleted successfully.' });

  } catch (error) {
    res.status(500);
    throw new Error('Failed to delete the delivery note. Please try again.');
  }
});