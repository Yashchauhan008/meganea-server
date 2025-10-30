import mongoose from 'mongoose';
import { generateId } from '../services/idGenerator.js';

const containerSchema = new mongoose.Schema({
    containerNumber: { type: String, required: true },
    truckNumber: { type: String },
    pallets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Pallet' }],
});

const loadingPlanSchema = new mongoose.Schema({
    planId: { type: String, required: true, unique: true },
    sourceRestockRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'RestockRequest', required: true },
    containers: [containerSchema],
    status: {
        type: String,
        enum: ['Planning', 'ReadyToLoad', 'Loaded', 'Dispatched'],
        default: 'Planning',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Pre-validate hook to generate ID if it doesn't exist
loadingPlanSchema.pre('validate', async function(next) {
    if (this.isNew && !this.planId) {
        this.planId = await generateId('LP'); // 'LP' for Loading Plan
    }
    next();
});

const LoadingPlan = mongoose.model('LoadingPlan', loadingPlanSchema);
export default LoadingPlan;
