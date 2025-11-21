// import mongoose from 'mongoose';

// const arrivalHistorySchema = new mongoose.Schema({
//   quantity: { type: Number, required: true },
//   arrivalDate: { type: Date, default: Date.now },
//   notes: { type: String },
// });

// const requestedItemSchema = new mongoose.Schema({
//   tile: { type: mongoose.Schema.Types.ObjectId, ref: 'Tile', required: true },
//   quantityRequested: { type: Number, required: true, min: 1 },
//   quantityShipped: { type: Number, default: 0 },
//   quantityArrived: { type: Number, default: 0 },
//   arrivalHistory: [arrivalHistorySchema],
//   purchaseOrder: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'PurchaseOrder',
//     default: null // It starts as null and gets assigned when a PO is created.
//   }
// });

// const restockRequestSchema = new mongoose.Schema({
//   requestId: { type: String, required: true, unique: true },
//   status: {
//     type: String,
//     enum: ['Pending', 'Processing', 'Partially Arrived', 'Completed', 'Cancelled','Completed with Discrepancy'],
//     default: 'Pending',
//   },
//   requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   requestedItems: [requestedItemSchema],
//   notes: { type: String },
//   completedAt: { type: Date },
//   deleted: { type: Boolean, default: false, select: false },
// }, { timestamps: true });

// // Pre-find hook for soft delete
// restockRequestSchema.pre(/^find/, function (next) {
//   this.where({ deleted: { $ne: true } });
//   next();
// });

// const RestockRequest = mongoose.model('RestockRequest', restockRequestSchema);
// export default RestockRequest;
// backend/src/models/restockRequestModel.js

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

  // --- THIS IS THE ONLY ADDITION TO YOUR SCHEMA ---
  // This field will manually track the total quantity assigned across all POs.
  quantityInPO: {
    type: Number,
    default: 0
  },
  // ---------------------------------------------

  // This field remains unchanged for backward compatibility.
  // It will now represent the *most recent* PO created for this item.
  purchaseOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseOrder',
    default: null
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

// Pre-find hook for soft delete (no changes needed)
restockRequestSchema.pre(/^find/, function (next) {
  this.where({ deleted: { $ne: true } });
  next();
});

const RestockRequest = mongoose.model('RestockRequest', restockRequestSchema);
export default RestockRequest;
