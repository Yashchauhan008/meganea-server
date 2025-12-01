// backend/src/models/palletModel.js

import mongoose from 'mongoose';
import { generateId } from '../services/idGenerator.js';

const palletSchema = new mongoose.Schema({
    palletId: { 
        type: String, 
        required: true, 
        unique: true 
    },
    factory: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Factory', 
        required: true 
    },
    tile: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Tile', 
        required: true 
    },
    type: { 
        type: String, 
        enum: ['Pallet', 'Khatli'], 
        required: true 
    },
    boxCount: { 
        type: Number, 
        required: true 
    },
    status: {
        type: String,
        enum: ['InFactoryStock', 'AllocatedToPlan', 'InTransit'], // Simplified for now
        default: 'InFactoryStock',
    },
    isManualAdjustment: { type: Boolean, default: false },

    sourcePurchaseOrder: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'PurchaseOrder', 
        required: true 
    },
}, { timestamps: true });

// Pre-validate hook to generate a unique ID before saving
palletSchema.pre('validate', async function(next) {
    if (this.isNew && !this.palletId) {
        try {
            this.palletId = await generateId('PA'); // 'PA' for Pallet
        } catch (error) {
            // Pass any error from generateId to the next middleware
            return next(error);
        }
    }
    next();
});

// Add indexes for faster querying
palletSchema.index({ factory: 1, tile: 1, status: 1 });
palletSchema.index({ status: 1 });

const Pallet = mongoose.model('Pallet', palletSchema);

export default Pallet;
