// backend/src/models/containerModel.js

import mongoose from 'mongoose';
import { generateId } from '../services/idGenerator.js';

const containerSchema = new mongoose.Schema(
    {
        containerId: {
            type: String,
            required: true,
            unique: true,
        },
        containerNumber: {
            type: String,
            required: [true, 'Container number is required.'],
            trim: true,
            uppercase: true,
        },
        truckNumber: {
            type: String,
            required: [true, 'Truck number is required.'],
            trim: true,
            uppercase: true,
        },
        pallets: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Pallet',
            },
        ],
        loadingPlan: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'LoadingPlan',
            required: true,
        },
        status: {
            type: String,
            enum: ['Loaded', 'Dispatched'],
            default: 'Loaded',
        },
        dispatchPlan: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'DispatchPlan',
        },
    },
    {
        timestamps: true,
    }
);

// --- THIS IS THE FIX ---
// The pre-save hook now correctly uses the 'CN' prefix with your idGenerator.
// Your generator will create a new counter document with _id: 'CN' if it doesn't exist.
containerSchema.pre('save', async function (next) {
    if (this.isNew) {
        // This will now correctly call your idGenerator with the prefix 'CN'
        // and assign the result (e.g., "CN-00001") to the containerId field.
        this.containerId = await generateId('CN');
    }
    next();
});
// --- END OF FIX ---

const Container = mongoose.model('Container', containerSchema);

export default Container;
