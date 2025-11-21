// backend/src/models/purchaseOrderModel.js

import mongoose from 'mongoose';
import { generateId } from '../services/idGenerator.js';

const qcHistorySchema = new mongoose.Schema({
    quantityChecked: { type: Number, required: true },
    quantityPassed: { type: Number, required: true },
    quantityFailed: { type: Number, required: true },
    qcDate: { type: Date, default: Date.now },
    checkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String },
});

// --- THIS IS THE FIX ---
// The `{ _id: false }` option has been removed.
// Mongoose will now automatically assign a unique _id to each item in the PO.
const poItemSchema = new mongoose.Schema({
    tile: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Tile',
        required: true 
    },
    palletsOrdered: { type: Number, required: true, default: 0 },
    khatlisOrdered: { type: Number, required: true, default: 0 },
    totalBoxesOrdered: { type: Number },
    quantityPassedQC: { type: Number, default: 0 },
    qcHistory: [qcHistorySchema],
});
// --------------------

const purchaseOrderSchema = new mongoose.Schema({
    poId: { type: String, required: true, unique: true },
    sourceRestockRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'RestockRequest' },
    factory: { type: mongoose.Schema.Types.ObjectId, ref: 'Factory', required: true },
    packingRules: {
        boxesPerPallet: { type: Number, required: true },
        boxesPerKhatli: { type: Number, required: true },
        palletsPerContainer: { type: Number, required: true },
    },
    items: [poItemSchema],
    status: {
        type: String,
        enum: ['Draft', 'SentToFactory', 'Manufacturing', 'QC_InProgress', 'QC_Completed', 'Packing', 'Completed', 'Cancelled'],
        default: 'Draft',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String },
}, { timestamps: true });

// Pre-save hook to calculate total boxes (no changes here)
purchaseOrderSchema.pre('save', function(next) {
    if (this.isModified('items') || this.isModified('packingRules')) {
        this.items.forEach(item => {
            const boxesFromPallets = item.palletsOrdered * this.packingRules.boxesPerPallet;
            const boxesFromKhatlis = item.khatlisOrdered * this.packingRules.boxesPerKhatli;
            item.totalBoxesOrdered = boxesFromPallets + boxesFromKhatlis;
        });
    }
    next();
});

// Pre-validate hook to generate PO ID (no changes here)
purchaseOrderSchema.pre('validate', async function(next) {
    if (this.isNew && !this.poId) {
        this.poId = await generateId('PO');
    }
    next();
});

const PurchaseOrder = mongoose.model('PurchaseOrder', purchaseOrderSchema);
export default PurchaseOrder;
