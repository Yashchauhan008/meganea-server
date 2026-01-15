// Run this script ONCE to sync inTransitStock for existing "In Transit" dispatches
// Execute with: node syncTransitStock.js

import mongoose from 'mongoose';

// MongoDB URI - hardcoded for this one-time script
const MONGO_URI = 'mongodb+srv://meganea:meganeasoftwere@cluster0.krfqiph.mongodb.net/mega002';

// Define schemas inline to avoid import path issues
const tileSchema = new mongoose.Schema({
  name: String,
  stockDetails: {
    availableStock: { type: Number, default: 0 },
    bookedStock: { type: Number, default: 0 },
    restockingStock: { type: Number, default: 0 },
    inFactoryStock: { type: Number, default: 0 },
    inTransitStock: { type: Number, default: 0 },
  },
}, { timestamps: true });

const dispatchOrderSchema = new mongoose.Schema({
  dispatchNumber: String,
  status: String,
  deleted: Boolean,
  containers: [{
    containerId: mongoose.Schema.Types.ObjectId,
    factory: mongoose.Schema.Types.ObjectId,
    items: [{
      itemId: mongoose.Schema.Types.ObjectId,
      itemType: String,
      tileId: mongoose.Schema.Types.ObjectId,
      tileName: String,
      boxCount: Number,
      quantity: Number,
    }],
  }],
}, { timestamps: true });

const Tile = mongoose.model('Tile', tileSchema);
const DispatchOrder = mongoose.model('DispatchOrder', dispatchOrderSchema);

const syncTransitStock = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // First, reset all inTransitStock to 0
    const resetResult = await Tile.updateMany({}, { $set: { 'stockDetails.inTransitStock': 0 } });
    console.log(`🔄 Reset inTransitStock to 0 for ${resetResult.modifiedCount} tiles`);

    // Find all "In Transit" dispatches
    const inTransitDispatches = await DispatchOrder.find({ 
      status: 'In Transit',
      deleted: { $ne: true }
    });

    console.log(`📦 Found ${inTransitDispatches.length} dispatches in "In Transit" status`);

    if (inTransitDispatches.length === 0) {
      console.log('No dispatches in transit. Nothing to sync.');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Calculate transit stock per tile
    const tileTransitStock = new Map();

    for (const dispatch of inTransitDispatches) {
      console.log(`\n📋 Processing dispatch: ${dispatch.dispatchNumber}`);
      
      for (const container of dispatch.containers) {
        for (const item of container.items) {
          if (item.tileId) {
            const tileId = item.tileId.toString();
            const boxes = item.boxCount * item.quantity;
            
            if (!tileTransitStock.has(tileId)) {
              tileTransitStock.set(tileId, 0);
            }
            tileTransitStock.set(tileId, tileTransitStock.get(tileId) + boxes);
            
            console.log(`   - ${item.tileName}: ${boxes} boxes`);
          }
        }
      }
    }

    console.log(`\n🔧 Updating transit stock for ${tileTransitStock.size} tiles...`);

    // Update each tile's inTransitStock
    for (const [tileId, boxes] of tileTransitStock.entries()) {
      const result = await Tile.findByIdAndUpdate(
        tileId,
        { $set: { 'stockDetails.inTransitStock': boxes } },
        { new: true }
      );
      
      if (result) {
        console.log(`   ✅ ${result.name}: inTransitStock = ${boxes}`);
      } else {
        console.log(`   ⚠️ Tile ID ${tileId} not found in database`);
      }
    }

    console.log('\n🎉 Transit stock sync completed successfully!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
};

syncTransitStock();