// import mongoose from 'mongoose';
// import DispatchOrder from '../models/dispatchOrderModel.js';
// import Booking from '../models/bookingModel.js';
// import Tile from '../models/tileModel.js';
// import asyncHandler from '../utils/asyncHandler.js';
// import { generateId } from '../services/idGenerator.js';

// // @desc    Create a new dispatch order from an unprocessed image
// // @route   POST /api/dispatches
// // @access  Private/Admin, Private/Dubai-Staff
// export const createDispatchOrder = asyncHandler(async (req, res) => {
//   const { bookingId, unprocessedImageId, dispatchedItems, invoiceNumber } = req.body;

//   if (!dispatchedItems || dispatchedItems.length === 0) {
//     res.status(400);
//     throw new Error('Dispatch order must contain at least one item');
//   }

//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const booking = await Booking.findById(bookingId).session(session);
//     if (!booking) {
//       throw new Error('Booking not found');
//     }

//     const unprocessedImage = booking.unprocessedImages.id(unprocessedImageId);
//     if (!unprocessedImage) {
//       throw new Error('Unprocessed image not found in this booking');
//     }

//     // This logic calculates total dispatched quantities for each tile in the booking so far.
//     const dispatchedTotals = {};
//     const relatedDispatches = await DispatchOrder.find({ booking: bookingId }).session(session);
//     relatedDispatches.forEach(order => {
//         order.dispatchedItems.forEach(item => {
//             dispatchedTotals[item.tile.toString()] = (dispatchedTotals[item.tile.toString()] || 0) + item.quantity;
//         });
//     });

//     // Validate and update stock
//     for (const item of dispatchedItems) {
//       const tile = await Tile.findById(item.tile).session(session);
//       if (!tile) {
//         throw new Error(`Tile with ID ${item.tile} not found`);
//       }

//       // Check if dispatch quantity exceeds booked quantity
//       const bookingItem = booking.tilesList.find(t => t.tile.toString() === item.tile.toString());
//       if (!bookingItem) {
//         throw new Error(`Tile ${tile.name} is not part of the original booking.`);
//       }
      
//       const totalDispatchedForTile = (dispatchedTotals[item.tile.toString()] || 0) + item.quantity;
//       if (totalDispatchedForTile > bookingItem.quantity) {
//           throw new Error(`Dispatch quantity for ${tile.name} exceeds booked quantity. Booked: ${bookingItem.quantity}, Total Dispatched (including this one): ${totalDispatchedForTile}`);
//       }
      
//       // Decrease current stock and booked stock
//       tile.stockDetails.currentStock -= item.quantity;
//       tile.stockDetails.bookedStock -= item.quantity;
      
//       if (tile.stockDetails.currentStock < 0 || tile.stockDetails.bookedStock < 0) {
//           throw new Error(`Stock calculation error for tile ${tile.name}. Please check inventory.`);
//       }

//       await tile.save({ session });
//     }

//     const dispatchNumber = await generateId('DO');

//     const dispatchOrder = new DispatchOrder({
//       dispatchNumber,
//       booking: bookingId,
//       salesman: booking.salesman,
//       invoiceNumber,
//       sourceImage: {
//           imageUrl: unprocessedImage.imageUrl,
//           publicId: unprocessedImage.publicId,
//           unprocessedImageId: unprocessedImage._id,
//       },
//       dispatchedItems,
//       createdBy: req.user._id,
//     });
    
//     const createdDispatchOrder = await dispatchOrder.save({ session });

//     // Remove the image from the unprocessed list
//     booking.unprocessedImages.pull(unprocessedImageId);
//     booking.dispatchOrders.push(createdDispatchOrder._id);

//     // Update booking status
//     let totalBookedQty = booking.tilesList.reduce((acc, item) => acc + item.quantity, 0);
//     let totalDispatchedQty = (await DispatchOrder.find({ booking: bookingId }).session(session)).reduce((acc, order) => acc + order.dispatchedItems.reduce((sum, item) => sum + item.quantity, 0), 0);
    
//     if (totalDispatchedQty >= totalBookedQty) {
//         booking.status = 'Completed';
//         booking.completedAt = Date.now();
//     } else {
//         booking.status = 'Partially Dispatched';
//     }

//     await booking.save({ session });

//     await session.commitTransaction();
//     res.status(201).json(createdDispatchOrder);

//   } catch (error) {
//     await session.abortTransaction();
//     res.status(400);
//     throw new Error(error.message || 'Failed to create dispatch order');
//   } finally {
//     session.endSession();
//   }
// });

// // @desc    Get all dispatch orders
// // @route   GET /api/dispatches
// // @access  Private/Admin, Private/Dubai-Staff
// export const getAllDispatchOrders = asyncHandler(async (req, res) => {
//   const orders = await DispatchOrder.find({})
//     .populate('booking', 'bookingId')
//     .populate('salesman', 'username')
//     .populate('createdBy', 'username')
//     .sort({ createdAt: -1 });
//   res.status(200).json(orders);
// });

// // @desc    Get a single dispatch order by ID
// // @route   GET /api/dispatches/:id
// // @access  Private/Admin, Private/Dubai-Staff
// export const getDispatchOrderById = asyncHandler(async (req, res) => {
//   const order = await DispatchOrder.findById(req.params.id)
//     .populate('booking', 'bookingId company')
//     .populate('salesman', 'username')
//     .populate('dispatchedItems.tile', 'name tileId');

//   if (!order) {
//     res.status(404);
//     throw new Error('Dispatch order not found');
//   }
//   res.status(200).json(order);
// });


import mongoose from 'mongoose';
import DispatchOrder from '../models/dispatchOrderModel.js';
import Booking from '../models/bookingModel.js';
import Tile from '../models/tileModel.js';
import asyncHandler from '../utils/asyncHandler.js';
import { generateId } from '../services/idGenerator.js';

// @desc    Create a new dispatch order from an unprocessed image
// @route   POST /api/dispatches
// @access  Private/Admin, Private/Dubai-Staff
// export const createDispatchOrder = asyncHandler(async (req, res) => {
//   const { bookingId, unprocessedImageId, dispatchedItems, invoiceNumber } = req.body;

//   if (!dispatchedItems || dispatchedItems.length === 0) {
//     res.status(400);
//     throw new Error('Dispatch order must contain at least one item');
//   }

//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const booking = await Booking.findById(bookingId).session(session);
//     if (!booking) {
//       throw new Error('Booking not found');
//     }

//     const unprocessedImage = booking.unprocessedImages.id(unprocessedImageId);
//     if (!unprocessedImage) {
//       throw new Error('Unprocessed image not found in this booking');
//     }

//     // Validate and update stock for each dispatched item
//     for (const item of dispatchedItems) {
//       const tile = await Tile.findById(item.tile).session(session);
//       if (!tile) {
//         throw new Error(`Tile with ID ${item.tile} not found`);
//       }
      
//       // Decrease current stock and booked stock
//       tile.stockDetails.currentStock -= item.quantity;
//       tile.stockDetails.bookedStock -= item.quantity;
      
//       if (tile.stockDetails.currentStock < 0 || tile.stockDetails.bookedStock < 0) {
//           throw new Error(`Stock calculation error for tile ${tile.name}. Please check inventory.`);
//       }

//       await tile.save({ session });
//     }

//     const dispatchNumber = await generateId('DO');

//     const dispatchOrder = new DispatchOrder({
//       dispatchNumber,
//       booking: bookingId,
//       invoiceNumber,
//       sourceImage: {
//           imageUrl: unprocessedImage.imageUrl,
//           publicId: unprocessedImage.publicId,
//           unprocessedImageId: unprocessedImage._id,
//       },
//       dispatchedItems,
//       createdBy: req.user._id,
//     });
    
//     const createdDispatchOrder = await dispatchOrder.save({ session });

//     // Remove the image from the unprocessed list
//     booking.unprocessedImages.pull(unprocessedImageId);
//     booking.dispatchOrders.push(createdDispatchOrder._id);

//     // Update booking status by checking total dispatched vs total booked
//     const allDispatchesForBooking = await DispatchOrder.find({ booking: bookingId }).session(session);
//     const totalDispatchedQty = allDispatchesForBooking.reduce((acc, order) => 
//         acc + order.dispatchedItems.reduce((sum, item) => sum + item.quantity, 0), 0);
    
//     const totalBookedQty = booking.tilesList.reduce((acc, item) => acc + item.quantity, 0);
    
//     if (totalDispatchedQty >= totalBookedQty) {
//         booking.status = 'Completed';
//         booking.completedAt = Date.now();
//     } else {
//         booking.status = 'Partially Dispatched';
//     }

//     await booking.save({ session });

//     await session.commitTransaction();
//     res.status(201).json(createdDispatchOrder);

//   } catch (error) {
//     await session.abortTransaction();
//     res.status(400);
//     throw new Error(error.message || 'Failed to create dispatch order');
//   } finally {
//     session.endSession();
//   }
// });

// @desc    Create a new dispatch order from an unprocessed image
// @route   POST /api/dispatches
// @access  Private/Admin, Private/Dubai-Staff
// export const createDispatchOrder = asyncHandler(async (req, res) => {
//   const { bookingId, unprocessedImageId, dispatchedItems, invoiceNumber } = req.body;

//   if (!dispatchedItems || dispatchedItems.length === 0) {
//     res.status(400).throw(new Error('Dispatch order must contain at least one item'));
//   }

//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const booking = await Booking.findById(bookingId).session(session);
//     if (!booking) {
//       throw new Error('Booking not found');
//     }

//     const unprocessedImage = booking.unprocessedImages.id(unprocessedImageId);
//     if (!unprocessedImage) {
//       throw new Error('Unprocessed image not found in this booking');
//     }

//     // --- THIS IS THE CRITICAL VALIDATION LOGIC ---
//     // 1. Get all previous dispatches for this booking to know what's already been delivered.
//     const relatedDispatches = await DispatchOrder.find({ booking: bookingId }).session(session);
//     const previouslyDispatchedTotals = {};
//     relatedDispatches.forEach(order => {
//         order.dispatchedItems.forEach(item => {
//             const tileId = item.tile.toString();
//             previouslyDispatchedTotals[tileId] = (previouslyDispatchedTotals[tileId] || 0) + item.quantity;
//         });
//     });

//     // 2. Validate and update stock for each item in the CURRENT dispatch.
//     for (const item of dispatchedItems) {
//       const tileId = item.tile.toString();
      
//       // Find the original booked item in the booking
//       const bookingItem = booking.tilesList.find(t => t.tile.toString() === tileId);
//       if (!bookingItem) {
//         throw new Error(`Tile with ID ${tileId} is not part of the original booking.`);
//       }

//       // Check if this dispatch exceeds the remaining booked quantity.
//       const totalDispatchedForTile = (previouslyDispatchedTotals[tileId] || 0) + item.quantity;
//       if (totalDispatchedForTile > bookingItem.quantity) {
//           throw new Error(`Dispatch quantity for tile ${tileId} exceeds remaining booked quantity. Booked: ${bookingItem.quantity}, Already Dispatched: ${previouslyDispatchedTotals[tileId] || 0}, Requested Now: ${item.quantity}`);
//       }
      
//       // Atomically update the Tile stock.
//       // This is the final, irreversible transaction.
//       await Tile.findByIdAndUpdate(
//         tileId,
//         { 
//           $inc: { 
//             'stockDetails.currentStock': -item.quantity, // Physical stock leaves warehouse
//             'stockDetails.bookedStock': -item.quantity   // The "promise" is fulfilled
//           } 
//         },
//         { session }
//       );
//     }
//     // --- END OF CRITICAL LOGIC ---

//     const dispatchNumber = await generateId('DO');

//     const dispatchOrder = new DispatchOrder({
//       dispatchNumber,
//       booking: bookingId,
//       invoiceNumber,
//       sourceImage: {
//           imageUrl: unprocessedImage.imageUrl,
//           publicId: unprocessedImage.publicId,
//           unprocessedImageId: unprocessedImage._id,
//       },
//       dispatchedItems,
//       createdBy: req.user._id,
//     });
    
//     const createdDispatchOrder = await dispatchOrder.save({ session });

//     // Remove the image from the unprocessed list (cleanup).
//     booking.unprocessedImages.pull(unprocessedImageId);
//     booking.dispatchOrders.push(createdDispatchOrder._id);

//     // Update booking status by checking total dispatched vs total booked.
//     const allDispatchesForBooking = await DispatchOrder.find({ booking: bookingId }).session(session);
//     const totalDispatchedQty = allDispatchesForBooking.reduce((acc, order) => 
//         acc + order.dispatchedItems.reduce((sum, item) => sum + item.quantity, 0), 0) + createdDispatchOrder.dispatchedItems.reduce((sum, item) => sum + item.quantity, 0);
    
//     const totalBookedQty = booking.tilesList.reduce((acc, item) => acc + item.quantity, 0);
    
//     if (totalDispatchedQty >= totalBookedQty) {
//         booking.status = 'Completed';
//         booking.completedAt = Date.now();
//     } else {
//         booking.status = 'Partially Dispatched';
//     }

//     await booking.save({ session });

//     await session.commitTransaction();
//     res.status(201).json(createdDispatchOrder);

//   } catch (error) {
//     await session.abortTransaction();
//     res.status(400);
//     throw new Error(error.message || 'Failed to create dispatch order');
//   } finally {
//     session.endSession();
//   }
// });
// Inside backend/src/controllers/dispatchController.js

// @desc    Create a new dispatch order from an unprocessed image
// @route   POST /api/dispatches
// export const createDispatchOrder = asyncHandler(async (req, res) => {
//   const { bookingId, unprocessedImageId, dispatchedItems, invoiceNumber } = req.body;

//   if (!dispatchedItems || dispatchedItems.length === 0) {
//     res.status(400).throw(new Error('Dispatch order must contain at least one item'));
//   }

//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const booking = await Booking.findById(bookingId).session(session);
//     if (!booking) throw new Error('Booking not found');

//     const unprocessedImage = booking.unprocessedImages.id(unprocessedImageId);
//     if (!unprocessedImage) throw new Error('Unprocessed image not found in this booking');

//     const relatedDispatches = await DispatchOrder.find({ booking: bookingId }).session(session);
//     const previouslyDispatchedTotals = new Map();
//     relatedDispatches.forEach(order => {
//         order.dispatchedItems.forEach(item => {
//             const tileId = item.tile.toString();
//             previouslyDispatchedTotals.set(tileId, (previouslyDispatchedTotals.get(tileId) || 0) + item.quantity);
//         });
//     });

//     for (const item of dispatchedItems) {
//       const tileId = item.tile.toString();
//       const bookingItem = booking.tilesList.find(t => t.tile.toString() === tileId);
//       if (!bookingItem) throw new Error(`Tile ${tileId} is not part of the original booking.`);

//       const totalDispatchedForTile = (previouslyDispatchedTotals.get(tileId) || 0) + item.quantity;
//       if (totalDispatchedForTile > bookingItem.quantity) {
//           throw new Error(`Dispatch for ${bookingItem.tile.name} exceeds booked quantity.`);
//       }
      
//       await Tile.findByIdAndUpdate(tileId, { 
//           $inc: { 'stockDetails.currentStock': -item.quantity, 'stockDetails.bookedStock': -item.quantity } 
//       }, { session });
//     }

//     const dispatchNumber = await generateId('DO');
//     const dispatchOrder = new DispatchOrder({
//       dispatchNumber, booking: bookingId, invoiceNumber,
//       sourceImage: { imageUrl: unprocessedImage.imageUrl, publicId: unprocessedImage.publicId, unprocessedImageId: unprocessedImage._id },
//       dispatchedItems, createdBy: req.user._id,
//     });
    
//     const createdDispatchOrder = await dispatchOrder.save({ session });

//     booking.unprocessedImages.pull(unprocessedImageId);
//     booking.dispatchOrders.push(createdDispatchOrder._id);

//     // --- THIS IS THE CORRECTED STATUS LOGIC ---
//     // 1. Get the total booked quantity.
//     const totalBookedQty = booking.tilesList.reduce((acc, item) => acc + item.quantity, 0);

//     // 2. Recalculate the total dispatched quantity INCLUDING the one just created.
//     const newTotalDispatched = Array.from(previouslyDispatchedTotals.values()).reduce((a, b) => a + b, 0)
//                              + dispatchedItems.reduce((acc, item) => acc + item.quantity, 0);

//     // 3. Compare the accurate totals.
//     if (newTotalDispatched >= totalBookedQty) {
//         booking.status = 'Completed';
//         booking.completedAt = Date.now();
//     } else {
//         booking.status = 'Partially Dispatched';
//     }
//     // --- END OF CORRECTED LOGIC ---

//     await booking.save({ session });
//     await session.commitTransaction();
//     res.status(201).json(createdDispatchOrder);

//   } catch (error) {
//     await session.abortTransaction();
//     res.status(400);
//     throw new Error(error.message || 'Failed to create dispatch order');
//   } finally {
//     session.endSession();
//   }
// });

export const createDispatchOrder = asyncHandler(async (req, res) => {
  const { bookingId, unprocessedImageId, dispatchedItems, invoiceNumber } = req.body;

  if (!dispatchedItems || dispatchedItems.length === 0) {
    res.status(400).throw(new Error('Dispatch order must contain at least one item'));
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const booking = await Booking.findById(bookingId).session(session);
    if (!booking) throw new Error('Booking not found');

    const unprocessedImage = booking.unprocessedImages.id(unprocessedImageId);
    if (!unprocessedImage) throw new Error('Unprocessed image not found in this booking');

    const relatedDispatches = await DispatchOrder.find({ booking: bookingId }).session(session);
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
          throw new Error(`Dispatch for tile ${bookingItem.tile.name} exceeds booked quantity.`);
      }
      
      // --- THIS IS THE CORRECTED AND FINAL STOCK LOGIC ---
      // Atomically decrement both the physical stock (currentStock) and the promised stock (bookedStock).
      await Tile.findByIdAndUpdate(
        tileId, 
        { 
          $inc: { 
            'stockDetails.availableStock': -item.quantity, // Physical stock leaves the warehouse.
            'stockDetails.bookedStock': -item.quantity   // The "promise" is fulfilled.
          } 
        }, 
        { session }
      );
      // --- END OF CORRECTION ---
    }

    const dispatchNumber = await generateId('DO');
    const dispatchOrder = new DispatchOrder({
      dispatchNumber, booking: bookingId, invoiceNumber,
      sourceImage: { imageUrl: unprocessedImage.imageUrl, publicId: unprocessedImage.publicId, unprocessedImageId: unprocessedImage._id },
      dispatchedItems, createdBy: req.user._id,
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



// @desc    Get all dispatch orders
// @route   GET /api/dispatches
// @access  Private/Admin, Private/Dubai-Staff
// export const getAllDispatchOrders = asyncHandler(async (req, res) => {
//   const orders = await DispatchOrder.find({})
//     .populate({
//         path: 'booking',
//         select: 'bookingId company dispatchOrders', // Ensure dispatchOrders is included for the edit logic
//         populate: [
//             { path: 'company', select: 'companyName' },
//             { 
//                 path: 'dispatchOrders', // Deeply populate for the edit context calculation
//                 populate: { path: 'dispatchedItems.tile', select: 'name' }
//             }
//         ]
//     })
//     .populate('createdBy', 'username')
//     .populate({ // --- THIS IS THE KEY ADDITION ---
//         path: 'dispatchedItems.tile',
//         select: 'name size' // Select the fields you want to display
//     })
//     .sort({ createdAt: -1 });
//   res.status(200).json(orders);
// });
export const getAllDispatchOrders = asyncHandler(async (req, res) => {
    const orders = await DispatchOrder.find({})
      .populate({
          path: 'booking',
          select: 'bookingId company tilesList dispatchOrders', // Select all fields needed for context
          populate: [
              { 
                  path: 'company', 
                  select: 'companyName' 
              },
              { 
                  // CRITICAL: Populate the tile details within the booking's tilesList
                  path: 'tilesList.tile', 
                  select: 'name size conversionFactor'
              },
              { 
                  // CRITICAL: Also populate the tiles within OTHER dispatches for calculation
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
          // This populates the tiles for the main dispatch order card display
          path: 'dispatchedItems.tile',
          select: 'name size'
      })
      .sort({ createdAt: -1 });
  
    res.status(200).json(orders);
  });
  


// @desc    Get a single dispatch order by ID
// @route   GET /api/dispatches/:id
// @access  Private/Admin, Private/Dubai-Staff
export const getDispatchOrderById = asyncHandler(async (req, res) => {
  const order = await DispatchOrder.findById(req.params.id)
    .populate('booking', 'bookingId')
    .populate('dispatchedItems.tile', 'name tileId');

  if (!order) {
    res.status(404);
    throw new Error('Dispatch order not found');
  }
  res.status(200).json(order);
});

// @desc    Update a dispatch order
// @route   PUT /api/dispatches/:id
// @access  Private/Admin, Private/Dubai-Staff
// export const updateDispatchOrder = asyncHandler(async (req, res) => {
//     const { dispatchedItems, invoiceNumber } = req.body;
//     const { id } = req.params;

//     const session = await mongoose.startSession();
//     session.startTransaction();

//     try {
//         const existingDispatch = await DispatchOrder.findById(id).session(session);
//         if (!existingDispatch) {
//             throw new Error('Dispatch Order not found');
//         }

//         // --- Stock Difference Calculation (The Critical Part) ---
//         const stockAdjustments = new Map();

//         // 1. Add back the OLD quantities to the stock. This reverts the dispatch.
//         for (const item of existingDispatch.dispatchedItems) {
//             const tileId = item.tile.toString();
//             const currentAdjustment = stockAdjustments.get(tileId) || { current: 0, booked: 0 };
//             stockAdjustments.set(tileId, {
//                 current: currentAdjustment.current + item.quantity,
//                 booked: currentAdjustment.booked + item.quantity,
//             });
//         }

//         // 2. Subtract the NEW quantities from the stock. This applies the new dispatch.
//         for (const item of dispatchedItems) {
//             const tileId = item.tile.toString();
//             const currentAdjustment = stockAdjustments.get(tileId) || { current: 0, booked: 0 };
//             stockAdjustments.set(tileId, {
//                 current: currentAdjustment.current - item.quantity,
//                 booked: currentAdjustment.booked - item.quantity,
//             });
//         }
        
//         // 3. Apply the final calculated differences to the database.
//         for (const [tileId, adjustment] of stockAdjustments.entries()) {
//             if (adjustment.current === 0 && adjustment.booked === 0) continue;
//             await Tile.findByIdAndUpdate(
//                 tileId,
//                 { $inc: { 
//                     'stockDetails.availableStock': adjustment.current,
//                     'stockDetails.bookedStock': adjustment.booked,
//                 }},
//                 { session }
//             );
//         }
//         // --- End of Stock Logic ---

//         // Update the dispatch document itself
//         existingDispatch.invoiceNumber = invoiceNumber;
//         existingDispatch.dispatchedItems = dispatchedItems;
        
//         const updatedDispatch = await existingDispatch.save({ session });

//         // We must also re-evaluate the parent booking's status
//         const booking = await Booking.findById(existingDispatch.booking).session(session);
//         if (booking) {
//             const allDispatches = await DispatchOrder.find({ booking: booking._id }).session(session);
//             const totalDispatchedQty = allDispatches.reduce((acc, order) => acc + order.dispatchedItems.reduce((sum, item) => sum + item.quantity, 0), 0);
//             const totalBookedQty = booking.tilesList.reduce((acc, item) => acc + item.quantity, 0);

//             if (totalDispatchedQty >= totalBookedQty) {
//                 booking.status = 'Completed';
//             } else if (totalDispatchedQty > 0) {
//                 booking.status = 'Partially Dispatched';
//             } else {
//                 booking.status = 'Booked';
//             }
//             await booking.save({ session });
//         }

//         await session.commitTransaction();
//         res.status(200).json(updatedDispatch);

//     } catch (error) {
//         await session.abortTransaction();
//         res.status(400);
//         throw new Error(error.message || 'Failed to update dispatch order');
//     } finally {
//         session.endSession();
//     }
// });

export const updateDispatchOrder = asyncHandler(async (req, res) => {
    const { invoiceNumber, dispatchedItems: newItems } = req.body;
    const { id } = req.params;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const dispatch = await DispatchOrder.findById(id).session(session);
        if (!dispatch) throw new Error('Dispatch Order not found.');

        const booking = await Booking.findById(dispatch.booking).session(session);
        if (!booking) throw new Error('Associated booking not found.');

        // --- Intelligent Stock Difference Calculation ---
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
        // The map now holds the net difference, e.g., +2 means we need to add 2 boxes back to stock.

        // 3. Apply the final calculated differences to the database
        for (const [tileId, adjustment] of stockAdjustments.entries()) {
            if (adjustment === 0) continue; // No change for this tile

            // We must also check if the new total dispatch quantity exceeds the booking limit
            const bookingItem = booking.tilesList.find(bi => bi.tile.toString() === tileId);
            const otherDispatches = await DispatchOrder.find({ booking: booking._id, _id: { $ne: id } }).session(session);
            let totalInOtherDispatches = 0;
            otherDispatches.forEach(od => {
                const item = od.dispatchedItems.find(oi => oi.tile.toString() === tileId);
                if (item) totalInOtherDispatches += item.quantity;
            });

            const newQuantityForTile = newItems.find(ni => ni.tile.toString() === tileId)?.quantity || 0;

            if ((totalInOtherDispatches + newQuantityForTile) > bookingItem.quantity) {
                throw new Error(`Editing failed: The new quantity for a tile exceeds the total amount booked.`);
            }

            // Apply the stock change. A positive adjustment means adding stock back.
            await Tile.findByIdAndUpdate(
                tileId,
                { $inc: { 'stockDetails.currentStock': adjustment, 'stockDetails.bookedStock': adjustment } },
                { session }
            );
        }
        // --- End of Stock Logic ---

        // Update the dispatch document itself
        dispatch.invoiceNumber = invoiceNumber;
        dispatch.dispatchedItems = newItems;
        await dispatch.save({ session });

        // Recalculate and update the parent booking's status
        const allDispatches = await DispatchOrder.find({ booking: booking._id }).session(session);
        const totalBookedQty = booking.tilesList.reduce((acc, item) => acc + item.quantity, 0);
        const totalDispatchedQty = allDispatches.reduce((total, order) => total + order.dispatchedItems.reduce((sum, item) => sum + item.quantity, 0), 0);

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
        res.status(400).throw(new Error(error.message || 'Failed to update dispatch order.'));
    } finally {
        session.endSession();
    }
});


// @desc    Delete a dispatch order (reverting stock)
// @route   DELETE /api/dispatches/:id
// @access  Private/Admin
// export const deleteDispatchOrder = asyncHandler(async (req, res) => {
//     const { id } = req.params;

//     const session = await mongoose.startSession();
//     session.startTransaction();

//     try {
//         const dispatchToDelete = await DispatchOrder.findById(id).session(session);
//         if (!dispatchToDelete) {
//             throw new Error('Dispatch Order not found');
//         }

//         // --- Revert Stock Logic ---
//         // Add the dispatched quantities back to the stock.
//         for (const item of dispatchToDelete.dispatchedItems) {
//             await Tile.findByIdAndUpdate(
//                 item.tile,
//                 { $inc: { 
//                     'stockDetails.availableStock': item.quantity,
//                     'stockDetails.bookedStock': item.quantity,
//                 }},
//                 { session }
//             );
//         }
//         // --- End of Revert Logic ---

//         // Remove the dispatch order itself
//         await dispatchToDelete.deleteOne({ session });

//         // Re-evaluate the parent booking's status
//         const booking = await Booking.findById(dispatchToDelete.booking).session(session);
//         if (booking) {
//             // Remove the reference from the booking's dispatchOrders array
//             booking.dispatchOrders.pull(dispatchToDelete._id);

//             const allDispatches = await DispatchOrder.find({ booking: booking._id }).session(session);
//             const totalDispatchedQty = allDispatches.reduce((acc, order) => acc + order.dispatchedItems.reduce((sum, item) => sum + item.quantity, 0), 0);

//             if (totalDispatchedQty > 0) {
//                 booking.status = 'Partially Dispatched';
//             } else {
//                 booking.status = 'Booked'; // Revert to Booked if no dispatches are left
//             }
//             await booking.save({ session });
//         }

//         await session.commitTransaction();
//         res.status(200).json({ message: 'Dispatch Order deleted successfully and stock reverted.' });

//     } catch (error) {
//         await session.abortTransaction();
//         res.status(400);
//         throw new Error(error.message || 'Failed to delete dispatch order');
//     } finally {
//         session.endSession();
//     }
// });

export const deleteDispatchOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const dispatch = await DispatchOrder.findById(id).session(session);
        if (!dispatch) throw new Error('Dispatch Order not found.');

        // Revert the stock for all items in this dispatch
        for (const item of dispatch.dispatchedItems) {
            await Tile.findByIdAndUpdate(
                item.tile,
                { $inc: { 'stockDetails.currentStock': item.quantity, 'stockDetails.bookedStock': item.quantity } },
                { session }
            );
        }

        // Update the parent booking's status
        const booking = await Booking.findById(dispatch.booking).session(session);
        if (booking) {
            const allOtherDispatches = await DispatchOrder.find({ booking: booking._id, _id: { $ne: id } }).session(session);
            const totalBookedQty = booking.tilesList.reduce((acc, item) => acc + item.quantity, 0);
            const remainingDispatchedQty = allOtherDispatches.reduce((total, order) => total + order.dispatchedItems.reduce((sum, item) => sum + item.quantity, 0), 0);

            if (remainingDispatchedQty >= totalBookedQty) {
                booking.status = 'Completed';
            } else if (remainingDispatchedQty > 0) {
                booking.status = 'Partially Dispatched';
            } else {
                booking.status = 'Booked';
            }
            await booking.save({ session });
        }

        // Now, permanently delete the dispatch order document
        await dispatch.deleteOne({ session });

        await session.commitTransaction();
        res.status(200).json({ message: 'Dispatch order deleted and stock reverted successfully.' });

    } catch (error) {
        await session.abortTransaction();
        res.status(400).throw(new Error(error.message || 'Failed to delete dispatch order.'));
    } finally {
        session.endSession();
    }
});