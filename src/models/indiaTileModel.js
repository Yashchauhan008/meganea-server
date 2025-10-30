import mongoose from 'mongoose';

const indiaTileSchema = new mongoose.Schema({
    name: { type: String, required: true },
    number: { type: String, unique: true, sparse: true },
    size: { type: String },
    surface: { type: String },
    image: { type: String },
    manufacturingFactories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Factory' }],
    deleted: { type: Boolean, default: false, select: false },
}, { timestamps: true });

// Middleware to exclude soft-deleted documents
indiaTileSchema.pre(/^find/, function(next) {
  this.where({ deleted: { $ne: true } });
  next();
});

const IndiaTile = mongoose.model('IndiaTile', indiaTileSchema);
export default IndiaTile;
