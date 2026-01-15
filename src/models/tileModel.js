// // FILE: backend/src/models/tileModel.js
// // Only added: deletedAt, deletedBy fields
// // All existing logic preserved

// import mongoose from 'mongoose';

// const tileSchema = new mongoose.Schema({
//   tileId: { 
//     type: String, 
//     required: true, 
//     unique: true, 
//     trim: true 
//   },
//   name: { 
//     type: String, 
//     required: true,
//     unique: true 
//   },
//   number: { 
//     type: String,
//     unique: true,
//     sparse: true,
//   },
//   surface: { 
//     type: String, 
//     required: true,
//     enum: ['Glossy', 'Matt']
//   },
//   size: { type: String, required: true },
//   imageUrl: { type: String },
//   publicId: { type: String },
//   conversionFactor: { type: Number, required: true, default: 1 },
//   restockThreshold: { type: Number, default: 0, min: 0 },
  
//   stockDetails: {
//     availableStock: { type: Number, default: 0, min: 0 },
//     bookedStock: { type: Number, default: 0, min: 0 },
//     restockingStock: { type: Number, default: 0, min: 0 },
//     inFactoryStock: { type: Number, default: 0, min: 0 }, 
//   },

//   manufacturingFactories: [{ 
//     type: mongoose.Schema.Types.ObjectId, 
//     ref: 'Factory' 
//   }],

//   isActive: { type: Boolean, default: true },
//   createdBy: { 
//     type: mongoose.Schema.Types.ObjectId, 
//     ref: 'User', 
//     required: true 
//   },
  
//   // Existing soft delete field
//   deleted: { type: Boolean, default: false, select: false },
  
//   // NEW: Additional tracking fields for delete
//   deletedAt: { type: Date, select: false },
//   deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', select: false },
  
// }, { timestamps: true });

// // Static method for archiving (UNCHANGED)
// tileSchema.statics.archive = async function(id) {
//     const doc = await this.findById(id);
//     if (doc) {
//         doc.deleted = true;
//         await doc.save();
//     }
//     return doc;
// };

// // Middleware to exclude deleted documents (UNCHANGED)
// tileSchema.pre('find', function() {
//   this.where({ deleted: { $ne: true } });
// });

// tileSchema.pre('findOne', function() {
//   this.where({ deleted: { $ne: true } });
// });

// const Tile = mongoose.model('Tile', tileSchema);
// export default Tile;

// import mongoose from 'mongoose';

// const tileSchema = new mongoose.Schema({
//   tileId: { 
//     type: String, 
//     required: true, 
//     unique: true, 
//     trim: true 
//   },
//   name: { 
//     type: String, 
//     required: true,
//     unique: true 
//   },
//   number: { 
//     type: String,
//     unique: true,
//     sparse: true, // Allows multiple tiles to have no number, but any number that is set must be unique.
//   },
//   surface: { 
//     type: String, 
//     required: true,
//     enum: ['Glossy', 'Matt']
//   },
//   size: { type: String, required: true },
//   imageUrl: { type: String },
//   publicId: { type: String },
//   conversionFactor: { type: Number, required: true, default: 1 },
//   restockThreshold: { type: Number, default: 0, min: 0 },
  
//   // --- THIS IS THE CORRECT AND FINAL SCHEMA FOR STOCK ---
//   stockDetails: {
//     availableStock: { type: Number, default: 0, min: 0 }, // Static, independent field
//     bookedStock: { type: Number, default: 0, min: 0 },    // Static, independent field
//     restockingStock: { type: Number, default: 0, min: 0 },// Static, independent field
//   },
//   // ------------------------------------------------------

//   isActive: { type: Boolean, default: true },
//   createdBy: { 
//     type: mongoose.Schema.Types.ObjectId, 
//     ref: 'User', 
//     required: true 
//   },
//   deleted: { type: Boolean, default: false, select: false },
// }, { timestamps: true });

// // --- The virtual property has been REMOVED. This is crucial. ---

// // Soft Delete Static Method
// tileSchema.statics.archive = async function(id) {
//     const doc = await this.findById(id);
//     if (doc) {
//         doc.deleted = true;
//         await doc.save();
//     }
//     return doc;
// };

// // Middleware to exclude deleted documents from queries
// tileSchema.pre('find', function() {
//   this.where({ deleted: { $ne: true } });
// });

// tileSchema.pre('findOne', function() {
//   this.where({ deleted: { $ne: true } });
// });

// const Tile = mongoose.model('Tile', tileSchema);
// export default Tile;

import mongoose from 'mongoose';

const tileSchema = new mongoose.Schema({
  tileId: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true 
  },
  name: { 
    type: String, 
    required: true,
    unique: true 
  },
  number: { 
    type: String,
    unique: true,
    sparse: true,
  },
  surface: { 
    type: String, 
    required: true,
    enum: ['Glossy', 'Matt']
  },
  size: { type: String, required: true },
  imageUrl: { type: String },
  publicId: { type: String },
  conversionFactor: { type: Number, required: true, default: 1 },
  restockThreshold: { type: Number, default: 0, min: 0 },
  
  stockDetails: {
    availableStock: { type: Number, default: 0, min: 0 },
    bookedStock: { type: Number, default: 0, min: 0 },
    restockingStock: { type: Number, default: 0, min: 0 },
    inFactoryStock: { type: Number, default: 0, min: 0 },
    inTransitStock: { type: Number, default: 0, min: 0 }, // Stock currently in transit
  },

  manufacturingFactories: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Factory' 
}],

  isActive: { type: Boolean, default: true },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  deleted: { type: Boolean, default: false, select: false },
}, { timestamps: true });

tileSchema.statics.archive = async function(id) {
    const doc = await this.findById(id);
    if (doc) {
        doc.deleted = true;
        await doc.save();
    }
    return doc;
};

tileSchema.pre('find', function() {
  this.where({ deleted: { $ne: true } });
});

tileSchema.pre('findOne', function() {
  this.where({ deleted: { $ne: true } });
});

const Tile = mongoose.model('Tile', tileSchema);
export default Tile;