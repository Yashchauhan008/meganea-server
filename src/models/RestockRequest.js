const mongoose = require('mongoose');

const arrivalHistorySchema = new mongoose.Schema({
  containerId: { type: String, required: true },
  quantity: { type: Number, required: true },
  arrivalDate: { type: Date, default: Date.now },
});

const requestedItemSchema = new mongoose.Schema({
  tile: { type: mongoose.Schema.Types.ObjectId, ref: 'Tile', required: true },
  quantity: { type: Number, required: true },
  status: {
    type: String,
    enum: ['Pending', 'Ordered', 'In Transit', 'Arrived'],
    default: 'Pending',
  },
  arrivalHistory: [arrivalHistorySchema],
});

const restockRequestSchema = new mongoose.Schema({
  requestId: { type: String, required: true, unique: true, index: true },
  status: {
    type: String,
    enum: ['Pending', 'Processing', 'Partially Arrived', 'Completed', 'Cancelled'],
    default: 'Pending',
    index: true,
  },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requestedAt: { type: Date, default: Date.now, index: true },
  notes: { type: String },
  completedAt: { type: Date },
  requestedItems: [requestedItemSchema],
}, { timestamps: true });

const RestockRequest = mongoose.model('RestockRequest', restockRequestSchema);
module.exports = RestockRequest;
