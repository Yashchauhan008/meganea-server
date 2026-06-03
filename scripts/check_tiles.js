import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Tile from '../src/models/tileModel.js';
import Pallet from '../src/models/palletModel.js';
import DispatchOrder from '../src/models/dispatchOrderModel.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const checkTiles = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const tiles = await Tile.find({ deleted: { $ne: true } });
  console.log('\n--- TILE STOCK DETAILS ---');
  for (const t of tiles) {
    // Count pallets by status for this tile
    const palletStats = await Pallet.aggregate([
      { $match: { tile: t._id, deleted: { $ne: true } } },
      { $group: { _id: '$status', count: { $sum: 1 }, totalBoxes: { $sum: '$boxCount' } } }
    ]);
    
    const palletCounts = {};
    palletStats.forEach(stat => {
      palletCounts[stat._id] = { count: stat.count, boxes: stat.totalBoxes };
    });

    console.log(`\nName: "${t.name}" (${t._id})`);
    console.log(`  stockDetails:`, JSON.stringify(t.stockDetails, null, 2));
    console.log(`  Pallets in DB by status:`, JSON.stringify(palletCounts, null, 2));
  }

  const dispatches = await DispatchOrder.find({ deleted: { $ne: true } });
  console.log('\n--- ACTIVE DISPATCH ORDERS ---');
  dispatches.forEach(d => {
    console.log(`DO: ${d.dispatchNumber} | Status: ${d.status} | Total Boxes: ${d.stockSummary?.totalBoxes || 0}`);
    d.containers.forEach(c => {
      console.log(`  Container: ${c.containerNumber} | Factory: ${c.factoryName} | Boxes: ${c.totalBoxes}`);
      c.items.forEach(item => {
        console.log(`    - Item: ${item.tileName} | Type: ${item.itemType} | Boxes: ${item.boxCount}`);
      });
    });
  });

  await mongoose.connection.close();
};

checkTiles().catch(console.error);
