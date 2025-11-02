import asyncHandler from '../utils/asyncHandler.js';
import Tile from '../models/tileModel.js';
import Booking from '../models/bookingModel.js';
import RestockRequest from '../models/restockRequestModel.js';
import DispatchOrder from '../models/dispatchOrderModel.js';
import mongoose from 'mongoose';

// @desc    Get dashboard statistics based on user role
// @route   GET /api/dashboard
// @access  Private
export const getDashboardData = asyncHandler(async (req, res) => {
    const { role } = req.user;
    let data = {};

    // --- Admin & Dubai Staff Dashboard Data ---
    if (role === 'admin' || role === 'dubai-staff') {
        // --- THIS IS THE CORRECTED LOGIC FOR PENDING INVOICES ---
        // It now counts dispatch orders where the invoiceNumber is null, undefined, or an empty string.
        const pendingInvoices = await DispatchOrder.countDocuments({ 
            invoiceNumber: { $in: [null, ''] } 
        });
        // --- END OF CORRECTION ---

        const pendingBookings = await Booking.countDocuments({ status: 'Pending' });

        const [kpiData, stockAlerts, bookingActivity, topSalesmen, topTiles] = await Promise.all([
            Booking.aggregate([ { $facet: { "activeBookings": [ { $match: { status: { $in: ['Confirmed', 'Partially Dispatched'] } } }, { $count: "count" } ] } }, { $project: { activeBookactions: { $ifNull: [{ $arrayElemAt: ["$activeBookings.count", 0] }, 0] } } } ]),
            Tile.find({ $or: [ { $expr: { $gt: ['$stockDetails.bookedStock', '$stockDetails.availableStock'] } }, { $expr: { $lte: ['$stockDetails.availableStock', '$restockThreshold'] } } ] }).limit(10).select('name stockDetails restockThreshold'),
            Booking.aggregate([ { $match: { createdAt: { $gte: new Date(new Date().setDate(new Date().getDate() - 30)) } } }, { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } } ]),
            Booking.aggregate([ { $match: { status: { $ne: 'Cancelled' } } }, { $group: { _id: "$salesman", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 5 }, { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'salesmanInfo' } }, { $unwind: '$salesmanInfo' }, { $project: { name: '$salesmanInfo.username', count: 1 } } ]),
            Booking.aggregate([ { $match: { status: { $ne: 'Cancelled' } } }, { $unwind: '$tilesList' }, { $group: { _id: '$tilesList.tile', totalBooked: { $sum: '$tilesList.quantity' } } }, { $sort: { totalBooked: -1 } }, { $limit: 5 }, { $lookup: { from: 'tiles', localField: '_id', foreignField: '_id', as: 'tileInfo' } }, { $unwind: '$tileInfo' }, { $project: { name: '$tileInfo.name', count: '$totalBooked' } } ])
        ]);

        const totalTiles = await Tile.countDocuments();
        const pendingRestocks = await RestockRequest.countDocuments({ status: { $in: ['Pending', 'Processing'] } });

        data = {
            totalTiles,
            pendingRestocks,
            activeBookings: kpiData[0]?.activeBookings || 0,
            pendingInvoices, // This now holds the correct count
            pendingBookings,
            stockAlerts,
            bookingActivity,
            topSalesmen,
            topTiles
        };
    }
    
    // --- Labor Dashboard Data ---
    else if (role === 'labor') {
        const upcomingDispatches = await DispatchOrder.find({ status: { $in: ['Pending', 'In Transit'] } })
            .sort({ dispatchDate: 1 })
            .limit(15)
            .populate({ 
                path: 'booking', 
                select: 'bookingId party', 
                populate: { path: 'party', select: 'name shippingAddress' } 
            })
            .populate('deliveredItems.tile', 'name');

        data = { upcomingDispatches };
    }
    
    // Add other roles like 'salesman' here in the future
    // else if (role === 'salesman') { ... }

    res.status(200).json(data);
});
