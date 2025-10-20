import mongoose from 'mongoose';

const dispatchOrderSchema = new mongoose.Schema({
  dispatchNumber: { type: String, required: true, unique: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  salesman: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  invoiceNumber: { type: String },
  sourceImage: { // Storing more info than just the URL
    imageUrl: { type: String, required: true },
    publicId: { type: String, required: true },
    unprocessedImageId: { type: mongoose.Schema.Types.ObjectId, required: true }
  },
  dispatchedItems: [{
    tile: { type: mongoose.Schema.Types.ObjectId, ref: 'Tile', required: true },
    quantity: { type: Number, required: true, min: 1 },
  }],
  status: { type: String, enum: ['Verified', 'Dispatched'], default: 'Verified' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dispatchedAt: { type: Date, default: Date.now },
}, { timestamps: true });

const DispatchOrder = mongoose.model('DispatchOrder', dispatchOrderSchema);
export default DispatchOrder;
