// FILE: backend/src/controllers/reportController.js
//
// Comprehensive Report Generation for India Module
// Fixed to match actual model structures
//
// Add to server.js:
// import reportRoutes from './routes/reportRoutes.js';
// app.use('/api/reports', reportRoutes);

import asyncHandler from '../utils/asyncHandler.js';
import Tile from '../models/tileModel.js';
import Factory from '../models/factoryModel.js';
import Container from '../models/containerModel.js';
import Pallet from '../models/palletModel.js';
import PurchaseOrder from '../models/purchaseOrderModel.js';
import RestockRequest from '../models/restockRequestModel.js';
import DispatchOrder from '../models/dispatchOrderModel.js';
import LoadingPlan from '../models/loadingPlanModel.js';

// ===============================================
// TILES REPORT
// ===============================================
export const getTilesReportData = asyncHandler(async (req, res) => {
    // Get all tiles
    const tiles = await Tile.find({ deleted: { $ne: true } })
        .populate('manufacturingFactories', 'name')
        .sort({ createdAt: -1 })
        .lean();

    // Get factory stock counts for each tile (InFactoryStock pallets)
    const factoryStockByTile = await Pallet.aggregate([
        { $match: { status: 'InFactoryStock' } },
        { $group: {
            _id: '$tile',
            inFactoryPallets: { $sum: { $cond: [{ $eq: ['$type', 'Pallet'] }, 1, 0] } },
            inFactoryKhatlis: { $sum: { $cond: [{ $eq: ['$type', 'Khatli'] }, 1, 0] } },
            inFactoryBoxes: { $sum: '$boxCount' }
        }}
    ]);
    const factoryStockMap = {};
    factoryStockByTile.forEach(s => { 
        factoryStockMap[s._id?.toString()] = s; 
    });

    const reportData = tiles.map((tile, idx) => {
        const factoryStock = factoryStockMap[tile._id?.toString()] || { inFactoryBoxes: 0 };
        return {
            sNo: idx + 1,
            tileNumber: tile.tileNumber || '-',
            name: tile.name || '-',
            size: tile.size || '-',
            surface: tile.surface || '-',
            boxesPerSqMeter: tile.boxesPerSqMeter || 0,
            restockThreshold: tile.restockThreshold || 0,
            availableStock: tile.stockDetails?.availableStock || 0,
            bookedStock: tile.stockDetails?.bookedStock || 0,
            restockingStock: tile.stockDetails?.restockingStock || 0,
            inFactoryStock: factoryStock.inFactoryBoxes || 0,
            factories: (tile.manufacturingFactories || []).map(f => f?.name || 'Unknown').join(', ') || '-',
            status: tile.status || 'Active',
        };
    });

    // Calculate summaries
    const totalAvailable = reportData.reduce((sum, t) => sum + t.availableStock, 0);
    const totalBooked = reportData.reduce((sum, t) => sum + t.bookedStock, 0);
    const totalInFactory = reportData.reduce((sum, t) => sum + t.inFactoryStock, 0);
    const lowStock = reportData.filter(t => t.availableStock > 0 && t.availableStock <= t.restockThreshold).length;

    const summary = {
        totalTiles: tiles.length,
        totalAvailableStock: totalAvailable,
        totalBookedStock: totalBooked,
        totalInFactoryStock: totalInFactory,
        lowStockCount: lowStock,
    };

    res.json({ reportData, summary, reportType: 'tiles', generatedAt: new Date().toISOString() });
});

// ===============================================
// FACTORIES REPORT
// ===============================================
export const getFactoriesReportData = asyncHandler(async (req, res) => {
    const factories = await Factory.find({ deleted: { $ne: true } }).sort({ name: 1 }).lean();
    
    // Get stock for each factory from Pallet model
    const stockByFactory = await Pallet.aggregate([
        { $match: { status: 'InFactoryStock' } },
        { $group: {
            _id: '$factory',
            pallets: { $sum: { $cond: [{ $eq: ['$type', 'Pallet'] }, 1, 0] } },
            khatlis: { $sum: { $cond: [{ $eq: ['$type', 'Khatli'] }, 1, 0] } },
            totalBoxes: { $sum: '$boxCount' }
        }}
    ]);

    const stockMap = {};
    stockByFactory.forEach(s => { 
        if (s._id) stockMap[s._id.toString()] = s; 
    });

    const reportData = factories.map((factory, idx) => {
        const stock = stockMap[factory._id?.toString()] || { pallets: 0, khatlis: 0, totalBoxes: 0 };
        return {
            sNo: idx + 1,
            name: factory.name || '-',
            contactPerson: factory.contactPerson || '-',
            address: factory.address || '-',
            pallets: stock.pallets,
            khatlis: stock.khatlis,
            totalBoxes: stock.totalBoxes,
        };
    });

    const summary = {
        totalFactories: factories.length,
        totalPallets: stockByFactory.reduce((sum, s) => sum + (s.pallets || 0), 0),
        totalKhatlis: stockByFactory.reduce((sum, s) => sum + (s.khatlis || 0), 0),
        totalBoxes: stockByFactory.reduce((sum, s) => sum + (s.totalBoxes || 0), 0),
    };

    res.json({ reportData, summary, reportType: 'factories', generatedAt: new Date().toISOString() });
});

// ===============================================
// FACTORY STOCK REPORT (Pallets/Khatlis in stock)
// ===============================================
export const getFactoryStockReportData = asyncHandler(async (req, res) => {
    const { factoryId } = req.query;

    const match = { status: 'InFactoryStock' };
    if (factoryId) match.factory = factoryId;

    const stock = await Pallet.find(match)
        .populate('tile', 'name tileNumber size surface')
        .populate('factory', 'name')
        .sort({ createdAt: -1 })
        .lean();

    const reportData = stock.map((item, idx) => ({
        sNo: idx + 1,
        palletId: item.palletId || '-',
        type: item.type || 'Pallet',
        tileName: item.tile?.name || '-',
        tileNumber: item.tile?.tileNumber || '-',
        size: item.tile?.size || '-',
        surface: item.tile?.surface || '-',
        boxCount: item.boxCount || 0,
        factoryName: item.factory?.name || '-',
        status: item.status || '-',
    }));

    const summary = {
        totalItems: stock.length,
        totalPallets: stock.filter(s => s.type === 'Pallet').length,
        totalKhatlis: stock.filter(s => s.type === 'Khatli').length,
        totalBoxes: stock.reduce((sum, s) => sum + (s.boxCount || 0), 0),
    };

    res.json({ reportData, summary, reportType: 'factoryStock', generatedAt: new Date().toISOString() });
});

// ===============================================
// CONTAINERS REPORT
// ===============================================
export const getContainersReportData = asyncHandler(async (req, res) => {
    const { status, fromDate, toDate } = req.query;

    const match = { deleted: { $ne: true } };
    if (status) match.status = status;
    if (fromDate || toDate) {
        match.createdAt = {};
        if (fromDate) match.createdAt.$gte = new Date(fromDate);
        if (toDate) match.createdAt.$lte = new Date(toDate);
    }

    // Container has both 'pallets' array (ref to Pallet) - need to populate and count
    const containers = await Container.find(match)
        .populate('factory', 'name')
        .populate('loadingPlan', 'loadingPlanId')
        .populate('createdBy', 'username')
        .populate({
            path: 'pallets',
            select: 'type boxCount tile',
            populate: { path: 'tile', select: 'name' }
        })
        .sort({ createdAt: -1 })
        .lean();

    const reportData = containers.map((container, idx) => {
        const allPallets = container.pallets || [];
        const palletCount = allPallets.filter(p => p?.type === 'Pallet').length;
        const khatliCount = allPallets.filter(p => p?.type === 'Khatli').length;
        const totalBoxes = allPallets.reduce((sum, p) => sum + (p?.boxCount || 0), 0);

        return {
            sNo: idx + 1,
            containerId: container.containerId || '-',
            containerNumber: container.containerNumber || '-',
            truckNumber: container.truckNumber || '-',
            factoryName: container.factory?.name || '-',
            loadingPlanId: container.loadingPlan?.loadingPlanId || '-',
            status: container.status || '-',
            palletCount,
            khatliCount,
            totalBoxes,
            createdBy: container.createdBy?.username || '-',
        };
    });

    // Status counts
    const statusCounts = {};
    containers.forEach(c => {
        const st = c.status || 'Unknown';
        statusCounts[st] = (statusCounts[st] || 0) + 1;
    });

    const summary = {
        totalContainers: containers.length,
        ...statusCounts,
        totalPallets: reportData.reduce((sum, r) => sum + r.palletCount, 0),
        totalKhatlis: reportData.reduce((sum, r) => sum + r.khatliCount, 0),
        totalBoxes: reportData.reduce((sum, r) => sum + r.totalBoxes, 0),
    };

    res.json({ reportData, summary, reportType: 'containers', generatedAt: new Date().toISOString() });
});

// ===============================================
// PURCHASE ORDERS REPORT
// ===============================================
export const getPurchaseOrdersReportData = asyncHandler(async (req, res) => {
    const { status, fromDate, toDate, factoryId } = req.query;

    const match = {};
    if (status) match.status = status;
    if (factoryId) match.factory = factoryId;
    if (fromDate || toDate) {
        match.createdAt = {};
        if (fromDate) match.createdAt.$gte = new Date(fromDate);
        if (toDate) match.createdAt.$lte = new Date(toDate);
    }

    const purchaseOrders = await PurchaseOrder.find(match)
        .populate('factory', 'name')
        .populate('sourceRestockRequest', 'requestId')
        .populate('createdBy', 'username')
        .populate('items.tile', 'name tileNumber size')
        .sort({ createdAt: -1 })
        .lean();

    const reportData = purchaseOrders.map((po, idx) => {
        const totalPallets = po.items?.reduce((sum, i) => sum + (i.palletsOrdered || 0), 0) || 0;
        const totalKhatlis = po.items?.reduce((sum, i) => sum + (i.khatlisOrdered || 0), 0) || 0;
        const totalBoxes = po.items?.reduce((sum, i) => sum + (i.totalBoxesOrdered || 0), 0) || 0;
        const totalQCPassed = po.items?.reduce((sum, i) => sum + (i.quantityPassedQC || 0), 0) || 0;

        return {
            sNo: idx + 1,
            poId: po.poId || '-',
            factoryName: po.factory?.name || '-',
            restockRequestId: po.sourceRestockRequest?.requestId || 'Manual',
            status: po.status || '-',
            itemCount: po.items?.length || 0,
            totalPallets,
            totalKhatlis,
            totalBoxes,
            qcProgress: totalBoxes > 0 ? `${((totalQCPassed / totalBoxes) * 100).toFixed(0)}%` : '0%',
            createdBy: po.createdBy?.username || '-',
        };
    });

    // Status counts
    const statusCounts = {};
    purchaseOrders.forEach(po => {
        const st = po.status || 'Unknown';
        statusCounts[st] = (statusCounts[st] || 0) + 1;
    });

    const summary = {
        totalPOs: purchaseOrders.length,
        ...statusCounts,
        totalPallets: reportData.reduce((sum, r) => sum + r.totalPallets, 0),
        totalKhatlis: reportData.reduce((sum, r) => sum + r.totalKhatlis, 0),
        totalBoxes: reportData.reduce((sum, r) => sum + r.totalBoxes, 0),
    };

    res.json({ reportData, summary, reportType: 'purchaseOrders', generatedAt: new Date().toISOString() });
});

// ===============================================
// PURCHASE ORDER DETAIL REPORT
// ===============================================
export const getPurchaseOrderDetailReportData = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const po = await PurchaseOrder.findById(id)
        .populate('factory', 'name address contactPerson')
        .populate('sourceRestockRequest', 'requestId')
        .populate('createdBy', 'username')
        .populate('items.tile', 'name tileNumber size surface')
        .lean();

    if (!po) {
        res.status(404);
        throw new Error('Purchase Order not found');
    }

    const reportData = po.items?.map((item, idx) => ({
        sNo: idx + 1,
        tileName: item.tile?.name || '-',
        tileNumber: item.tile?.tileNumber || '-',
        size: item.tile?.size || '-',
        palletsOrdered: item.palletsOrdered || 0,
        khatlisOrdered: item.khatlisOrdered || 0,
        totalBoxesOrdered: item.totalBoxesOrdered || 0,
        quantityPassedQC: item.quantityPassedQC || 0,
        qcProgress: item.totalBoxesOrdered > 0 
            ? `${((item.quantityPassedQC || 0) / item.totalBoxesOrdered * 100).toFixed(0)}%` 
            : '0%',
    })) || [];

    const summary = {
        poId: po.poId,
        factory: po.factory?.name || '-',
        status: po.status,
        totalItems: reportData.length,
        totalPallets: reportData.reduce((sum, r) => sum + r.palletsOrdered, 0),
        totalKhatlis: reportData.reduce((sum, r) => sum + r.khatlisOrdered, 0),
        totalBoxes: reportData.reduce((sum, r) => sum + r.totalBoxesOrdered, 0),
        totalQCPassed: reportData.reduce((sum, r) => sum + r.quantityPassedQC, 0),
    };

    res.json({ reportData, summary, reportType: 'purchaseOrderDetail', generatedAt: new Date().toISOString() });
});

// ===============================================
// RESTOCK REQUESTS REPORT
// ===============================================
export const getRestockRequestsReportData = asyncHandler(async (req, res) => {
    const { status, fromDate, toDate } = req.query;

    const match = {};
    if (status) match.status = status;
    if (fromDate || toDate) {
        match.createdAt = {};
        if (fromDate) match.createdAt.$gte = new Date(fromDate);
        if (toDate) match.createdAt.$lte = new Date(toDate);
    }

    // Note: Model uses 'requestedBy' not 'createdBy', and 'requestedItems' not 'items'
    const restocks = await RestockRequest.find(match)
        .populate('requestedBy', 'username')
        .populate('requestedItems.tile', 'name tileNumber')
        .sort({ createdAt: -1 })
        .lean();

    const reportData = restocks.map((restock, idx) => ({
        sNo: idx + 1,
        requestId: restock.requestId || '-',
        status: restock.status || '-',
        itemCount: restock.requestedItems?.length || 0,
        totalQuantity: restock.requestedItems?.reduce((sum, i) => sum + (i.quantityRequested || 0), 0) || 0,
        quantityShipped: restock.requestedItems?.reduce((sum, i) => sum + (i.quantityShipped || 0), 0) || 0,
        quantityArrived: restock.requestedItems?.reduce((sum, i) => sum + (i.quantityArrived || 0), 0) || 0,
        notes: restock.notes || '-',
        requestedBy: restock.requestedBy?.username || '-',
    }));

    // Status counts
    const statusCounts = {};
    restocks.forEach(r => {
        const st = r.status || 'Unknown';
        statusCounts[st] = (statusCounts[st] || 0) + 1;
    });

    const summary = {
        totalRequests: restocks.length,
        ...statusCounts,
        totalItems: reportData.reduce((sum, r) => sum + r.itemCount, 0),
        totalQuantity: reportData.reduce((sum, r) => sum + r.totalQuantity, 0),
    };

    res.json({ reportData, summary, reportType: 'restockRequests', generatedAt: new Date().toISOString() });
});

// ===============================================
// LOADING PLANS REPORT
// ===============================================
export const getLoadingPlansReportData = asyncHandler(async (req, res) => {
    const { status, fromDate, toDate, factoryId } = req.query;

    const match = {};
    if (status) match.status = status;
    if (factoryId) match.factory = factoryId;
    if (fromDate || toDate) {
        match.createdAt = {};
        if (fromDate) match.createdAt.$gte = new Date(fromDate);
        if (toDate) match.createdAt.$lte = new Date(toDate);
    }

    const plans = await LoadingPlan.find(match)
        .populate('factory', 'name')
        .populate('createdBy', 'username')
        .populate('containers')
        .sort({ createdAt: -1 })
        .lean();

    const reportData = plans.map((plan, idx) => ({
        sNo: idx + 1,
        planId: plan.loadingPlanId || '-',  // This is the correct field name
        factoryName: plan.factory?.name || '-',
        loadingDate: plan.loadingDate ? new Date(plan.loadingDate).toLocaleDateString('en-IN') : '-',
        status: plan.status || '-',
        containerCount: plan.containers?.length || 0,
        createdBy: plan.createdBy?.username || '-',
    }));

    // Status counts
    const statusCounts = {};
    plans.forEach(p => {
        const st = p.status || 'Unknown';
        statusCounts[st] = (statusCounts[st] || 0) + 1;
    });

    const summary = {
        totalPlans: plans.length,
        ...statusCounts,
        totalContainers: reportData.reduce((sum, r) => sum + r.containerCount, 0),
    };

    res.json({ reportData, summary, reportType: 'loadingPlans', generatedAt: new Date().toISOString() });
});

// ===============================================
// DISPATCHES REPORT
// ===============================================
export const getDispatchesReportData = asyncHandler(async (req, res) => {
    const { status, fromDate, toDate, destination } = req.query;

    const match = { deleted: { $ne: true } };
    if (status) match.status = status;
    if (destination) match.destination = { $regex: destination, $options: 'i' };
    if (fromDate || toDate) {
        match.createdAt = {};
        if (fromDate) match.createdAt.$gte = new Date(fromDate);
        if (toDate) match.createdAt.$lte = new Date(toDate);
    }

    const dispatches = await DispatchOrder.find(match)
        .populate('createdBy', 'username')
        .sort({ createdAt: -1 })
        .lean();

    // In DispatchOrder model, containers is an embedded array with items inside
    const reportData = dispatches.map((dispatch, idx) => {
        // Calculate from embedded containers array
        const containerCount = dispatch.containers?.length || 0;
        
        // Use stockSummary if available, otherwise calculate from containers
        let totalPallets = dispatch.stockSummary?.totalPallets || 0;
        let totalKhatlis = dispatch.stockSummary?.totalKhatlis || 0;
        let totalBoxes = dispatch.stockSummary?.totalBoxes || 0;

        // If stockSummary is 0, try to calculate from containers.items
        if (totalPallets === 0 && totalKhatlis === 0 && dispatch.containers) {
            dispatch.containers.forEach(container => {
                if (container.items) {
                    container.items.forEach(item => {
                        if (item.itemType === 'Pallet') {
                            totalPallets += item.quantity || 1;
                        } else if (item.itemType === 'Khatli') {
                            totalKhatlis += item.quantity || 1;
                        }
                        totalBoxes += (item.boxCount || 0) * (item.quantity || 1);
                    });
                }
            });
        }

        return {
            sNo: idx + 1,
            dispatchNumber: dispatch.dispatchNumber || '-',
            destination: dispatch.destination || '-',
            status: dispatch.status || '-',
            dispatchDate: dispatch.dispatchDate ? new Date(dispatch.dispatchDate).toLocaleDateString('en-IN') : '-',
            containerCount,
            palletCount: totalPallets,
            khatliCount: totalKhatlis,
            totalBoxes,
            vehicleNumber: dispatch.vehicleNumber || '-',
            createdBy: dispatch.createdBy?.username || '-',
        };
    });

    // Status counts
    const statusCounts = {};
    dispatches.forEach(d => {
        const st = d.status || 'Unknown';
        statusCounts[st] = (statusCounts[st] || 0) + 1;
    });

    const summary = {
        totalDispatches: dispatches.length,
        ...statusCounts,
        totalContainers: reportData.reduce((sum, r) => sum + r.containerCount, 0),
        totalPallets: reportData.reduce((sum, r) => sum + r.palletCount, 0),
        totalKhatlis: reportData.reduce((sum, r) => sum + r.khatliCount, 0),
        totalBoxes: reportData.reduce((sum, r) => sum + r.totalBoxes, 0),
    };

    res.json({ reportData, summary, reportType: 'dispatches', generatedAt: new Date().toISOString() });
});

// ===============================================
// DISPATCH DETAIL REPORT
// ===============================================
export const getDispatchDetailReportData = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const dispatch = await DispatchOrder.findById(id)
        .populate('createdBy', 'username')
        .lean();

    if (!dispatch) {
        res.status(404);
        throw new Error('Dispatch not found');
    }

    // Flatten items from all containers for the table
    const reportData = [];
    dispatch.containers?.forEach((container, cIdx) => {
        container.items?.forEach((item, iIdx) => {
            reportData.push({
                sNo: reportData.length + 1,
                containerNumber: container.containerNumber || `Container ${cIdx + 1}`,
                truckNumber: container.truckNumber || '-',
                tileName: item.tileName || '-',
                itemType: item.itemType || '-',
                boxCount: item.boxCount || 0,
                quantity: item.quantity || 1,
                totalBoxes: (item.boxCount || 0) * (item.quantity || 1),
            });
        });
    });

    const summary = {
        dispatchNumber: dispatch.dispatchNumber,
        destination: dispatch.destination || '-',
        status: dispatch.status,
        totalContainers: dispatch.containers?.length || 0,
        totalPallets: dispatch.stockSummary?.totalPallets || 0,
        totalKhatlis: dispatch.stockSummary?.totalKhatlis || 0,
        totalBoxes: dispatch.stockSummary?.totalBoxes || 0,
    };

    res.json({ reportData, summary, reportType: 'dispatchDetail', generatedAt: new Date().toISOString() });
});

// ===============================================
// COMPREHENSIVE INVENTORY REPORT
// ===============================================
export const getInventoryReportData = asyncHandler(async (req, res) => {
    // Get all pallets in factory stock grouped by tile and factory
    const inventory = await Pallet.aggregate([
        { $match: { status: 'InFactoryStock' } },
        { $group: {
            _id: { tile: '$tile', factory: '$factory', type: '$type' },
            count: { $sum: 1 },
            totalBoxes: { $sum: '$boxCount' }
        }},
        { $lookup: { from: 'tiles', localField: '_id.tile', foreignField: '_id', as: 'tileInfo' }},
        { $lookup: { from: 'factories', localField: '_id.factory', foreignField: '_id', as: 'factoryInfo' }},
        { $unwind: { path: '$tileInfo', preserveNullAndEmptyArrays: true } },
        { $unwind: { path: '$factoryInfo', preserveNullAndEmptyArrays: true } },
        { $project: {
            _id: 0,
            tileName: { $ifNull: ['$tileInfo.name', 'Unknown'] },
            tileNumber: { $ifNull: ['$tileInfo.tileNumber', '-'] },
            size: { $ifNull: ['$tileInfo.size', '-'] },
            surface: { $ifNull: ['$tileInfo.surface', '-'] },
            factoryName: { $ifNull: ['$factoryInfo.name', 'Unknown'] },
            type: '$_id.type',
            count: 1,
            totalBoxes: 1
        }},
        { $sort: { tileName: 1, factoryName: 1, type: 1 } }
    ]);

    const reportData = inventory.map((item, idx) => ({
        sNo: idx + 1,
        ...item
    }));

    const summary = {
        totalRecords: inventory.length,
        totalPallets: inventory.filter(i => i.type === 'Pallet').reduce((sum, i) => sum + i.count, 0),
        totalKhatlis: inventory.filter(i => i.type === 'Khatli').reduce((sum, i) => sum + i.count, 0),
        totalBoxes: inventory.reduce((sum, i) => sum + i.totalBoxes, 0),
        uniqueTiles: new Set(inventory.map(i => i.tileName)).size,
        uniqueFactories: new Set(inventory.map(i => i.factoryName)).size,
    };

    res.json({ reportData, summary, reportType: 'inventory', generatedAt: new Date().toISOString() });
});

export default {
    getTilesReportData,
    getFactoriesReportData,
    getFactoryStockReportData,
    getContainersReportData,
    getPurchaseOrdersReportData,
    getPurchaseOrderDetailReportData,
    getRestockRequestsReportData,
    getLoadingPlansReportData,
    getDispatchesReportData,
    getDispatchDetailReportData,
    getInventoryReportData,
};