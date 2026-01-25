// backend/src/controllers/reconciliationController.js
// ENHANCED VERSION - Fixes negative stock issues

import asyncHandler from '../utils/asyncHandler.js';
import Tile from '../models/tileModel.js';
import Pallet from '../models/palletModel.js';
import Booking from '../models/bookingModel.js';
import mongoose from 'mongoose';

/**
 * @desc    Recalculate ALL stock fields for all tiles based on actual data
 * @route   POST /api/reconciliation/tile-stock
 * @access  Private (Admin only)
 * 
 * This function fixes ALL stock issues:
 * - inFactoryStock (from actual pallets)
 * - bookedStock (from active bookings)
 * - Handles negative stock values
 */
export const reconcileTileStock = asyncHandler(async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        console.log('🔄 Starting comprehensive stock reconciliation...');
        
        // Get all tiles
        const tiles = await Tile.find({}).session(session);
        const results = [];
        
        for (const tile of tiles) {
            console.log(`\n📦 Processing: ${tile.name}...`);
            
            // 1. Calculate ACTUAL inFactoryStock from pallets
            const pallets = await Pallet.find({
                tile: tile._id,
                status: 'InFactoryStock'
            }).session(session);
            
            const actualInFactoryStock = pallets.reduce((sum, p) => sum + p.boxCount, 0);
            
            // 2. Calculate ACTUAL bookedStock from active bookings
            const bookings = await Booking.find({
                status: { $in: ['Booked', 'PartiallyDispatched'] }
            }).session(session);
            
            let actualBookedStock = 0;
            for (const booking of bookings) {
                const tileItem = booking.tilesList.find(
                    item => item.tile.toString() === tile._id.toString()
                );
                if (tileItem) {
                    actualBookedStock += tileItem.quantity;
                }
            }
            
            // 3. Get current recorded values
            const recordedInFactory = tile.stockDetails.inFactoryStock || 0;
            const recordedBooked = tile.stockDetails.bookedStock || 0;
            const recordedAvailable = tile.stockDetails.availableStock || 0;
            const recordedRestocking = tile.stockDetails.restockingStock || 0;
            
            // 4. Calculate what availableStock SHOULD be
            // availableStock = inFactoryStock - bookedStock
            const correctAvailableStock = Math.max(0, actualInFactoryStock - actualBookedStock);
            
            // 5. Check if any corrections are needed
            const needsCorrection = 
                recordedInFactory !== actualInFactoryStock ||
                recordedBooked !== actualBookedStock ||
                recordedAvailable !== correctAvailableStock ||
                recordedInFactory < 0 ||
                recordedBooked < 0 ||
                recordedAvailable < 0;
            
            if (needsCorrection) {
                // Update using findByIdAndUpdate to bypass validation
                await Tile.findByIdAndUpdate(
                    tile._id,
                    { 
                        'stockDetails.inFactoryStock': actualInFactoryStock,
                        'stockDetails.bookedStock': actualBookedStock,
                        'stockDetails.availableStock': correctAvailableStock,
                        // Keep restockingStock as-is (it's correct from PO creation)
                    },
                    { 
                        session,
                        runValidators: false // Skip validation to allow fixing negative stocks
                    }
                );
                
                const issueTypes = [];
                if (recordedInFactory < 0) issueTypes.push('NEGATIVE_FACTORY_STOCK');
                if (recordedBooked < 0) issueTypes.push('NEGATIVE_BOOKED_STOCK');
                if (recordedAvailable < 0) issueTypes.push('NEGATIVE_AVAILABLE_STOCK');
                if (recordedInFactory !== actualInFactoryStock) issueTypes.push('FACTORY_MISMATCH');
                if (recordedBooked !== actualBookedStock) issueTypes.push('BOOKED_MISMATCH');
                
                results.push({
                    tileName: tile.name,
                    tileNumber: tile.number,
                    before: {
                        inFactoryStock: recordedInFactory,
                        bookedStock: recordedBooked,
                        availableStock: recordedAvailable,
                        restockingStock: recordedRestocking
                    },
                    after: {
                        inFactoryStock: actualInFactoryStock,
                        bookedStock: actualBookedStock,
                        availableStock: correctAvailableStock,
                        restockingStock: recordedRestocking // unchanged
                    },
                    corrections: {
                        inFactory: actualInFactoryStock - recordedInFactory,
                        booked: actualBookedStock - recordedBooked,
                        available: correctAvailableStock - recordedAvailable
                    },
                    palletCount: pallets.length,
                    activeBookings: bookings.filter(b => 
                        b.tilesList.some(item => item.tile.toString() === tile._id.toString())
                    ).length,
                    issueTypes: issueTypes
                });
                
                console.log(`✅ Fixed ${tile.name}:`);
                console.log(`   InFactory: ${recordedInFactory} → ${actualInFactoryStock}`);
                console.log(`   Booked: ${recordedBooked} → ${actualBookedStock}`);
                console.log(`   Available: ${recordedAvailable} → ${correctAvailableStock}`);
                console.log(`   Issues: ${issueTypes.join(', ')}`);
            } else {
                console.log(`✓ ${tile.name}: All stock correct`);
            }
        }
        
        await session.commitTransaction();
        
        console.log('\n✅ Stock reconciliation complete!');
        console.log(`📊 Tiles checked: ${tiles.length}`);
        console.log(`🔧 Tiles fixed: ${results.length}`);
        
        // Categorize issues
        const negativeStockIssues = results.filter(r => 
            r.issueTypes.some(t => t.includes('NEGATIVE'))
        );
        const mismatchIssues = results.filter(r => 
            r.issueTypes.some(t => t.includes('MISMATCH'))
        );
        
        res.status(200).json({
            success: true,
            message: 'Stock reconciliation completed successfully',
            summary: {
                tilesChecked: tiles.length,
                tilesFixed: results.length,
                negativeStockIssues: negativeStockIssues.length,
                mismatchIssues: mismatchIssues.length
            },
            details: results
        });
        
    } catch (error) {
        await session.abortTransaction();
        console.error('❌ Reconciliation failed:', error);
        res.status(400);
        throw new Error(error.message || 'Stock reconciliation failed');
    } finally {
        session.endSession();
    }
});

/**
 * @desc    Check for stock issues WITHOUT fixing them
 * @route   GET /api/reconciliation/check-tile-stock
 * @access  Private (Admin only)
 */
export const checkTileStock = asyncHandler(async (req, res) => {
    try {
        console.log('🔍 Checking for stock issues...');
        
        const tiles = await Tile.find({});
        const issues = [];
        
        for (const tile of tiles) {
            // Count actual pallets
            const pallets = await Pallet.find({
                tile: tile._id,
                status: 'InFactoryStock'
            });
            const actualInFactoryStock = pallets.reduce((sum, p) => sum + p.boxCount, 0);
            
            // Count actual bookings
            const bookings = await Booking.find({
                status: { $in: ['Booked', 'PartiallyDispatched'] }
            });
            
            let actualBookedStock = 0;
            for (const booking of bookings) {
                const tileItem = booking.tilesList.find(
                    item => item.tile.toString() === tile._id.toString()
                );
                if (tileItem) {
                    actualBookedStock += tileItem.quantity;
                }
            }
            
            const recordedInFactory = tile.stockDetails.inFactoryStock || 0;
            const recordedBooked = tile.stockDetails.bookedStock || 0;
            const recordedAvailable = tile.stockDetails.availableStock || 0;
            
            const correctAvailableStock = Math.max(0, actualInFactoryStock - actualBookedStock);
            
            // Detect issues
            const tileIssues = [];
            
            if (recordedInFactory < 0) {
                tileIssues.push({
                    type: 'NEGATIVE_FACTORY_STOCK',
                    severity: 'CRITICAL',
                    message: `InFactoryStock is negative: ${recordedInFactory}`
                });
            }
            
            if (recordedBooked < 0) {
                tileIssues.push({
                    type: 'NEGATIVE_BOOKED_STOCK',
                    severity: 'CRITICAL',
                    message: `BookedStock is negative: ${recordedBooked}`
                });
            }
            
            if (recordedAvailable < 0) {
                tileIssues.push({
                    type: 'NEGATIVE_AVAILABLE_STOCK',
                    severity: 'CRITICAL',
                    message: `AvailableStock is negative: ${recordedAvailable}`
                });
            }
            
            if (recordedInFactory !== actualInFactoryStock) {
                tileIssues.push({
                    type: 'FACTORY_MISMATCH',
                    severity: 'HIGH',
                    message: `InFactoryStock mismatch: Recorded=${recordedInFactory}, Actual=${actualInFactoryStock}, Diff=${actualInFactoryStock - recordedInFactory}`
                });
            }
            
            if (recordedBooked !== actualBookedStock) {
                tileIssues.push({
                    type: 'BOOKED_MISMATCH',
                    severity: 'HIGH',
                    message: `BookedStock mismatch: Recorded=${recordedBooked}, Actual=${actualBookedStock}, Diff=${actualBookedStock - recordedBooked}`
                });
            }
            
            if (recordedAvailable !== correctAvailableStock) {
                tileIssues.push({
                    type: 'AVAILABLE_MISMATCH',
                    severity: 'MEDIUM',
                    message: `AvailableStock should be ${correctAvailableStock} but is ${recordedAvailable}`
                });
            }
            
            if (tileIssues.length > 0) {
                issues.push({
                    tileName: tile.name,
                    tileNumber: tile.number,
                    currentStock: {
                        inFactoryStock: recordedInFactory,
                        bookedStock: recordedBooked,
                        availableStock: recordedAvailable,
                        restockingStock: tile.stockDetails.restockingStock || 0
                    },
                    correctStock: {
                        inFactoryStock: actualInFactoryStock,
                        bookedStock: actualBookedStock,
                        availableStock: correctAvailableStock
                    },
                    palletCount: pallets.length,
                    issues: tileIssues
                });
            }
        }
        
        const criticalIssues = issues.filter(i => 
            i.issues.some(issue => issue.severity === 'CRITICAL')
        );
        
        console.log(`\n📊 Check Results:`);
        console.log(`   Total tiles: ${tiles.length}`);
        console.log(`   Tiles with issues: ${issues.length}`);
        console.log(`   Critical issues: ${criticalIssues.length}`);
        
        res.status(200).json({
            success: true,
            message: issues.length === 0 ? 'All stock is accurate' : 'Stock issues found',
            summary: {
                tilesChecked: tiles.length,
                tilesWithIssues: issues.length,
                criticalIssues: criticalIssues.length
            },
            issues: issues
        });
        
    } catch (error) {
        console.error('❌ Check failed:', error);
        res.status(400);
        throw new Error(error.message || 'Stock check failed');
    }
});