import mongoose from 'mongoose';

const arrivalHistorySchema = new mongoose.Schema({
  quantity: { type: Number, required: true },
  arrivalDate: { type: Date, default: Date.now },
  notes: { type: String },
});

const requestedItemSchema = new mongoose.Schema({
  tile: { type: mongoose.Schema.Types.ObjectId, ref: 'Tile', required: true },
  quantityRequested: { type: Number, required: true, min: 1 },
  quantityShipped: { type: Number, default: 0 },
  quantityArrived: { type: Number, default: 0 },
  arrivalHistory: [arrivalHistorySchema],
  purchaseOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseOrder',
    default: null // It starts as null and gets assigned when a PO is created.
  }
});

const restockRequestSchema = new mongoose.Schema({
  requestId: { type: String, required: true, unique: true },
  status: {
    type: String,
    enum: ['Pending', 'Processing', 'Partially Arrived', 'Completed', 'Cancelled','Completed with Discrepancy'],
    default: 'Pending',
  },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requestedItems: [requestedItemSchema],
  notes: { type: String },
  completedAt: { type: Date },
  deleted: { type: Boolean, default: false, select: false },
}, { timestamps: true });

// Pre-find hook for soft delete
restockRequestSchema.pre(/^find/, function (next) {
  this.where({ deleted: { $ne: true } });
  next();
});

const RestockRequest = mongoose.model('RestockRequest', restockRequestSchema);
export default RestockRequest;
