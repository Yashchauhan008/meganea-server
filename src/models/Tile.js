const mongoose = require('mongoose');

const tileSchema = new mongoose.Schema({
  tileId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, index: true },
  number: { type: String, required: true },
  surface: { type: String, required: true, index: true },
  size: { type: String, required: true, index: true },
  imageUrl: { type: String, required: true },
  stockDetails: {
    currentStock: { type: Number, default: 0 },
    bookedStock: { type: Number, default: 0 },
    restockingStock: { type: Number, default: 0 },
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

tileSchema.index({ name: 'text' });

const Tile = mongoose.model('Tile', tileSchema);
module.exports = Tile;
