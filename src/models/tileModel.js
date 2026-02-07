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
    // Remove unique constraint - we'll handle uniqueness in application logic
    // to allow same name for soft-deleted tiles
  },
  number: { 
    type: String,
    // Remove unique constraint - we'll handle uniqueness in application logic
    sparse: true,
  },
  surface: { 
    type: String, 
    required: true,
    enum: ['Glossy', 'Matt', 'CARVING', 'SINKER', 'R-10', 'R-11']
  },
  size: { type: String, required: true },
  imageUrl: { type: String },
  publicId: { type: String },
  conversionFactor: { type: Number, required: true, default: 1 },
  restockThreshold: { type: Number, default: 0, min: 0 },
  
  // Stock details
  stockDetails: {
    availableStock: { type: Number, default: 0, min: 0 },
    bookedStock: { type: Number, default: 0, min: 0 },
    restockingStock: { type: Number, default: 0, min: 0 },
    inFactoryStock: { type: Number, default: 0, min: 0 },
    inTransitStock: { type: Number, default: 0, min: 0 },
  },

  // Manufacturing factories
  manufacturingFactories: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Factory' 
  }],

  // Status
  isActive: { type: Boolean, default: true },
  
  // Audit fields
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  // Soft delete fields
  deleted: { 
    type: Boolean, 
    default: false, 
    select: false  // Hidden by default, must explicitly select
  },
  deletedAt: { 
    type: Date, 
    select: false  // Hidden by default
  },
  deletedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    select: false  // Hidden by default
  },
}, { 
  timestamps: true 
});

// Static method for soft delete (for backward compatibility)
tileSchema.statics.archive = async function(id) {
    const doc = await this.findById(id);
    if (doc) {
        doc.deleted = true;
        doc.deletedAt = new Date();
        await doc.save();
    }
    return doc;
};

// Middleware to exclude deleted documents from normal queries
// Note: This middleware is bypassed when explicitly querying for deleted docs
tileSchema.pre('find', function() {
  // Only apply filter if deleted is not already in the query
  const query = this.getQuery();
  if (query.deleted === undefined) {
    this.where({ deleted: { $ne: true } });
  }
});

tileSchema.pre('findOne', function() {
  // Only apply filter if deleted is not already in the query
  const query = this.getQuery();
  if (query.deleted === undefined) {
    this.where({ deleted: { $ne: true } });
  }
});

// Partial unique indexes - only enforced for non-deleted tiles
// This allows soft-deleted tiles to have duplicate names/numbers
tileSchema.index(
  { name: 1 },
  { 
    unique: true,
    partialFilterExpression: { deleted: { $ne: true } }
  }
);

tileSchema.index(
  { number: 1 },
  { 
    unique: true,
    sparse: true,
    partialFilterExpression: { deleted: { $ne: true } }
  }
);

const Tile = mongoose.model('Tile', tileSchema);
export default Tile;