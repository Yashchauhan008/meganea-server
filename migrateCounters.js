// migrateCounters.js

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Counter from './src/models/counterModel.js';
import Booking from './src/models/bookingModel.js';
import DispatchOrder from './src/models/dispatchOrderModel.js';
import Company from './src/models/companyModel.js';
import RestockRequest from './src/models/restockRequestModel.js';
import Tile from './src/models/tileModel.js';
import PurchaseOrder from './src/models/purchaseOrderModel.js';
import Pallet from './src/models/palletModel.js';
import LoadingPlan from './src/models/loadingPlanModel.js';

dotenv.config();

// Define all the models and their corresponding ID fields
const modelsToMigrate = [
    { model: Booking, idField: 'bookingId', prefix: 'BK' },
    { model: DispatchOrder, idField: 'dispatchNumber', prefix: 'DO' },
    { model: Company, idField: 'companyId', prefix: 'PT' },
    { model: RestockRequest, idField: 'requestId', prefix: 'RQ' },
    { model: Tile, idField: 'tileId', prefix: 'TL' },
    { model: PurchaseOrder, idField: 'poId', prefix: 'PO' },
    { model: Pallet, idField: 'palletId', prefix: 'PA' },
    { model: LoadingPlan, idField: 'planId', prefix: 'LP' },
];

const migrate = async () => {
    try {
        // 1. Connect to the database
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected for migration...');

        for (const { model, idField, prefix } of modelsToMigrate) {
            console.log(`Processing prefix: ${prefix}...`);

            // 2. Find the document with the highest ID for the current model
            const lastDoc = await model.findOne().sort({ [idField]: -1 });

            let maxNum = 0;
            if (lastDoc && lastDoc[idField]) {
                const parts = lastDoc[idField].split('-');
                const numPart = parseInt(parts[1], 10);
                if (!isNaN(numPart)) {
                    maxNum = numPart;
                }
            }

            // 3. Update or create the counter document with the highest found number
            await Counter.updateOne(
                { _id: prefix },
                { sequence_value: maxNum },
                { upsert: true } // Creates the counter if it doesn't exist
            );

            console.log(`✅ Counter for '${prefix}' set to ${maxNum}.`);
        }

        console.log('\nMigration complete! All counters are synchronized with existing data.');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        // 4. Disconnect from the database
        await mongoose.disconnect();
        console.log('MongoDB Disconnected.');
    }
};

// Run the migration
migrate();
