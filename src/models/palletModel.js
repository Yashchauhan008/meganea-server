// backend/src/models/palletModel.js

import mongoose from 'mongoose';
import { generateId } from '../services/idGenerator.js';

const palletSchema = new mongoose.Schema(
    {
        palletId: {
            type: String,
            required: true,
            unique: true,
        },
        factory: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Factory',
            required: true,
        },
        tile: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Tile',
            required: true,
        },
        sourcePurchaseOrder: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'PurchaseOrder',
            required: true,
        },
        type: {
            type: String,
            enum: ['Pallet', 'Khatli'],
            required: true,
        },
        boxCount: {
            type: Number,
            required: true,
        },
        status: {
            type: String,
            // --- 1. ADD THE NEW STATUS ---
            enum: ['InFactoryStock', 'LoadedInContainer', 'Dispatched', 'Delivered'],
            default: 'InFactoryStock',
        },
        // --- 2. ADD THE CONTAINER REFERENCE ---
        // This will be null until the pallet is loaded into a container
        container: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Container',
            default: null,
        },
        isManualAdjustment: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

palletSchema.pre('save', async function (next) {
    if (this.isNew) {
        this.palletId = await generateId('PA');
    }
    next();
});

const Pallet = mongoose.model('Pallet', palletSchema);

export default Pallet;
