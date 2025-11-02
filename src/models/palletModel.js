import mongoose from 'mongoose';
import { generateId } from '../services/idGenerator.js'; // Assuming you'll add 'PL' to your generator

const palletSchema = new mongoose.Schema({
    palletId: { type: String, required: true, unique: true },
    factory: { type: mongoose.Schema.Types.ObjectId, ref: 'Factory', required: true },
    tile: { type: mongoose.Schema.Types.ObjectId, ref: 'Tile', required: true }, // Changed from 'IndiaTile' to 'Tile'
    type: { type: String, enum: ['Pallet', 'Khatli'], required: true },
    boxCount: { type: Number, required: true },
    status: {
        type: String,
        enum: [
            'InProduction', 'InFactoryStock', 'AllocatedToPlan', 'InTransit_India',
            'InTransit_International', 'InDubaiStock', 'Opened', 'Empty'
        ],
        default: 'InProduction',
    },
    currentLocation: { type: String, default: 'Factory' },
    remainingBoxes: { type: Number },
    sourcePurchaseOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder', required: true },
    loadingPlan: { type: mongoose.Schema.Types.ObjectId, ref: 'LoadingPlan' },
    containerNumber: { type: String },
}, { timestamps: true });

// Pre-save hook to set remaining boxes on creation
palletSchema.pre('save', function(next) {
    if (this.isNew) {
        this.remainingBoxes = this.boxCount;
        if (!this.palletId) {
          // This part is tricky because generateId is async.
          // It's better to handle ID generation in the controller before saving.
        }
    }
    next();
});

// Pre-validate hook to generate ID if it doesn't exist
palletSchema.pre('validate', async function(next) {
    if (this.isNew && !this.palletId) {
        this.palletId = await generateId('PA'); // 'PA' for Pallet
    }
    next();
});

palletSchema.index({ factory: 1, tile: 1, status: 1 });
palletSchema.index({ status: 1, currentLocation: 1 });

const Pallet = mongoose.model('Pallet', palletSchema);
export default Pallet;
