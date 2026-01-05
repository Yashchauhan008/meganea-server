// import mongoose from 'mongoose';
// import { generateId } from '../services/idGenerator.js';

// const qcHistorySchema = new mongoose.Schema({
//     quantityChecked: { type: Number, required: true },
//     quantityPassed: { type: Number, required: true },
//     quantityFailed: { type: Number, required: true },
//     qcDate: { type: Date, default: Date.now },
//     checkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//     notes: { type: String },
// });

// const poItemSchema = new mongoose.Schema({
//     tile: { 
//         type: mongoose.Schema.Types.ObjectId, 
//         ref: 'Tile',
//         required: true 
//     },
//     palletsOrdered: { type: Number, required: true, default: 0 },
//     khatlisOrdered: { type: Number, required: true, default: 0 },
//     totalBoxesOrdered: { type: Number },
//     quantityPassedQC: { type: Number, default: 0 },
//     // NEW: Track how many boxes have been converted to pallets/khatlis
//     boxesConverted: { type: Number, default: 0 },
//     // NEW: Track generated pallets/khatlis count per item
//     palletsGenerated: { type: Number, default: 0 },
//     khatlisGenerated: { type: Number, default: 0 },
//     qcHistory: [qcHistorySchema],
// });

// const purchaseOrderSchema = new mongoose.Schema({
//     poId: { type: String, required: true, unique: true },
//     sourceRestockRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'RestockRequest' },
//     factory: { type: mongoose.Schema.Types.ObjectId, ref: 'Factory', required: true },
//     packingRules: {
//         boxesPerPallet: { type: Number, required: true },
//         boxesPerKhatli: { type: Number, required: true },
//         palletsPerContainer: { type: Number, required: true },
//     },
//     items: [poItemSchema],
    
//     generatedPallets: [{
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'Pallet'
//     }],

//     status: {
//         type: String,
//         enum: ['Draft', 'SentToFactory', 'Manufacturing', 'QC_InProgress', 'QC_Completed', 'Packing', 'Completed', 'Cancelled'],
//         default: 'Draft',
//     },
//     createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//     notes: { type: String },
// }, { timestamps: true });

// // Pre-save hook
// purchaseOrderSchema.pre('save', function(next) {
//     if (this.isModified('items') || this.isModified('packingRules')) {
//         this.items.forEach(item => {
//             const boxesFromPallets = item.palletsOrdered * this.packingRules.boxesPerPallet;
//             const boxesFromKhatlis = item.khatlisOrdered * this.packingRules.boxesPerKhatli;
//             item.totalBoxesOrdered = boxesFromPallets + boxesFromKhatlis;
//         });
//     }
//     next();
// });

// // Pre-validate hook
// purchaseOrderSchema.pre('validate', async function(next) {
//     if (this.isNew && !this.poId) {
//         this.poId = await generateId('PO');
//     }
//     next();
// });

// const PurchaseOrder = mongoose.model('PurchaseOrder', purchaseOrderSchema);
// export default PurchaseOrder;
// FILE: backend/src/models/purchaseOrderModel.js
// Only added: soft delete fields + partial generation tracking fields
// All existing logic preserved

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
    
    // NEW: Tracking fields for partial pallet generation
    palletsGenerated: { type: Number, default: 0 },
    khatlisGenerated: { type: Number, default: 0 },
    boxesConverted: { type: Number, default: 0 },
});

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
    
    // Store reference to all pallets created from this PO
    generatedPallets: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Pallet'
    }],

    status: {
        type: String,
        enum: ['Draft', 'SentToFactory', 'Manufacturing', 'QC_InProgress', 'QC_Completed', 'Packing', 'Completed', 'Cancelled'],
        default: 'Draft',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String },
    
    // NEW: Soft delete fields
    deleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deletionReason: { type: String },
    
    // NEW: Cancellation tracking fields
    cancelledAt: { type: Date },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancellationReason: { type: String },
    
}, { timestamps: true });

// Pre-save hook (UNCHANGED)
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

// Pre-validate hook (UNCHANGED)
purchaseOrderSchema.pre('validate', async function(next) {
    if (this.isNew && !this.poId) {
        this.poId = await generateId('PO');
    }
    next();
});

const PurchaseOrder = mongoose.model('PurchaseOrder', purchaseOrderSchema);
export default PurchaseOrder;