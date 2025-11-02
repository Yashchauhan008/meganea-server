import mongoose from 'mongoose';
import { generateId } from '../services/idGenerator.js'; // Assuming you'll add 'PO' to your generator

const poItemSchema = new mongoose.Schema({
    manufacturingFactories: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Factory' 
    }],    palletsOrdered: { type: Number, required: true, default: 0 },
    khatlisOrdered: { type: Number, required: true, default: 0 },
    totalBoxesOrdered: { type: Number },
    quantityPassedQC: { type: Number, default: 0 },
    qcHistory: [{
        quantityChecked: { type: Number, required: true },
        quantityPassed: { type: Number, required: true },
        quantityFailed: { type: Number, required: true },
        qcDate: { type: Date, default: Date.now },
        checkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        notes: { type: String },
    }],
});

const purchaseOrderSchema = new mongoose.Schema({
    poId: { type: String, required: true, unique: true },
    sourceRestockRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'RestockRequest', required: true },
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

// Pre-save hook to calculate total boxes ordered
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

// Pre-validate hook to generate ID if it doesn't exist
purchaseOrderSchema.pre('validate', async function(next) {
    if (this.isNew && !this.poId) {
        this.poId = await generateId('PO'); // Add 'PO' to your idGenerator service
    }
    next();
});

const PurchaseOrder = mongoose.model('PurchaseOrder', purchaseOrderSchema);
export default PurchaseOrder;
