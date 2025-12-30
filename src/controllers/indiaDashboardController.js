// FILE: backend/src/controllers/indiaDashboardController.js
// 
// This is a SEPARATE controller for India Dashboard
// Your original dashboardController.js for Dubai remains UNTOUCHED
//
// Add to routes:
// import { getIndiaDashboardData } from '../controllers/indiaDashboardController.js';
// router.route('/india').get(protect, getIndiaDashboardData);

import asyncHandler from '../utils/asyncHandler.js';
import Tile from '../models/tileModel.js';
import Factory from '../models/factoryModel.js';
import Container from '../models/containerModel.js';
import Pallet from '../models/palletModel.js';
import PurchaseOrder from '../models/purchaseOrderModel.js';
import RestockRequest from '../models/restockRequestModel.js';
import DispatchOrder from '../models/dispatchOrderModel.js';
import LoadingPlan from '../models/loadingPlanModel.js';

/**
 * @desc    Get India Dashboard Data
 * @route   GET /api/dashboard/india
 * @access  Private (Admin, India Staff)
 */
export const getIndiaDashboardData = asyncHandler(async (req, res) => {
    
    // Date ranges
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    const startOfMonth = new Date(now);
    startOfMonth.setDate(now.getDate() - 30);

    // ==================== OVERVIEW STATS ====================
    const [totalTiles, totalFactories, totalContainers] = await Promise.all([
        Tile.countDocuments({ deleted: { $ne: true } }),
        Factory.countDocuments({ deleted: { $ne: true } }),
        Container.countDocuments({ deleted: { $ne: true } }),
    ]);

    // Stock totals
    const stockTotals = await Pallet.aggregate([
        { $match: { status: 'InFactoryStock', deleted: { $ne: true } } },
        { $group: {
            _id: null,
            totalPallets: { $sum: { $cond: [{ $eq: ['$type', 'Pallet'] }, 1, 0] } },
            totalKhatlis: { $sum: { $cond: [{ $eq: ['$type', 'Khatli'] }, 1, 0] } },
            totalBoxes: { $sum: '$boxCount' }
        }}
    ]);

    const overview = {
        tiles: totalTiles,
        factories: totalFactories,
        containers: totalContainers,
        pallets: stockTotals[0]?.totalPallets || 0,
        khatlis: stockTotals[0]?.totalKhatlis || 0,
        boxes: stockTotals[0]?.totalBoxes || 0,
    };

    // ==================== CONTAINER PIPELINE ====================
    const containerPipeline = await Container.aggregate([
        { $match: { deleted: { $ne: true } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    const containers = {
        empty: 0, loading: 0, loaded: 0, readyToDispatch: 0,
        dispatched: 0, inTransit: 0, delivered: 0
    };
    containerPipeline.forEach(item => {
        const key = item._id?.toLowerCase().replace(/ /g, '').replace('to', 'To');
        if (key === 'empty') containers.empty = item.count;
        else if (key === 'loading') containers.loading = item.count;
        else if (key === 'loaded') containers.loaded = item.count;
        else if (key === 'readytodispatch') containers.readyToDispatch = item.count;
        else if (key === 'dispatched') containers.dispatched = item.count;
        else if (key === 'intransit') containers.inTransit = item.count;
        else if (key === 'delivered') containers.delivered = item.count;
    });

    // ==================== DISPATCH PIPELINE ====================
    const dispatchPipeline = await DispatchOrder.aggregate([
        { $match: { deleted: { $ne: true } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const dispatches = {
        pending: 0, ready: 0, inTransit: 0, delivered: 0, completed: 0, cancelled: 0
    };
    dispatchPipeline.forEach(item => {
        const key = item._id?.toLowerCase().replace(/ /g, '');
        if (key === 'pending') dispatches.pending = item.count;
        else if (key === 'ready') dispatches.ready = item.count;
        else if (key === 'intransit') dispatches.inTransit = item.count;
        else if (key === 'delivered') dispatches.delivered = item.count;
        else if (key === 'completed') dispatches.completed = item.count;
        else if (key === 'cancelled') dispatches.cancelled = item.count;
    });

    // ==================== PO PIPELINE ====================
    const poPipeline = await PurchaseOrder.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const purchaseOrders = {
        draft: 0, sentToFactory: 0, manufacturing: 0, 
        qcInProgress: 0, qcCompleted: 0, packing: 0, completed: 0, cancelled: 0
    };
    poPipeline.forEach(item => {
        const status = item._id;
        if (status === 'Draft') purchaseOrders.draft = item.count;
        else if (status === 'SentToFactory') purchaseOrders.sentToFactory = item.count;
        else if (status === 'Manufacturing') purchaseOrders.manufacturing = item.count;
        else if (status === 'QC_InProgress') purchaseOrders.qcInProgress = item.count;
        else if (status === 'QC_Completed') purchaseOrders.qcCompleted = item.count;
        else if (status === 'Packing') purchaseOrders.packing = item.count;
        else if (status === 'Completed') purchaseOrders.completed = item.count;
        else if (status === 'Cancelled') purchaseOrders.cancelled = item.count;
    });

    // ==================== RESTOCK PIPELINE ====================
    const restockPipeline = await RestockRequest.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const restocks = { pending: 0, processing: 0, completed: 0, cancelled: 0 };
    restockPipeline.forEach(item => {
        const key = item._id?.toLowerCase();
        if (restocks.hasOwnProperty(key)) restocks[key] = item.count;
    });

    // ==================== LOADING PLAN PIPELINE ====================
    const loadingPlanPipeline = await LoadingPlan.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const loadingPlans = { draft: 0, finalized: 0, cancelled: 0 };
    loadingPlanPipeline.forEach(item => {
        const key = item._id?.toLowerCase();
        if (loadingPlans.hasOwnProperty(key)) loadingPlans[key] = item.count;
    });

    // ==================== FACTORY STOCK (for chart) ====================
    const factoryStock = await Pallet.aggregate([
        { $match: { status: 'InFactoryStock', deleted: { $ne: true } } },
        { $group: {
            _id: '$factory',
            pallets: { $sum: { $cond: [{ $eq: ['$type', 'Pallet'] }, 1, 0] } },
            khatlis: { $sum: { $cond: [{ $eq: ['$type', 'Khatli'] }, 1, 0] } },
            boxes: { $sum: '$boxCount' }
        }},
        { $lookup: { from: 'factories', localField: '_id', foreignField: '_id', as: 'factory' }},
        { $unwind: { path: '$factory', preserveNullAndEmptyArrays: true } },
        { $project: {
            _id: 0,
            name: { $ifNull: ['$factory.name', 'Unknown'] },
            pallets: 1, khatlis: 1, boxes: 1
        }},
        { $sort: { boxes: -1 } },
        { $limit: 10 }
    ]);

    // ==================== PRODUCTION TREND (Last 14 days) ====================
    const productionTrend = await Pallet.aggregate([
        { $match: { createdAt: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) }, deleted: { $ne: true } }},
        { $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            pallets: { $sum: { $cond: [{ $eq: ['$type', 'Pallet'] }, 1, 0] } },
            khatlis: { $sum: { $cond: [{ $eq: ['$type', 'Khatli'] }, 1, 0] } },
            boxes: { $sum: '$boxCount' }
        }},
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: '$_id', pallets: 1, khatlis: 1, boxes: 1 }}
    ]);

    // ==================== DISPATCH TREND (Last 14 days) ====================
    const dispatchTrend = await DispatchOrder.aggregate([
        { $match: { createdAt: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) }, deleted: { $ne: true } }},
        { $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
            boxes: { $sum: '$stockSummary.totalBoxes' }
        }},
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: '$_id', count: 1, boxes: 1 }}
    ]);

    // ==================== TOP TILES BY STOCK ====================
    const topTiles = await Pallet.aggregate([
        { $match: { status: 'InFactoryStock', deleted: { $ne: true } } },
        { $group: {
            _id: '$tile',
            pallets: { $sum: { $cond: [{ $eq: ['$type', 'Pallet'] }, 1, 0] } },
            khatlis: { $sum: { $cond: [{ $eq: ['$type', 'Khatli'] }, 1, 0] } },
            boxes: { $sum: '$boxCount' }
        }},
        { $lookup: { from: 'tiles', localField: '_id', foreignField: '_id', as: 'tile' }},
        { $unwind: { path: '$tile', preserveNullAndEmptyArrays: true } },
        { $project: {
            _id: 0,
            name: { $ifNull: ['$tile.name', 'Unknown'] },
            size: '$tile.size',
            pallets: 1, khatlis: 1, boxes: 1
        }},
        { $sort: { boxes: -1 } },
        { $limit: 5 }
    ]);

    // ==================== RECENT DISPATCHES ====================
    const recentDispatches = await DispatchOrder.find({ deleted: { $ne: true } })
        .select('dispatchNumber status destination stockSummary createdAt')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

    // ==================== LOW STOCK ALERTS ====================
    const lowStockTiles = await Tile.find({
        $expr: { $lte: ['$stockDetails.availableStock', '$restockThreshold'] },
        deleted: { $ne: true }
    })
    .select('name size stockDetails.availableStock restockThreshold')
    .sort({ 'stockDetails.availableStock': 1 })
    .limit(5)
    .lean();

    // ==================== WEEKLY SUMMARY ====================
    const weeklySummary = {
        dispatchesCreated: await DispatchOrder.countDocuments({ createdAt: { $gte: startOfWeek }, deleted: { $ne: true } }),
        palletsCreated: await Pallet.countDocuments({ createdAt: { $gte: startOfWeek }, deleted: { $ne: true } }),
        containersLoaded: await Container.countDocuments({ status: { $in: ['Loaded', 'Ready to Dispatch', 'Dispatched', 'In Transit', 'Delivered'] }, updatedAt: { $gte: startOfWeek }, deleted: { $ne: true } }),
        posCompleted: await PurchaseOrder.countDocuments({ status: 'Completed', updatedAt: { $gte: startOfWeek } }),
    };

    // ==================== SEND RESPONSE ====================
    res.status(200).json({
        overview,
        containers,
        dispatches,
        purchaseOrders,
        restocks,
        loadingPlans,
        factoryStock,
        productionTrend,
        dispatchTrend,
        topTiles,
        recentDispatches,
        lowStockTiles,
        weeklySummary,
    });
});

export default { getIndiaDashboardData };