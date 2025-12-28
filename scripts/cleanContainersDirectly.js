// backend/scripts/cleanContainersDirectly.js
// Run with: node backend/scripts/cleanContainersDirectly.js

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const cleanContainers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const containersCollection = db.collection('containers');

    // Get ALL containers (bypass mongoose filters)
    const allContainers = await containersCollection.find({}).toArray();
    console.log(`📦 Found ${allContainers.length} total containers in database\n`);

    let cleanedCount = 0;
    let deletedCount = 0;

    for (const container of allContainers) {
      console.log(`\n--- ${container.containerNumber} ---`);
      console.log(`Status: ${container.status}`);
      console.log(`Deleted: ${container.deleted}`);
      console.log(`DispatchOrder: ${container.dispatchOrder}`);

      let needsUpdate = false;
      const updates = {};

      // Check and clean pallets array
      if (container.pallets && Array.isArray(container.pallets)) {
        const originalLength = container.pallets.length;
        const cleaned = container.pallets.filter(id => id !== null && id !== undefined);
        
        if (cleaned.length !== originalLength) {
          console.log(`❌ Found ${originalLength - cleaned.length} null pallets - CLEANING`);
          updates.pallets = cleaned;
          needsUpdate = true;
        } else {
          console.log(`✅ Pallets: ${cleaned.length} valid`);
        }
      } else {
        console.log(`ℹ️  No pallets array or empty`);
        updates.pallets = [];
        needsUpdate = true;
      }

      // Check and clean khatlis array
      if (container.khatlis && Array.isArray(container.khatlis)) {
        const originalLength = container.khatlis.length;
        const cleaned = container.khatlis.filter(id => id !== null && id !== undefined);
        
        if (cleaned.length !== originalLength) {
          console.log(`❌ Found ${originalLength - cleaned.length} null khatlis - CLEANING`);
          updates.khatlis = cleaned;
          needsUpdate = true;
        } else {
          console.log(`✅ Khatlis: ${cleaned.length} valid`);
        }
      } else {
        console.log(`ℹ️  No khatlis array or empty`);
        updates.khatlis = [];
        needsUpdate = true;
      }

      // Check if container should be available for dispatch
      const shouldBeAvailable = (
        (container.status === 'Loaded' || container.status === 'Ready to Dispatch') &&
        !container.dispatchOrder &&
        !container.deleted
      );

      console.log(`Available for dispatch: ${shouldBeAvailable ? 'YES' : 'NO'}`);

      // Delete completely empty containers
      const totalItems = (updates.pallets?.length || container.pallets?.filter(p => p).length || 0) +
                         (updates.khatlis?.length || container.khatlis?.filter(k => k).length || 0);

      if (totalItems === 0 && shouldBeAvailable) {
        console.log(`🗑️  Container is EMPTY - marking as deleted`);
        updates.deleted = true;
        updates.status = 'Empty';
        needsUpdate = true;
        deletedCount++;
      }

      // Apply updates
      if (needsUpdate) {
        await containersCollection.updateOne(
          { _id: container._id },
          { $set: updates }
        );
        console.log(`✅ UPDATED container ${container.containerNumber}`);
        cleanedCount++;
      }
    }

    console.log('\n===========================================');
    console.log(`✅ Cleaned ${cleanedCount} containers`);
    console.log(`🗑️  Marked ${deletedCount} empty containers as deleted`);
    console.log('===========================================\n');

    // Show available containers after cleanup
    const available = await containersCollection.find({
      status: { $in: ['Loaded', 'Ready to Dispatch'] },
      dispatchOrder: null,
      deleted: { $ne: true }
    }).toArray();

    console.log(`\n📦 Containers available for dispatch: ${available.length}\n`);
    
    for (const c of available) {
      const palletCount = (c.pallets || []).filter(p => p).length;
      const khatliCount = (c.khatlis || []).filter(k => k).length;
      const totalItems = palletCount + khatliCount;
      
      console.log(`  ${c.containerNumber}: ${palletCount}P + ${khatliCount}K = ${totalItems} items`);
      
      if (totalItems === 0) {
        console.log(`    ⚠️  WARNING: This container shows as available but has 0 items!`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

cleanContainers();