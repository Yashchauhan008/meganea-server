// import mongoose from 'mongoose';

// const arrivalHistorySchema = new mongoose.Schema({
//   quantity: { type: Number, required: true },
//   arrivalDate: { type: Date, default: Date.now },
//   notes: { type: String },
// });

// const requestedItemSchema = new mongoose.Schema({
//   tile: { type: mongoose.Schema.Types.ObjectId, ref: 'Tile', required: true },
//   quantityRequested: { type: Number, required: true },
//   quantityArrived: { type: Number, default: 0 },
//   arrivalHistory: [arrivalHistorySchema],
// });

// const restockRequestSchema = new mongoose.Schema({
//   requestId: { type: String, required: true, unique: true },
//   status: {
//     type: String,
//     enum: ['Pending', 'Processing', 'Partially Arrived', 'Completed', 'Cancelled'],
//     default: 'Pending',
//   },
//   requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   requestedItems: [requestedItemSchema],
//   notes: { type: String },
//   completedAt: { type: Date },
// }, { timestamps: true });

// const RestockRequest = mongoose.model('RestockRequest', restockRequestSchema);
// export default RestockRequest;

import mongoose from 'mongoose';

const arrivalHistorySchema = new mongoose.Schema({
  quantity: { type: Number, required: true },
  arrivalDate: { type: Date, default: Date.now },
  notes: { type: String },
});

const requestedItemSchema = new mongoose.Schema({
  tile: { type: mongoose.Schema.Types.ObjectId, ref: 'Tile', required: true },
  quantityRequested: { type: Number, required: true },
  quantityArrived: { type: Number, default: 0 },
  arrivalHistory: [arrivalHistorySchema],
});

const restockRequestSchema = new mongoose.Schema({
  requestId: { type: String, required: true, unique: true },
  status: {
    type: String,
    enum: ['Pending', 'Processing', 'Partially Arrived', 'Completed', 'Cancelled'],
    default: 'Pending',
  },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requestedItems: [requestedItemSchema],
  notes: { type: String },
  completedAt: { type: Date },
  // ADDED: Soft delete field
  deleted: { type: Boolean, default: false, select: false },
}, { timestamps: true });

// Exclude soft-deleted documents from all find queries
restockRequestSchema.pre(/^find/, function (next) {
  this.where({ deleted: { $ne: true } });
  next();
});

// Static method to soft delete a restock request
restockRequestSchema.statics.archive = async function (id) {
  const restockRequest = await this.findById(id);
  if (restockRequest) {
    restockRequest.deleted = true;
    await restockRequest.save();
  }
  return restockRequest;
};

const RestockRequest = mongoose.model('RestockRequest', restockRequestSchema);
export default RestockRequest;
