// FILE: backend/scripts/reconcileStock.js
// Run this script to reconcile all tile and factory stock from actual pallet and dispatch data
// Usage: node scripts/reconcileStock.js

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

import Tile from '../src/models/tileModel.js';
import Pallet from '../src/models/palletModel.js';
import DispatchOrder from '../src/models/dispatchOrderModel.js';
import Booking from '../src/models/bookingModel.js';
import RestockRequest from '../src/models/restockRequestModel.js';
import Factory from '../src/models/factoryModel.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/meganea';

async function reconcileStock() {
    console.log('🔄 Starting full database stock reconciliation...\n');

    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // 1. RECONCILE TILE STOCK
        const tiles = await Tile.find({ deleted: { $ne: true } });
        console.log(`📦 Processing ${tiles.length} active tiles...\n`);

        for (const tile of tiles) {
            // Recalculate factory and transit stock from pallets
            const stockAgg = await Pallet.aggregate([
                {
                    $match: {
                        tile: tile._id,
                        deleted: { $ne: true }
                    }
                },
                // Lookup Container to get containerInfo
                {
                    $lookup: {
                        from: 'containers',
                        localField: 'container',
                        foreignField: '_id',
                        as: 'containerInfo'
                    }
                },
                {
                    $unwind: {
                        path: '$containerInfo',
                        preserveNullAndEmptyArrays: true
                    }
                },
                // Lookup DispatchOrder using containerInfo.dispatchOrder
                {
                    $lookup: {
                        from: 'dispatchorders',
                        localField: 'containerInfo.dispatchOrder',
                        foreignField: '_id',
                        as: 'dispatchInfo'
                    }
                },
                {
                    $unwind: {
                        path: '$dispatchInfo',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $group: {
                        _id: null,
                        inFactoryStock: {
                            $sum: {
                                $cond: [
                                    {
                                        $or: [
                                            { $in: ['$status', ['InFactoryStock', 'LoadedInContainer']] },
                                            {
                                                $and: [
                                                    { $eq: ['$status', 'Dispatched'] },
                                                    { $in: ['$dispatchInfo.status', ['Pending', 'Ready', 'Cancelled']] },
                                                    { $ne: ['$dispatchInfo.deleted', true] }
                                                ]
                                            }
                                        ]
                                    },
                                    '$boxCount',
                                    0
                                ]
                            }
                        },
                        inTransitStock: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: ['$status', 'Dispatched'] },
                                            { $eq: ['$dispatchInfo.status', 'In Transit'] },
                                            { $ne: ['$dispatchInfo.deleted', true] }
                                        ]
                                    },
                                    '$boxCount',
                                    0
                                ]
                            }
                        }
                    }
                }
            ]);

            const rawInFactory = stockAgg[0]?.inFactoryStock || 0;
            const rawInTransit = stockAgg[0]?.inTransitStock || 0;

            const inFactoryStock = Math.max(0, rawInFactory);
            const inTransitStock = Math.max(0, rawInTransit);

            // Calculate Booked Stock
            const bookedStockAgg = await Booking.aggregate([
                {
                    $match: {
                        status: { $in: ['Pending', 'Confirmed', 'Processing', 'Partially Dispatched'] },
                        deleted: { $ne: true }
                    }
                },
                { $unwind: '$items' },
                { $match: { 'items.tile': tile._id } },
                { $group: { _id: null, totalBooked: { $sum: '$items.quantity' } } }
            ]);
            const bookedStock = Math.max(0, bookedStockAgg[0]?.totalBooked || 0);

            // Calculate Restocking Stock
            const restockingStockAgg = await RestockRequest.aggregate([
                {
                    $match: {
                        tile: tile._id,
                        status: { $in: ['Pending', 'Approved', 'Processing'] },
                        deleted: { $ne: true }
                    }
                },
                { $group: { _id: null, totalRestocking: { $sum: '$quantity' } } }
            ]);
            const restockingStock = Math.max(0, restockingStockAgg[0]?.totalRestocking || 0);

            // Update Tile stock details in the database
            await Tile.updateOne(
                { _id: tile._id },
                {
                    $set: {
                        'stockDetails.inFactoryStock': inFactoryStock,
                        'stockDetails.inTransitStock': inTransitStock,
                        'stockDetails.bookedStock': bookedStock,
                        'stockDetails.restockingStock': restockingStock
                    }
                }
            );

            console.log(`  Tile "${tile.name}":`);
            console.log(`    Available: ${tile.stockDetails?.availableStock || 0} (unchanged)`);
            console.log(`    Booked: ${bookedStock}`);
            console.log(`    Restocking: ${restockingStock}`);
            console.log(`    In Factory: ${inFactoryStock} (was ${tile.stockDetails?.inFactoryStock})`);
            console.log(`    In Transit: ${inTransitStock} (was ${tile.stockDetails?.inTransitStock})`);
        }

        // 2. RECONCILE FACTORY STOCK
        const factories = await Factory.find({});
        console.log(`\n🏭 Reconciling ${factories.length} factories...\n`);

        for (const factory of factories) {
            const factoryStockAgg = await Pallet.aggregate([
                {
                    $match: {
                        factory: factory._id,
                        deleted: { $ne: true }
                    }
                },
                // Lookup Container to get containerInfo
                {
                    $lookup: {
                        from: 'containers',
                        localField: 'container',
                        foreignField: '_id',
                        as: 'containerInfo'
                    }
                },
                {
                    $unwind: {
                        path: '$containerInfo',
                        preserveNullAndEmptyArrays: true
                    }
                },
                // Lookup DispatchOrder using containerInfo.dispatchOrder
                {
                    $lookup: {
                        from: 'dispatchorders',
                        localField: 'containerInfo.dispatchOrder',
                        foreignField: '_id',
                        as: 'dispatchInfo'
                    }
                },
                {
                    $unwind: {
                        path: '$dispatchInfo',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $group: {
                        _id: null,
                        inFactoryPallets: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $in: ['$status', ['InFactoryStock', 'LoadedInContainer']] },
                                            { $eq: ['$type', 'Pallet'] }
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        },
                        inFactoryKhatlis: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $in: ['$status', ['InFactoryStock', 'LoadedInContainer']] },
                                            { $eq: ['$type', 'Khatli'] }
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        },
                        inFactoryBoxes: {
                            $sum: {
                                $cond: [
                                    { $in: ['$status', ['InFactoryStock', 'LoadedInContainer']] },
                                    '$boxCount',
                                    0
                                ]
                            }
                        },
                        dispatchedPallets: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: ['$status', 'Dispatched'] },
                                            { $in: ['$dispatchInfo.status', ['Pending', 'Ready', 'Cancelled']] },
                                            { $ne: ['$dispatchInfo.deleted', true] },
                                            { $eq: ['$type', 'Pallet'] }
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        },
                        dispatchedKhatlis: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: ['$status', 'Dispatched'] },
                                            { $in: ['$dispatchInfo.status', ['Pending', 'Ready', 'Cancelled']] },
                                            { $ne: ['$dispatchInfo.deleted', true] },
                                            { $eq: ['$type', 'Khatli'] }
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        },
                        dispatchedBoxes: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: ['$status', 'Dispatched'] },
                                            { $in: ['$dispatchInfo.status', ['Pending', 'Ready', 'Cancelled']] },
                                            { $ne: ['$dispatchInfo.deleted', true] }
                                        ]
                                    },
                                    '$boxCount',
                                    0
                                ]
                            }
                        },
                        transitPallets: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: ['$status', 'Dispatched'] },
                                            { $eq: ['$dispatchInfo.status', 'In Transit'] },
                                            { $ne: ['$dispatchInfo.deleted', true] },
                                            { $eq: ['$type', 'Pallet'] }
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        },
                        transitKhatlis: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: ['$status', 'Dispatched'] },
                                            { $eq: ['$dispatchInfo.status', 'In Transit'] },
                                            { $ne: ['$dispatchInfo.deleted', true] },
                                            { $eq: ['$type', 'Khatli'] }
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        },
                        transitBoxes: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: ['$status', 'Dispatched'] },
                                            { $eq: ['$dispatchInfo.status', 'In Transit'] },
                                            { $ne: ['$dispatchInfo.deleted', true] }
                                        ]
                                    },
                                    '$boxCount',
                                    0
                                ]
                            }
                        },
                        deliveredPallets: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: ['$status', 'Dispatched'] },
                                            { $in: ['$dispatchInfo.status', ['Delivered', 'Completed']] },
                                            { $ne: ['$dispatchInfo.deleted', true] },
                                            { $eq: ['$type', 'Pallet'] }
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        },
                        deliveredKhatlis: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: ['$status', 'Dispatched'] },
                                            { $in: ['$dispatchInfo.status', ['Delivered', 'Completed']] },
                                            { $ne: ['$dispatchInfo.deleted', true] },
                                            { $eq: ['$type', 'Khatli'] }
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        },
                        deliveredBoxes: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $eq: ['$status', 'Dispatched'] },
                                            { $in: ['$dispatchInfo.status', ['Delivered', 'Completed']] },
                                            { $ne: ['$dispatchInfo.deleted', true] }
                                        ]
                                    },
                                    '$boxCount',
                                    0
                                ]
                            }
                        }
                    }
                }
            ]);

            const stats = factoryStockAgg[0] || {};
            await Factory.updateOne(
                { _id: factory._id },
                {
                    $set: {
                        'stock.inFactoryStock': {
                            pallets: Math.max(0, stats.inFactoryPallets || 0),
                            khatlis: Math.max(0, stats.inFactoryKhatlis || 0),
                            totalBoxes: Math.max(0, stats.inFactoryBoxes || 0)
                        },
                        'stock.dispatchedStock': {
                            pallets: Math.max(0, stats.dispatchedPallets || 0),
                            khatlis: Math.max(0, stats.dispatchedKhatlis || 0),
                            totalBoxes: Math.max(0, stats.dispatchedBoxes || 0)
                        },
                        'stock.inTransitStock': {
                            pallets: Math.max(0, stats.transitPallets || 0),
                            khatlis: Math.max(0, stats.transitKhatlis || 0),
                            totalBoxes: Math.max(0, stats.transitBoxes || 0)
                        },
                        'stock.deliveredStock': {
                            pallets: Math.max(0, stats.deliveredPallets || 0),
                            khatlis: Math.max(0, stats.deliveredKhatlis || 0),
                            totalBoxes: Math.max(0, stats.deliveredBoxes || 0)
                        }
                    }
                }
            );

            console.log(`  Factory "${factory.name}":`);
            console.log(`    In Factory: Pallets=${stats.inFactoryPallets || 0}, Khatlis=${stats.inFactoryKhatlis || 0}, Boxes=${stats.inFactoryBoxes || 0}`);
            console.log(`    Dispatched: Pallets=${stats.dispatchedPallets || 0}, Khatlis=${stats.dispatchedKhatlis || 0}, Boxes=${stats.dispatchedBoxes || 0}`);
            console.log(`    In Transit: Pallets=${stats.transitPallets || 0}, Khatlis=${stats.transitKhatlis || 0}, Boxes=${stats.transitBoxes || 0}`);
            console.log(`    Delivered: Pallets=${stats.deliveredPallets || 0}, Khatlis=${stats.deliveredKhatlis || 0}, Boxes=${stats.deliveredBoxes || 0}\n`);
        }

        console.log('🎉 Database stock reconciliation completed successfully!');

    } catch (err) {
        console.error('❌ Reconciliation Error:', err.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

reconcileStock();
