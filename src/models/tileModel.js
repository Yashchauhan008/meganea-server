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
  // ADDED: Soft delete field
  deleted: { type: Boolean, default: false, select: false },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

// --- VIRTUALS & MIDDLEWARE ---

tileSchema.virtual('availableStock').get(function() {
  return this.stockDetails.currentStock - this.stockDetails.bookedStock;
});

// Exclude soft-deleted documents from all find queries
tileSchema.pre(/^find/, function (next) {
  this.where({ deleted: { $ne: true } });
  next();
});

// Static method to soft delete a tile
tileSchema.statics.archive = async function (id) {
  const tile = await this.findById(id);
  if (tile) {
    // Instead of deleting, we set the 'deleted' flag.
    // We also set isActive to false as a secondary measure.
    tile.deleted = true;
    tile.isActive = false; 
    await tile.save();
  }
  return tile;
};

const Tile = mongoose.model('Tile', tileSchema);
export default Tile;
