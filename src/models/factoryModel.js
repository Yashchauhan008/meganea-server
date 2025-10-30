import mongoose from 'mongoose';

const factorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    address: { type: String },
    contactPerson: { type: String },
    deleted: { type: Boolean, default: false, select: false },
}, { timestamps: true });

// Middleware to exclude soft-deleted documents
factorySchema.pre(/^find/, function(next) {
  this.where({ deleted: { $ne: true } });
  next();
});

const Factory = mongoose.model('Factory', factorySchema);
export default Factory;
