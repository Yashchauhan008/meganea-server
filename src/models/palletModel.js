// backend/src/models/palletModel.js

import mongoose from 'mongoose';
// The idGenerator is no longer needed here
// import { generateId } from '../services/idGenerator.js';

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
            enum: ['InFactoryStock', 'LoadedInContainer', 'Dispatched', 'Delivered'],
            default: 'InFactoryStock',
        },
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

// --- THIS IS THE FIX ---
// The pre-save hook is REMOVED because it does not trigger on `insertMany`.
// We will handle ID generation directly in the controller.
/*
palletSchema.pre('save', async function (next) {
    if (this.isNew) {
        this.palletId = await generateId('PA');
    }
    next();
});
*/
// --- END OF FIX ---


const Pallet = mongoose.model('Pallet', palletSchema);

export default Pallet;
