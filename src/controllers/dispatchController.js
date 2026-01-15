import mongoose from 'mongoose';
import asyncHandler from '../utils/asyncHandler.js';
import DispatchOrder from '../models/dispatchOrderModel.js';
import Container from '../models/containerModel.js';
import Pallet from '../models/palletModel.js';
import Factory from '../models/factoryModel.js';
import Tile from '../models/tileModel.js';
import { generateId } from '../services/idGenerator.js';


/**
 * Get containers available for dispatch
 * Accepts containers with 0 pallets OR 0 khatlis (but not both 0)
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
 * @desc    Create new dispatch order
 * @route   POST /api/dispatches
 * @access  Private (Admin, India Staff)
 */
/**
 * Create dispatch order
 * Accepts containers with 0 pallets OR 0 khatlis (but not both 0)
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
              tileId: pallet.tile?._id || null,
              tileName: pallet.tile?.name || 'Unknown Tile',
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
              tileId: khatli.tile?._id || null,
              tileName: khatli.tile?.name || 'Unknown Tile',
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
          factory: container.factory?._id || null,
          factoryName: container.factory?.name || 'Unknown Factory',
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
        if (!container.factory) return; // Skip containers without factory
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
  

// Keep all other functions from previous code...
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

  export const getDispatchOrderById = asyncHandler(async (req, res) => {
    const dispatch = await DispatchOrder.getWithDetails(req.params.id);
  
    if (!dispatch) {
      res.status(404);
      throw new Error('Dispatch order not found');
    }
  
    res.status(200).json(dispatch);
  });

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
  
      // Update factory stock and tile stock if status changes to/from In Transit
      if (oldStatus === 'Ready' && newStatus === 'In Transit') {
        // Move from dispatchedStock to inTransitStock
        const factoryStockUpdates = new Map();
        const tileStockUpdates = new Map(); // Track tile-level transit stock
  
        dispatch.containers.forEach((container) => {
          if (!container.factory) return; // Skip containers without factory
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
            
            // Aggregate boxes by tile for tile-level tracking
            if (item.tileId) {
              const tileId = item.tileId.toString();
              const itemBoxes = item.boxCount * item.quantity;
              if (!tileStockUpdates.has(tileId)) {
                tileStockUpdates.set(tileId, 0);
              }
              tileStockUpdates.set(tileId, tileStockUpdates.get(tileId) + itemBoxes);
            }
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
        
        // Update tile-level inTransitStock (move from inFactoryStock to inTransitStock)
        for (const [tileId, boxes] of tileStockUpdates.entries()) {
          await Tile.findByIdAndUpdate(
            tileId,
            {
              $inc: {
                'stockDetails.inFactoryStock': -boxes,
                'stockDetails.inTransitStock': boxes,
              },
            },
            { session }
          );
        }
      } else if (oldStatus === 'In Transit' && newStatus === 'Delivered') {
        // Move from inTransitStock to deliveredStock
        const factoryStockUpdates = new Map();
        const tileStockUpdates = new Map(); // Track tile-level transit stock
  
        dispatch.containers.forEach((container) => {
          if (!container.factory) return; // Skip containers without factory
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
            
            // Aggregate boxes by tile for tile-level tracking
            if (item.tileId) {
              const tileId = item.tileId.toString();
              const itemBoxes = item.boxCount * item.quantity;
              if (!tileStockUpdates.has(tileId)) {
                tileStockUpdates.set(tileId, 0);
              }
              tileStockUpdates.set(tileId, tileStockUpdates.get(tileId) + itemBoxes);
            }
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
        
        // Update tile-level inTransitStock (clear transit stock since delivered)
        for (const [tileId, boxes] of tileStockUpdates.entries()) {
          await Tile.findByIdAndUpdate(
            tileId,
            {
              $inc: {
                'stockDetails.inTransitStock': -boxes,
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

export const softDeleteDispatch = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { deletionReason } = req.body;
  const userId = req.user._id;
  if (!deletionReason || deletionReason.trim() === '') {
    res.status(400);
    throw new Error('Deletion reason is required');
  }
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const dispatch = await DispatchOrder.findById(id).session(session);
    if (!dispatch) throw new Error('Dispatch order not found');
    if (dispatch.status !== 'Pending' && dispatch.status !== 'Cancelled') {
      throw new Error('Only Pending or Cancelled dispatches can be deleted');
    }
    if (dispatch.status === 'Pending') {
      const containerIds = dispatch.containers.map((c) => c.containerId);
      await Container.updateMany(
        { _id: { $in: containerIds } },
        { $set: { status: 'Loaded', dispatchOrder: null, dispatchedAt: null, dispatchedQuantity: { pallets: 0, khatlis: 0, boxes: 0 } } },
        { session }
      );
      const allItemIds = dispatch.containers.flatMap((c) => c.items.map((item) => item.itemId));
      await Pallet.updateMany(
        { _id: { $in: allItemIds } },
        { $set: { status: 'LoadedInContainer', dispatchedAt: null } },
        { session }
      );
    }
    dispatch.deleted = true;
    dispatch.deletedAt = new Date();
    dispatch.deletedBy = userId;
    dispatch.deletionReason = deletionReason.trim();
    await dispatch.save({ session });
    await session.commitTransaction();
    res.status(200).json({ message: 'Dispatch order deleted successfully' });
  } catch (error) {
    await session.abortTransaction();
    res.status(400);
    throw new Error(error.message);
  } finally {
    session.endSession();
  }
});

export const getDispatchStats = asyncHandler(async (req, res) => {
  const stats = await DispatchOrder.aggregate([
    { $match: { deleted: { $ne: true } } },
    {
      $facet: {
        statusCounts: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        totalDispatches: [{ $count: 'total' }],
        thisMonth: [
          { $match: { createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } },
          { $count: 'total' }
        ],
        inTransit: [{ $match: { status: 'In Transit' } }, { $count: 'total' }],
      },
    },
  ]);
  const result = {
    totalDispatches: stats[0].totalDispatches[0]?.total || 0,
    dispatchesThisMonth: stats[0].thisMonth[0]?.total || 0,
    inTransit: stats[0].inTransit[0]?.total || 0,
    byStatus: {},
  };
  stats[0].statusCounts.forEach((item) => {
    result.byStatus[item._id] = item.count;
  });
  res.status(200).json(result);
});

export const cleanupEmptyDispatches = asyncHandler(async (req, res) => {
  const result = await DispatchOrder.deleteMany({
    $or: [{ containers: { $size: 0 } }, { containers: [] }, { containers: null }],
  });
  res.status(200).json({
    message: `Deleted ${result.deletedCount} empty dispatch orders`,
    count: result.deletedCount,
  });
});

export const getAvailableContainersTest = asyncHandler(async (req, res) => {
    console.log('🧪 TEST: Returning hardcoded containers');
    
    const testContainers = [
      {
        _id: "507f1f77bcf86cd799439011",
        containerNumber: "TEST-001",
        truckNumber: "TRUCK-001",
        status: "Loaded",
        factory: {
          _id: "507f1f77bcf86cd799439012",
          name: "Test Factory",
          address: "Test Address"
        },
        pallets: [
          {
            _id: "507f1f77bcf86cd799439013",
            palletId: "P-001",
            boxCount: 20,
            type: "Pallet",
            tile: {
              _id: "507f1f77bcf86cd799439014",
              name: "Test Tile",
              size: "600x600",
              surface: "Glossy"
            }
          }
        ],
        khatlis: [
          {
            _id: "507f1f77bcf86cd799439015",
            palletId: "K-001",
            boxCount: 10,
            type: "Khatli",
            tile: {
              _id: "507f1f77bcf86cd799439014",
              name: "Test Tile",
              size: "600x600",
              surface: "Glossy"
            }
          }
        ],
        createdAt: new Date()
      }
    ];
  
    res.status(200).json(testContainers);
  });

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
        if (!container.factory) return; // Skip containers without factory
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