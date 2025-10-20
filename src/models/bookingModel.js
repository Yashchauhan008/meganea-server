import mongoose from 'mongoose';

const unprocessedImageSchema = new mongoose.Schema({
  imageUrl: { type: String, required: true },
  publicId: { type: String, required: true }, // For Cloudinary deletion
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedAt: { type: Date, default: Date.now },
});

const bookingSchema = new mongoose.Schema({
  bookingId: { type: String, required: true, unique: true },
  bookingType: { type: String, enum: ['Standard', 'Emergency'], default: 'Standard' },
  party: { type: mongoose.Schema.Types.ObjectId, ref: 'Party' },
  salesman: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lpoNumber: { type: String },
  tilesList: [{
    tile: { type: mongoose.Schema.Types.ObjectId, ref: 'Tile', required: true },
    quantity: { type: Number, required: true, min: 1 },
  }],
  status: {
    type: String,
    enum: ['Booked', 'Partially Dispatched', 'Completed', 'Cancelled'],
    default: 'Booked',
  },
  unprocessedImages: [unprocessedImageSchema],
  dispatchOrders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'DispatchOrder' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  notes: { type: String },
  completedAt: { type: Date },
}, { timestamps: true });

const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;
