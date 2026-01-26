
// import mongoose from 'mongoose';

// const factorySchema = new mongoose.Schema({
//     name: { type: String, required: true, unique: true },
//     address: { type: String },
//     contactPerson: { type: String },
    
//     // Existing soft delete field
//     deleted: { type: Boolean, default: false, select: false },
    
//     // NEW: Additional tracking fields for delete
//     deletedAt: { type: Date, select: false },
//     deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', select: false },
    
// }, { timestamps: true });

// // Middleware to exclude soft-deleted documents (UNCHANGED)
// factorySchema.pre(/^find/, function(next) {
//   this.where({ deleted: { $ne: true } });
//   next();
// });

// const Factory = mongoose.model('Factory', factorySchema);
// export default Factory;

// FILE: backend/src/models/factoryModel.js
// ENHANCED VERSION WITH SAFE MIDDLEWARE

import mongoose from 'mongoose';

const factorySchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  address: { 
    type: String,
    trim: true,
    default: ''
  },
  contactPerson: { 
    type: String,
    trim: true,
    default: ''
  },
  contactNumber: {
    type: String,
    trim: true,
    default: ''
  },
  email: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Discontinued', 'Maintenance'],
    default: 'Active'
  },
  notes: {
    type: String,
    default: ''
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User'
  },
  // Soft delete fields
  deleted: { 
    type: Boolean, 
    default: false
  },
  deletedAt: { 
    type: Date,
    default: null
  },
  deletedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    default: null
  }
}, { 
  timestamps: true 
});

// SAFE middleware - only filters if deleted field exists and is true
factorySchema.pre('find', function() {
  // Only exclude explicitly deleted factories
  this.where({ $or: [{ deleted: false }, { deleted: { $exists: false } }] });
});

factorySchema.pre('findOne', function() {
  // Only exclude explicitly deleted factories
  this.where({ $or: [{ deleted: false }, { deleted: { $exists: false } }] });
});

// Index for name uniqueness (only for non-deleted)
factorySchema.index(
  { name: 1 },
  { 
    unique: true,
    partialFilterExpression: { 
      $or: [
        { deleted: false },
        { deleted: { $exists: false } }
      ]
    }
  }
);

const Factory = mongoose.model('Factory', factorySchema);
export default Factory;