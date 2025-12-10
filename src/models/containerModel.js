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
        // This is now optional, as containers can be created independently.
        loadingPlan: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'LoadingPlan',
        },
        // We add a direct reference to the primary loading factory.
        factory: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Factory',
        },
        pallets: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Pallet',
            },
        ],
        status: {
            type: String,
            enum: ['Empty', 'Loading', 'Loaded', 'Dispatched', 'In Transit', 'Delivered'],
            default: 'Empty',
        },
        // We add a createdBy field
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

// The pre-save hook for ID generation remains.
containerSchema.pre('save', async function (next) {
    if (this.isNew && !this.containerId) {
        this.containerId = await generateId('CN');
    }
    next();
});

const Container = mongoose.model('Container', containerSchema);

export default Container;
