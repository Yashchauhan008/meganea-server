// import mongoose from 'mongoose';

// const factorySchema = new mongoose.Schema({
//     name: { type: String, required: true, unique: true },
//     address: { type: String },
//     contactPerson: { type: String },
//     deleted: { type: Boolean, default: false, select: false },
// }, { timestamps: true });

// // Middleware to exclude soft-deleted documents
// factorySchema.pre(/^find/, function(next) {
//   this.where({ deleted: { $ne: true } });
//   next();
// });

// const Factory = mongoose.model('Factory', factorySchema);
// export default Factory;

import mongoose from 'mongoose';

const factorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    address: { type: String },
    contactPerson: { type: String },
    
    // Existing soft delete field
    deleted: { type: Boolean, default: false, select: false },
    
    // NEW: Additional tracking fields for delete
    deletedAt: { type: Date, select: false },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', select: false },
    
}, { timestamps: true });

// Middleware to exclude soft-deleted documents (UNCHANGED)
factorySchema.pre(/^find/, function(next) {
  this.where({ deleted: { $ne: true } });
  next();
});

const Factory = mongoose.model('Factory', factorySchema);
export default Factory;
