// FILE: backend/src/scripts/recalculateStock.js
// Run this script to recalculate all tile stock from actual pallet data
// Usage: node src/scripts/recalculateStock.js

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Import models
import Tile from '../src/models/tileModel.js';
import Pallet from '../src/models/palletModel.js';
import DispatchOrder from '../src/models/dispatchOrderModel.js';
import Booking from '../src/models/bookingModel.js';
import RestockRequest from '../src/models/restockRequestModel.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/meganea';

async function recalculateAllTileStock() {
    console.log('🔄 Starting stock recalculation...\n');

    try {
        // Connect to MongoDB
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Get all active tiles
        const tiles = await Tile.find({ deleted: { $ne: true } });
        console.log(`📦 Found ${tiles.length} active tiles to process\n`);

        let updatedCount = 0;
        let errorCount = 0;

        for (const tile of tiles) {
            try {
                // ============ CALCULATE IN FACTORY STOCK ============
                // Count boxes from pallets with status 'InFactoryStock'
                const factoryStockAgg = await Pallet.aggregate([
                    {
                        $match: {
                            tile: tile._id,
                            status: 'InFactoryStock'
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            totalBoxes: { $sum: '$boxCount' },
                            palletCount: { $sum: { $cond: [{ $eq: ['$type', 'Pallet'] }, 1, 0] } },
                            khatliCount: { $sum: { $cond: [{ $eq: ['$type', 'Khatli'] }, 1, 0] } }
                        }
                    }
                ]);

                const inFactoryStock = factoryStockAgg[0]?.totalBoxes || 0;

                // ============ CALCULATE BOOKED STOCK ============
                // Sum up quantities from active bookings for this tile
                const bookedStockAgg = await Booking.aggregate([
                    {
                        $match: {
                            status: { $in: ['Pending', 'Confirmed', 'Processing', 'Partially Dispatched'] },
                            deleted: { $ne: true }
                        }
                    },
                    { $unwind: '$items' },
                    {
                        $match: {
                            'items.tile': tile._id
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            totalBooked: { $sum: '$items.quantity' }
                        }
                    }
                ]);

                const bookedStock = bookedStockAgg[0]?.totalBooked || 0;

                // ============ CALCULATE RESTOCKING STOCK ============
                // Sum up quantities from active restock requests for this tile
                const restockingStockAgg = await RestockRequest.aggregate([
                    {
                        $match: {
                            tile: tile._id,
                            status: { $in: ['Pending', 'Approved', 'Processing'] },
                            deleted: { $ne: true }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            totalRestocking: { $sum: '$quantity' }
                        }
                    }
                ]);

                const restockingStock = restockingStockAgg[0]?.totalRestocking || 0;

                // ============ CALCULATE AVAILABLE STOCK ============
                // Available = InFactory - Booked (or manual value if set)
                // For now, we'll set available to inFactoryStock - bookedStock
                // But if there's existing available stock, we'll keep it as reference
                const currentAvailable = tile.stockDetails?.availableStock || 0;
                
                // Logic: Available stock should be independent of factory stock
                // It represents stock that's ready to sell (Dubai warehouse)
                // For now, keep the existing available stock value
                const availableStock = currentAvailable;

                // ============ UPDATE TILE ============
                const updateData = {
                    'stockDetails.inFactoryStock': inFactoryStock,
                    'stockDetails.bookedStock': bookedStock,
                    'stockDetails.restockingStock': restockingStock,
                    // Don't update availableStock - that's managed separately (Dubai warehouse)
                    // Don't update inTransitStock - that's calculated dynamically from dispatches
                };

                await Tile.updateOne(
                    { _id: tile._id },
                    { $set: updateData }
                );

                console.log(`✅ ${tile.name}:`);
                console.log(`   Available: ${availableStock} (unchanged)`);
                console.log(`   Booked: ${bookedStock}`);
                console.log(`   Restocking: ${restockingStock}`);
                console.log(`   In Factory: ${inFactoryStock}`);
                console.log('');

                updatedCount++;
            } catch (err) {
                console.error(`❌ Error updating ${tile.name}: ${err.message}`);
                errorCount++;
            }
        }

        // ============ RECALCULATE MASTER STATS ============
        console.log('\n📊 Calculating master stats...\n');

        const masterStats = await Tile.aggregate([
            { $match: { deleted: { $ne: true } } },
            {
                $group: {
                    _id: null,
                    totalTiles: { $sum: 1 },
                    totalAvailableStock: { $sum: '$stockDetails.availableStock' },
                    totalBookedStock: { $sum: '$stockDetails.bookedStock' },
                    totalRestockingStock: { $sum: '$stockDetails.restockingStock' },
                    totalInFactoryStock: { $sum: '$stockDetails.inFactoryStock' }
                }
            }
        ]);

        // Calculate transit from In Transit dispatches
        const transitAgg = await DispatchOrder.aggregate([
            {
                $match: {
                    status: 'In Transit',
                    deleted: { $ne: true }
                }
            },
            {
                $group: {
                    _id: null,
                    totalTransitBoxes: { $sum: '$stockSummary.totalBoxes' }
                }
            }
        ]);

        const totalTransit = transitAgg[0]?.totalTransitBoxes || 0;
        const stats = masterStats[0] || {};

        console.log('=== MASTER STATS ===');
        console.log(`Total Tiles: ${stats.totalTiles || 0}`);
        console.log(`Total Available: ${stats.totalAvailableStock || 0}`);
        console.log(`Total Booked: ${stats.totalBookedStock || 0}`);
        console.log(`Total Restocking: ${stats.totalRestockingStock || 0}`);
        console.log(`Total In Factory: ${stats.totalInFactoryStock || 0}`);
        console.log(`Total In Transit: ${totalTransit}`);
        console.log('');

        console.log('===========================================');
        console.log(`✅ Successfully updated: ${updatedCount} tiles`);
        console.log(`❌ Errors: ${errorCount} tiles`);
        console.log('===========================================');

    } catch (error) {
        console.error('❌ Fatal error:', error.message);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
    }
}

// Run the script
recalculateAllTileStock();