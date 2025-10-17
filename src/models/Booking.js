const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  bookingId: { type: String, required: true, unique: true, index: true },
  customerName: { type: String, required: true },
  contactNumber: { type: String, required: true, index: true },
  tilesList: [
    {
      tile: { type: mongoose.Schema.Types.ObjectId, ref: 'Tile', required: true },
      quantity: { type: Number, required: true, min: 1 },
    },
  ],
  status: {
    type: String,
    enum: ['Booked', 'Fulfilled', 'Cancelled', 'Partial'],
    default: 'Booked',
    index: true,
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  notes: { type: String },
  fulfilledAt: { type: Date },
  cancelledAt: { type: Date },
}, { timestamps: true });

const Booking = mongoose.model('Booking', bookingSchema);
module.exports = Booking;
