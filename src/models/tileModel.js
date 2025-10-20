import mongoose from 'mongoose';

const tileSchema = new mongoose.Schema({
  tileId: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true },
  number: { type: String },
  surface: { type: String, required: true },
  size: { type: String, required: true },
  imageUrl: { type: String },
  conversionFactor: { type: Number, required: true, default: 1 },
  restockThreshold: { type: Number, default: 0, min: 0 },
  stockDetails: {
    currentStock: { type: Number, default: 0, min: 0 },
    bookedStock: { type: Number, default: 0, min: 0 },
    restockingStock: { type: Number, default: 0, min: 0 },
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

tileSchema.virtual('availableStock').get(function() {
  return this.stockDetails.currentStock - this.stockDetails.bookedStock;
});

const Tile = mongoose.model('Tile', tileSchema);
export default Tile;
