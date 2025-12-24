
// import mongoose from 'mongoose';
// import DispatchOrder from '../models/dispatchOrderModel.js';
// import Booking from '../models/bookingModel.js';
// import Tile from '../models/tileModel.js';
// import asyncHandler from '../utils/asyncHandler.js';
// import { generateId } from '../services/idGenerator.js';

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
//           throw new Error(`Dispatch for tile ${bookingItem.tile.name} exceeds booked quantity.`);
//       }
      
//       // --- THIS IS THE CORRECTED AND FINAL STOCK LOGIC ---
//       // Atomically decrement both the physical stock (currentStock) and the promised stock (bookedStock).
//       await Tile.findByIdAndUpdate(
//         tileId, 
//         { 
//           $inc: { 
//             'stockDetails.availableStock': -item.quantity, // Physical stock leaves the warehouse.
//             'stockDetails.bookedStock': -item.quantity   // The "promise" is fulfilled.
//           } 
//         }, 
//         { session }
//       );
//       // --- END OF CORRECTION ---
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

//     const totalBookedQty = booking.tilesList.reduce((acc, item) => acc + item.quantity, 0);
//     const newTotalDispatched = Array.from(previouslyDispatchedTotals.values()).reduce((a, b) => a + b, 0)
//                              + dispatchedItems.reduce((acc, item) => acc + item.quantity, 0);

//     if (newTotalDispatched >= totalBookedQty) {
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
// // export const getAllDispatchOrders = asyncHandler(async (req, res) => {
// //   const orders = await DispatchOrder.find({})
// //     .populate({
// //         path: 'booking',
// //         select: 'bookingId company dispatchOrders', // Ensure dispatchOrders is included for the edit logic
// //         populate: [
// //             { path: 'company', select: 'companyName' },
// //             { 
// //                 path: 'dispatchOrders', // Deeply populate for the edit context calculation
// //                 populate: { path: 'dispatchedItems.tile', select: 'name' }
// //             }
// //         ]
// //     })
// //     .populate('createdBy', 'username')
// //     .populate({ // --- THIS IS THE KEY ADDITION ---
// //         path: 'dispatchedItems.tile',
// //         select: 'name size' // Select the fields you want to display
// //     })
// //     .sort({ createdAt: -1 });
// //   res.status(200).json(orders);
// // });
// export const getAllDispatchOrders = asyncHandler(async (req, res) => {
//     const orders = await DispatchOrder.find({})
//       .populate({
//           path: 'booking',
//           select: 'bookingId company tilesList dispatchOrders', // Select all fields needed for context
//           populate: [
//               { 
//                   path: 'company', 
//                   select: 'companyName' 
//               },
//               { 
//                   // CRITICAL: Populate the tile details within the booking's tilesList
//                   path: 'tilesList.tile', 
//                   select: 'name size conversionFactor'
//               },
//               { 
//                   // CRITICAL: Also populate the tiles within OTHER dispatches for calculation
//                   path: 'dispatchOrders',
//                   populate: { 
//                       path: 'dispatchedItems.tile', 
//                       select: 'name size' 
//                   }
//               }
//           ]
//       })
//       .populate('createdBy', 'username')
//       .populate({
//           // This populates the tiles for the main dispatch order card display
//           path: 'dispatchedItems.tile',
//           select: 'name size'
//       })
//       .sort({ createdAt: -1 });
  
//     res.status(200).json(orders);
//   });
  


// // @desc    Get a single dispatch order by ID
// // @route   GET /api/dispatches/:id
// // @access  Private/Admin, Private/Dubai-Staff
// export const getDispatchOrderById = asyncHandler(async (req, res) => {
//   const order = await DispatchOrder.findById(req.params.id)
//     .populate('booking', 'bookingId')
//     .populate('dispatchedItems.tile', 'name tileId');

//   if (!order) {
//     res.status(404);
//     throw new Error('Dispatch order not found');
//   }
//   res.status(200).json(order);
// });

// export const updateDispatchOrder = asyncHandler(async (req, res) => {
//     const { invoiceNumber, dispatchedItems: newItems } = req.body;
//     const { id } = req.params;

//     const session = await mongoose.startSession();
//     session.startTransaction();

//     try {
//         const dispatch = await DispatchOrder.findById(id).session(session);
//         if (!dispatch) throw new Error('Dispatch Order not found.');

//         const booking = await Booking.findById(dispatch.booking).session(session);
//         if (!booking) throw new Error('Associated booking not found.');

//         // --- Intelligent Stock Difference Calculation ---
//         const stockAdjustments = new Map();

//         // 1. Add back the OLD quantities from this dispatch to the map
//         for (const oldItem of dispatch.dispatchedItems) {
//             const tileId = oldItem.tile.toString();
//             stockAdjustments.set(tileId, (stockAdjustments.get(tileId) || 0) + oldItem.quantity);
//         }

//         // 2. Subtract the NEW quantities from the map
//         for (const newItem of newItems) {
//             const tileId = newItem.tile.toString();
//             stockAdjustments.set(tileId, (stockAdjustments.get(tileId) || 0) - newItem.quantity);
//         }
//         // The map now holds the net difference, e.g., +2 means we need to add 2 boxes back to stock.

//         // 3. Apply the final calculated differences to the database
//         for (const [tileId, adjustment] of stockAdjustments.entries()) {
//             if (adjustment === 0) continue; // No change for this tile

//             // We must also check if the new total dispatch quantity exceeds the booking limit
//             const bookingItem = booking.tilesList.find(bi => bi.tile.toString() === tileId);
//             const otherDispatches = await DispatchOrder.find({ booking: booking._id, _id: { $ne: id } }).session(session);
//             let totalInOtherDispatches = 0;
//             otherDispatches.forEach(od => {
//                 const item = od.dispatchedItems.find(oi => oi.tile.toString() === tileId);
//                 if (item) totalInOtherDispatches += item.quantity;
//             });

//             const newQuantityForTile = newItems.find(ni => ni.tile.toString() === tileId)?.quantity || 0;

//             if ((totalInOtherDispatches + newQuantityForTile) > bookingItem.quantity) {
//                 throw new Error(`Editing failed: The new quantity for a tile exceeds the total amount booked.`);
//             }

//             // Apply the stock change. A positive adjustment means adding stock back.
//             await Tile.findByIdAndUpdate(
//                 tileId,
//                 { $inc: { 'stockDetails.currentStock': adjustment, 'stockDetails.bookedStock': adjustment } },
//                 { session }
//             );
//         }
//         // --- End of Stock Logic ---

//         // Update the dispatch document itself
//         dispatch.invoiceNumber = invoiceNumber;
//         dispatch.dispatchedItems = newItems;
//         await dispatch.save({ session });

//         // Recalculate and update the parent booking's status
//         const allDispatches = await DispatchOrder.find({ booking: booking._id }).session(session);
//         const totalBookedQty = booking.tilesList.reduce((acc, item) => acc + item.quantity, 0);
//         const totalDispatchedQty = allDispatches.reduce((total, order) => total + order.dispatchedItems.reduce((sum, item) => sum + item.quantity, 0), 0);

//         if (totalDispatchedQty >= totalBookedQty) {
//             booking.status = 'Completed';
//         } else if (totalDispatchedQty > 0) {
//             booking.status = 'Partially Dispatched';
//         } else {
//             booking.status = 'Booked';
//         }
//         await booking.save({ session });

//         await session.commitTransaction();
//         res.status(200).json(dispatch);

//     } catch (error) {
//         await session.abortTransaction();
//         res.status(400).throw(new Error(error.message || 'Failed to update dispatch order.'));
//     } finally {
//         session.endSession();
//     }
// });



// export const deleteDispatchOrder = asyncHandler(async (req, res) => {
//     const { id } = req.params;

//     const session = await mongoose.startSession();
//     session.startTransaction();

//     try {
//         const dispatch = await DispatchOrder.findById(id).session(session);
//         if (!dispatch) throw new Error('Dispatch Order not found.');

//         // Revert the stock for all items in this dispatch
//         for (const item of dispatch.dispatchedItems) {
//             await Tile.findByIdAndUpdate(
//                 item.tile,
//                 { $inc: { 'stockDetails.currentStock': item.quantity, 'stockDetails.bookedStock': item.quantity } },
//                 { session }
//             );
//         }

//         // Update the parent booking's status
//         const booking = await Booking.findById(dispatch.booking).session(session);
//         if (booking) {
//             const allOtherDispatches = await DispatchOrder.find({ booking: booking._id, _id: { $ne: id } }).session(session);
//             const totalBookedQty = booking.tilesList.reduce((acc, item) => acc + item.quantity, 0);
//             const remainingDispatchedQty = allOtherDispatches.reduce((total, order) => total + order.dispatchedItems.reduce((sum, item) => sum + item.quantity, 0), 0);

//             if (remainingDispatchedQty >= totalBookedQty) {
//                 booking.status = 'Completed';
//             } else if (remainingDispatchedQty > 0) {
//                 booking.status = 'Partially Dispatched';
//             } else {
//                 booking.status = 'Booked';
//             }
//             await booking.save({ session });
//         }

//         // Now, permanently delete the dispatch order document
//         await dispatch.deleteOne({ session });

//         await session.commitTransaction();
//         res.status(200).json({ message: 'Dispatch order deleted and stock reverted successfully.' });

//     } catch (error) {
//         await session.abortTransaction();
//         res.status(400).throw(new Error(error.message || 'Failed to delete dispatch order.'));
//     } finally {
//         session.endSession();
//     }
// });

import mongoose from 'mongoose';
import DispatchOrder from '../models/dispatchOrderModel.js';
import Container from '../models/containerModel.js';
import Pallet from '../models/palletModel.js';
import Factory from '../models/factoryModel.js';
import asyncHandler from '../utils/asyncHandler.js';
import { generateId } from '../services/idGenerator.js';

/**
 * @desc    Get all containers available for dispatch
 * @route   GET /api/dispatches/containers/available
 * @access  Private (Admin, India Staff)
 */
export const getAvailableContainers = asyncHandler(async (req, res) => {
  const containers = await Container.getAvailableForDispatch();

  // Calculate totals for each container
  const containersWithTotals = containers.map((container) => {
    const totalPallets = container.pallets ? container.pallets.length : 0;
    const totalKhatlis = container.khatlis ? container.khatlis.length : 0;

    let totalBoxes = 0;
    if (container.pallets) {
      totalBoxes += container.pallets.reduce((sum, p) => sum + (p.boxCount || 0), 0);
    }
    if (container.khatlis) {
      totalBoxes += container.khatlis.reduce((sum, k) => sum + (k.boxCount || 0), 0);
    }

    return {
      _id: container._id,
      containerId: container.containerId,
      containerNumber: container.containerNumber,
      truckNumber: container.truckNumber,
      factory: container.factory,
      status: container.status,
      totalPallets,
      totalKhatlis,
      totalItems: totalPallets + totalKhatlis,
      totalBoxes,
      pallets: container.pallets,
      khatlis: container.khatlis,
    };
  });

  res.status(200).json(containersWithTotals);
});

/**
 * @desc    Create a new dispatch order
 * @route   POST /api/dispatches
 * @access  Private (Admin, India Staff)
 */
export const createDispatchOrder = asyncHandler(async (req, res) => {
  const { containerIds, invoiceNumber, dispatchDate, destination, notes } = req.body;

  // Validation
  if (!containerIds || containerIds.length === 0) {
    res.status(400);
    throw new Error('At least one container must be selected');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Fetch all containers
    const containers = await Container.find({ _id: { $in: containerIds } })
      .populate('factory', 'name address')
      .populate({
        path: 'pallets',
        select: 'palletId tile boxCount type',
        populate: { path: 'tile', select: 'name size surface' },
      })
      .populate({
        path: 'khatlis',
        select: 'palletId tile boxCount type',
        populate: { path: 'tile', select: 'name size surface' },
      })
      .session(session);

    // Validate all containers exist and are available
    for (const containerId of containerIds) {
      const container = containers.find((c) => c._id.toString() === containerId.toString());
      if (!container) {
        throw new Error(`Container ${containerId} not found`);
      }
      if (container.status !== 'Loaded' && container.status !== 'Ready to Dispatch') {
        throw new Error(`Container ${container.containerNumber} status is ${container.status}, must be Loaded or Ready to Dispatch`);
      }
      if (container.dispatchOrder) {
        throw new Error(`Container ${container.containerNumber} is already in another dispatch`);
      }
    }

    // Generate dispatch number
    const dispatchNumber = await generateId('DO');

    // Build containers array for dispatch order
    const dispatchContainers = containers.map((container) => {
      const items = [];
      let totalPallets = 0;
      let totalKhatlis = 0;
      let totalBoxes = 0;

      // Add pallets
      if (container.pallets && container.pallets.length > 0) {
        container.pallets.forEach((pallet) => {
          items.push({
            itemId: pallet._id,
            itemType: 'Pallet',
            tileId: pallet.tile._id,
            tileName: pallet.tile.name,
            boxCount: pallet.boxCount,
            quantity: 1,
          });
          totalPallets += 1;
          totalBoxes += pallet.boxCount;
        });
      }

      // Add khatlis
      if (container.khatlis && container.khatlis.length > 0) {
        container.khatlis.forEach((khatli) => {
          items.push({
            itemId: khatli._id,
            itemType: 'Khatli',
            tileId: khatli.tile._id,
            tileName: khatli.tile.name,
            boxCount: khatli.boxCount,
            quantity: 1,
          });
          totalKhatlis += 1;
          totalBoxes += khatli.boxCount;
        });
      }

      return {
        containerId: container._id,
        containerNumber: container.containerNumber,
        truckNumber: container.truckNumber,
        factory: container.factory._id,
        factoryName: container.factory.name,
        items,
        itemCount: items.length,
        totalBoxes,
      };
    });

    // Create dispatch order
    const dispatchOrder = new DispatchOrder({
      dispatchNumber,
      containers: dispatchContainers,
      invoiceNumber: invoiceNumber || '',
      dispatchDate: dispatchDate || new Date(),
      destination: destination || '',
      notes: notes || '',
      status: 'Pending',
      createdBy: req.user._id,
    });

    // Calculate stock summary
    dispatchOrder.calculateStockSummary();

    // Add initial status history
    dispatchOrder.statusHistory.push({
      status: 'Pending',
      changedAt: new Date(),
      changedBy: req.user._id,
      notes: 'Dispatch order created',
    });

    await dispatchOrder.save({ session });

    // Update containers
    for (const container of containers) {
      const dispatchedQuantity = {
        pallets: container.pallets ? container.pallets.length : 0,
        khatlis: container.khatlis ? container.khatlis.length : 0,
        boxes: (container.pallets ? container.pallets.reduce((sum, p) => sum + (p.boxCount || 0), 0) : 0) +
               (container.khatlis ? container.khatlis.reduce((sum, k) => sum + (k.boxCount || 0), 0) : 0),
      };

      await Container.findByIdAndUpdate(
        container._id,
        {
          dispatchOrder: dispatchOrder._id,
          dispatchedAt: new Date(),
          dispatchedQuantity,
          status: 'Dispatched',
        },
        { session }
      );
    }

    // Update pallet/khatli status to 'Dispatched'
    const allItemIds = dispatchContainers.flatMap((c) => c.items.map((i) => i.itemId));
    await Pallet.updateMany(
      { _id: { $in: allItemIds } },
      {
        status: 'Dispatched',
        dispatchOrder: dispatchOrder._id,
      },
      { session }
    );

    // Update factory stock
    const factoryStockUpdates = new Map();
    dispatchContainers.forEach((container) => {
      const factoryId = container.factory.toString();
      if (!factoryStockUpdates.has(factoryId)) {
        factoryStockUpdates.set(factoryId, { pallets: 0, khatlis: 0, boxes: 0 });
      }
      const update = factoryStockUpdates.get(factoryId);
      
      container.items.forEach((item) => {
        if (item.itemType === 'Pallet') {
          update.pallets += item.quantity;
        } else {
          update.khatlis += item.quantity;
        }
        update.boxes += item.boxCount * item.quantity;
      });
    });

    // Apply factory stock updates
    for (const [factoryId, update] of factoryStockUpdates.entries()) {
      await Factory.findByIdAndUpdate(
        factoryId,
        {
          $inc: {
            'stock.inFactoryStock.pallets': -update.pallets,
            'stock.inFactoryStock.khatlis': -update.khatlis,
            'stock.inFactoryStock.totalBoxes': -update.boxes,
            'stock.dispatchedStock.pallets': update.pallets,
            'stock.dispatchedStock.khatlis': update.khatlis,
            'stock.dispatchedStock.totalBoxes': update.boxes,
          },
        },
        { session }
      );
    }

    await session.commitTransaction();

    // Fetch and return created dispatch with populated data
    const createdDispatch = await DispatchOrder.getWithDetails(dispatchOrder._id);
    res.status(201).json(createdDispatch);
  } catch (error) {
    await session.abortTransaction();
    res.status(400);
    throw new Error(error.message || 'Failed to create dispatch order');
  } finally {
    session.endSession();
  }
});

/**
 * @desc    Get all dispatch orders
 * @route   GET /api/dispatches
 * @access  Private (Admin, India Staff)
 */
export const getAllDispatchOrders = asyncHandler(async (req, res) => {
  const { status, factoryId, dateFrom, dateTo } = req.query;

  let filter = {};

  if (status) {
    filter.status = status;
  }

  if (dateFrom || dateTo) {
    filter.dispatchDate = {};
    if (dateFrom) {
      filter.dispatchDate.$gte = new Date(dateFrom);
    }
    if (dateTo) {
      filter.dispatchDate.$lte = new Date(dateTo);
    }
  }

  // If factoryId provided, filter containers by factory
  if (factoryId) {
    filter['containers.factory'] = new mongoose.Types.ObjectId(factoryId);
  }

  const dispatches = await DispatchOrder.find(filter)
    .populate({
      path: 'containers.containerId',
      select: 'containerNumber truckNumber status',
    })
    .populate({
      path: 'containers.factory',
      select: 'name address',
    })
    .populate('createdBy', 'username email')
    .sort({ createdAt: -1 });

  res.status(200).json(dispatches);
});

/**
 * @desc    Get single dispatch order
 * @route   GET /api/dispatches/:id
 * @access  Private (Admin, India Staff)
 */
export const getDispatchOrderById = asyncHandler(async (req, res) => {
  const dispatch = await DispatchOrder.getWithDetails(req.params.id);

  if (!dispatch) {
    res.status(404);
    throw new Error('Dispatch order not found');
  }

  res.status(200).json(dispatch);
});

/**
 * @desc    Update dispatch order (add/remove containers)
 * @route   PUT /api/dispatches/:id
 * @access  Private (Admin, India Staff)
 */
export const updateDispatchOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { containerIdsToAdd, containerIdsToRemove, invoiceNumber, destination, notes } = req.body;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const dispatch = await DispatchOrder.findById(id).session(session);

    if (!dispatch) {
      throw new Error('Dispatch order not found');
    }

    // Can only edit pending dispatches
    if (dispatch.status !== 'Pending') {
      throw new Error(`Cannot edit dispatch with status '${dispatch.status}'. Only pending dispatches can be edited.`);
    }

    const factoryStockUpdates = new Map();

    // Remove containers
    if (containerIdsToRemove && containerIdsToRemove.length > 0) {
      for (const containerId of containerIdsToRemove) {
        const containerIndex = dispatch.containers.findIndex((c) => c.containerId.toString() === containerId.toString());

        if (containerIndex === -1) {
          throw new Error(`Container ${containerId} not found in this dispatch`);
        }

        const removedContainer = dispatch.containers[containerIndex];

        // Revert stock
        const factoryId = removedContainer.factory.toString();
        if (!factoryStockUpdates.has(factoryId)) {
          factoryStockUpdates.set(factoryId, { pallets: 0, khatlis: 0, boxes: 0 });
        }
        const update = factoryStockUpdates.get(factoryId);

        removedContainer.items.forEach((item) => {
          if (item.itemType === 'Pallet') {
            update.pallets -= item.quantity;
          } else {
            update.khatlis -= item.quantity;
          }
          update.boxes -= item.boxCount * item.quantity;
        });

        // Update container
        await Container.findByIdAndUpdate(
          containerId,
          {
            dispatchOrder: null,
            dispatchedAt: null,
            dispatchedQuantity: { pallets: 0, khatlis: 0, boxes: 0 },
            status: 'Loaded',
          },
          { session }
        );

        // Update pallets/khatlis
        const itemIds = removedContainer.items.map((i) => i.itemId);
        await Pallet.updateMany(
          { _id: { $in: itemIds } },
          {
            status: 'InFactoryStock',
            dispatchOrder: null,
          },
          { session }
        );

        // Remove from dispatch
        dispatch.containers.splice(containerIndex, 1);
      }
    }

    // Add containers
    if (containerIdsToAdd && containerIdsToAdd.length > 0) {
      const newContainers = await Container.find({ _id: { $in: containerIdsToAdd } })
        .populate('factory', 'name address')
        .populate({
          path: 'pallets',
          select: 'palletId tile boxCount type',
          populate: { path: 'tile', select: 'name size surface' },
        })
        .populate({
          path: 'khatlis',
          select: 'palletId tile boxCount type',
          populate: { path: 'tile', select: 'name size surface' },
        })
        .session(session);

      for (const container of newContainers) {
        // Validate
        if (container.status !== 'Loaded' && container.status !== 'Ready to Dispatch') {
          throw new Error(`Container ${container.containerNumber} status is ${container.status}`);
        }
        if (container.dispatchOrder) {
          throw new Error(`Container ${container.containerNumber} is already in another dispatch`);
        }

        // Build container data
        const items = [];
        let totalBoxes = 0;

        if (container.pallets && container.pallets.length > 0) {
          container.pallets.forEach((pallet) => {
            items.push({
              itemId: pallet._id,
              itemType: 'Pallet',
              tileId: pallet.tile._id,
              tileName: pallet.tile.name,
              boxCount: pallet.boxCount,
              quantity: 1,
            });
            totalBoxes += pallet.boxCount;
          });
        }

        if (container.khatlis && container.khatlis.length > 0) {
          container.khatlis.forEach((khatli) => {
            items.push({
              itemId: khatli._id,
              itemType: 'Khatli',
              tileId: khatli.tile._id,
              tileName: khatli.tile.name,
              boxCount: khatli.boxCount,
              quantity: 1,
            });
            totalBoxes += khatli.boxCount;
          });
        }

        // Update stock
        const factoryId = container.factory._id.toString();
        if (!factoryStockUpdates.has(factoryId)) {
          factoryStockUpdates.set(factoryId, { pallets: 0, khatlis: 0, boxes: 0 });
        }
        const update = factoryStockUpdates.get(factoryId);

        items.forEach((item) => {
          if (item.itemType === 'Pallet') {
            update.pallets += item.quantity;
          } else {
            update.khatlis += item.quantity;
          }
          update.boxes += item.boxCount * item.quantity;
        });

        // Add to dispatch
        dispatch.containers.push({
          containerId: container._id,
          containerNumber: container.containerNumber,
          truckNumber: container.truckNumber,
          factory: container.factory._id,
          factoryName: container.factory.name,
          items,
          itemCount: items.length,
          totalBoxes,
        });

        // Update container
        const dispatchedQuantity = {
          pallets: container.pallets ? container.pallets.length : 0,
          khatlis: container.khatlis ? container.khatlis.length : 0,
          boxes: totalBoxes,
        };

        await Container.findByIdAndUpdate(
          container._id,
          {
            dispatchOrder: dispatch._id,
            dispatchedAt: new Date(),
            dispatchedQuantity,
            status: 'Dispatched',
          },
          { session }
        );

        // Update pallets/khatlis
        const allItemIds = items.map((i) => i.itemId);
        await Pallet.updateMany(
          { _id: { $in: allItemIds } },
          {
            status: 'Dispatched',
            dispatchOrder: dispatch._id,
          },
          { session }
        );
      }
    }

    // Update dispatch details
    if (invoiceNumber !== undefined) dispatch.invoiceNumber = invoiceNumber;
    if (destination !== undefined) dispatch.destination = destination;
    if (notes !== undefined) dispatch.notes = notes;

    // Recalculate stock summary
    dispatch.calculateStockSummary();

    await dispatch.save({ session });

    // Apply factory stock updates
    for (const [factoryId, update] of factoryStockUpdates.entries()) {
      await Factory.findByIdAndUpdate(
        factoryId,
        {
          $inc: {
            'stock.inFactoryStock.pallets': update.pallets,
            'stock.inFactoryStock.khatlis': update.khatlis,
            'stock.inFactoryStock.totalBoxes': update.boxes,
            'stock.dispatchedStock.pallets': -update.pallets,
            'stock.dispatchedStock.khatlis': -update.khatlis,
            'stock.dispatchedStock.totalBoxes': -update.boxes,
          },
        },
        { session }
      );
    }

    await session.commitTransaction();

    const updatedDispatch = await DispatchOrder.getWithDetails(dispatch._id);
    res.status(200).json(updatedDispatch);
  } catch (error) {
    await session.abortTransaction();
    res.status(400);
    throw new Error(error.message || 'Failed to update dispatch order');
  } finally {
    session.endSession();
  }
});

/**
 * @desc    Update dispatch status
 * @route   PATCH /api/dispatches/:id/status
 * @access  Private (Admin, India Staff)
 */
export const updateDispatchStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newStatus, notes } = req.body;

  const validStatuses = ['Pending', 'Ready', 'In Transit', 'Delivered', 'Completed', 'Cancelled'];

  if (!validStatuses.includes(newStatus)) {
    res.status(400);
    throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const dispatch = await DispatchOrder.findById(id).session(session);

    if (!dispatch) {
      throw new Error('Dispatch order not found');
    }

    const oldStatus = dispatch.status;

    // Validate status progression
    const statusFlow = {
      Pending: ['Ready', 'Cancelled'],
      Ready: ['In Transit', 'Pending'],
      'In Transit': ['Delivered'],
      Delivered: ['Completed'],
      Completed: [],
      Cancelled: ['Pending'],
    };

    if (!statusFlow[oldStatus].includes(newStatus)) {
      throw new Error(`Cannot change status from '${oldStatus}' to '${newStatus}'`);
    }

    // Update dispatch status
    dispatch.addStatusChange(newStatus, req.user._id, notes || '');
    await dispatch.save({ session });

    // Update all containers in dispatch
    for (const container of dispatch.containers) {
      let containerStatus = newStatus;
      if (newStatus === 'Cancelled') {
        containerStatus = 'Loaded';
      }

      await Container.findByIdAndUpdate(
        container.containerId,
        { status: containerStatus },
        { session }
      );
    }

    // Update factory stock if status changes to/from In Transit
    if (oldStatus === 'Ready' && newStatus === 'In Transit') {
      // Move from dispatchedStock to inTransitStock
      const factoryStockUpdates = new Map();

      dispatch.containers.forEach((container) => {
        const factoryId = container.factory.toString();
        if (!factoryStockUpdates.has(factoryId)) {
          factoryStockUpdates.set(factoryId, { pallets: 0, khatlis: 0, boxes: 0 });
        }
        const update = factoryStockUpdates.get(factoryId);

        container.items.forEach((item) => {
          if (item.itemType === 'Pallet') {
            update.pallets += item.quantity;
          } else {
            update.khatlis += item.quantity;
          }
          update.boxes += item.boxCount * item.quantity;
        });
      });

      for (const [factoryId, update] of factoryStockUpdates.entries()) {
        await Factory.findByIdAndUpdate(
          factoryId,
          {
            $inc: {
              'stock.dispatchedStock.pallets': -update.pallets,
              'stock.dispatchedStock.khatlis': -update.khatlis,
              'stock.dispatchedStock.totalBoxes': -update.boxes,
              'stock.inTransitStock.pallets': update.pallets,
              'stock.inTransitStock.khatlis': update.khatlis,
              'stock.inTransitStock.totalBoxes': update.boxes,
            },
          },
          { session }
        );
      }
    } else if (oldStatus === 'In Transit' && newStatus === 'Delivered') {
      // Move from inTransitStock to deliveredStock
      const factoryStockUpdates = new Map();

      dispatch.containers.forEach((container) => {
        const factoryId = container.factory.toString();
        if (!factoryStockUpdates.has(factoryId)) {
          factoryStockUpdates.set(factoryId, { pallets: 0, khatlis: 0, boxes: 0 });
        }
        const update = factoryStockUpdates.get(factoryId);

        container.items.forEach((item) => {
          if (item.itemType === 'Pallet') {
            update.pallets += item.quantity;
          } else {
            update.khatlis += item.quantity;
          }
          update.boxes += item.boxCount * item.quantity;
        });
      });

      for (const [factoryId, update] of factoryStockUpdates.entries()) {
        await Factory.findByIdAndUpdate(
          factoryId,
          {
            $inc: {
              'stock.inTransitStock.pallets': -update.pallets,
              'stock.inTransitStock.khatlis': -update.khatlis,
              'stock.inTransitStock.totalBoxes': -update.boxes,
              'stock.deliveredStock.pallets': update.pallets,
              'stock.deliveredStock.khatlis': update.khatlis,
              'stock.deliveredStock.totalBoxes': update.boxes,
            },
          },
          { session }
        );
      }
    }

    await session.commitTransaction();

    const updatedDispatch = await DispatchOrder.getWithDetails(dispatch._id);
    res.status(200).json(updatedDispatch);
  } catch (error) {
    await session.abortTransaction();
    res.status(400);
    throw new Error(error.message || 'Failed to update dispatch status');
  } finally {
    session.endSession();
  }
});

/**
 * @desc    Delete dispatch order (soft delete, only if Pending)
 * @route   DELETE /api/dispatches/:id
 * @access  Private (Admin)
 */
export const deleteDispatchOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const dispatch = await DispatchOrder.findById(id).session(session);

    if (!dispatch) {
      throw new Error('Dispatch order not found');
    }

    if (dispatch.status !== 'Pending') {
      throw new Error(`Cannot delete dispatch with status '${dispatch.status}'. Only pending dispatches can be deleted.`);
    }

    const factoryStockUpdates = new Map();

    // Revert stock for all containers
    dispatch.containers.forEach((container) => {
      const factoryId = container.factory.toString();
      if (!factoryStockUpdates.has(factoryId)) {
        factoryStockUpdates.set(factoryId, { pallets: 0, khatlis: 0, boxes: 0 });
      }
      const update = factoryStockUpdates.get(factoryId);

      container.items.forEach((item) => {
        if (item.itemType === 'Pallet') {
          update.pallets += item.quantity;
        } else {
          update.khatlis += item.quantity;
        }
        update.boxes += item.boxCount * item.quantity;
      });
    });

    // Update containers
    for (const container of dispatch.containers) {
      await Container.findByIdAndUpdate(
        container.containerId,
        {
          dispatchOrder: null,
          dispatchedAt: null,
          dispatchedQuantity: { pallets: 0, khatlis: 0, boxes: 0 },
          status: 'Loaded',
        },
        { session }
      );
    }

    // Update pallets/khatlis
    const allItemIds = dispatch.containers.flatMap((c) => c.items.map((i) => i.itemId));
    await Pallet.updateMany(
      { _id: { $in: allItemIds } },
      {
        status: 'InFactoryStock',
        dispatchOrder: null,
      },
      { session }
    );

    // Apply factory stock updates
    for (const [factoryId, update] of factoryStockUpdates.entries()) {
      await Factory.findByIdAndUpdate(
        factoryId,
        {
          $inc: {
            'stock.inFactoryStock.pallets': update.pallets,
            'stock.inFactoryStock.khatlis': update.khatlis,
            'stock.inFactoryStock.totalBoxes': update.boxes,
            'stock.dispatchedStock.pallets': -update.pallets,
            'stock.dispatchedStock.khatlis': -update.khatlis,
            'stock.dispatchedStock.totalBoxes': -update.boxes,
          },
        },
        { session }
      );
    }

    // Soft delete
    dispatch.deleted = true;
    dispatch.deletedAt = new Date();
    dispatch.deletedBy = req.user._id;
    dispatch.deletionReason = reason || 'No reason provided';
    await dispatch.save({ session });

    await session.commitTransaction();

    res.status(200).json({ message: 'Dispatch order deleted successfully', dispatchNumber: dispatch.dispatchNumber });
  } catch (error) {
    await session.abortTransaction();
    res.status(400);
    throw new Error(error.message || 'Failed to delete dispatch order');
  } finally {
    session.endSession();
  }
});
