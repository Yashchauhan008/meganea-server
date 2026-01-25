import mongoose from 'mongoose';

/**
 * Dubai Dispatch Order Model
 * 
 * This model is specifically for Dubai's booking-based dispatch system.
 * It handles dispatches created from processing delivery note images.
 * 
 * Completely independent from India's container-based dispatch system.
 */

const dubaiDispatchOrderSchema = new mongoose.Schema(
  {
    // Unique Dubai dispatch identifier (e.g., DDO-00001)
    dispatchNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // ========== BOOKING RELATIONSHIP ==========
    // The parent booking this dispatch belongs to
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },

    // Denormalized company name for quick access (no need to populate)
    companyName: {
      type: String,
      required: true,
      trim: true,
    },

    // ========== SOURCE EVIDENCE ==========
    // The delivery note image that was processed to create this dispatch
    sourceImage: {
      imageUrl: {
        type: String,
        required: true,
      },
      publicId: {
        type: String,
        required: true,
      },
      // Reference to the original unprocessed image ID from booking
      unprocessedImageId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
      },
      // Who uploaded the original image
      uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      // When the image was uploaded
      uploadedAt: {
        type: Date,
      },
    },

    // ========== DISPATCHED ITEMS ==========
    // The actual tiles and quantities that were delivered
    dispatchedItems: [
      {
        // Reference to the tile
        tile: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Tile',
          required: true,
        },
        // Denormalized tile information (for performance)
        tileName: {
          type: String,
          required: true,
        },
        tileSize: {
          type: String,
        },
        // Number of boxes delivered
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
      },
    ],

    // ========== DISPATCH METADATA ==========
    // Invoice number from the physical delivery note
    invoiceNumber: {
      type: String,
      trim: true,
      index: true,
    },

    // When the delivery physically happened (from the note)
    deliveryDate: {
      type: Date,
      default: Date.now,
    },

    // Delivery address/location
    destination: {
      type: String,
      trim: true,
    },

    // Optional driver information
    driverName: {
      type: String,
      trim: true,
    },

    // Optional vehicle information
    vehicleNumber: {
      type: String,
      trim: true,
    },

    // Additional remarks or notes
    notes: {
      type: String,
      trim: true,
    },

    // ========== STATUS TRACKING ==========
    status: {
      type: String,
      enum: ['Pending', 'Verified', 'Completed', 'Disputed'],
      default: 'Pending',
      index: true,
    },

    // Status change history
    statusHistory: [
      {
        status: {
          type: String,
          enum: ['Pending', 'Verified', 'Completed', 'Disputed'],
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        remarks: {
          type: String,
        },
      },
    ],

    // ========== AUDIT TRAIL ==========
    // Who processed/created this dispatch
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // When it was processed
    processedAt: {
      type: Date,
      default: Date.now,
    },

    // Who verified this dispatch (optional)
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    // When it was verified
    verifiedAt: {
      type: Date,
    },

    // ========== SOFT DELETE ==========
    deleted: {
      type: Boolean,
      default: false,
      select: false, // Don't return by default in queries
    },

    deletedAt: {
      type: Date,
      select: false,
    },

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      select: false,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
    collection: 'dubaidispatchorders', // Explicit collection name
  }
);

// ========== INDEXES ==========
dubaiDispatchOrderSchema.index({ booking: 1, createdAt: -1 });
dubaiDispatchOrderSchema.index({ status: 1, createdAt: -1 });
dubaiDispatchOrderSchema.index({ companyName: 1 });
dubaiDispatchOrderSchema.index({ invoiceNumber: 1 });
dubaiDispatchOrderSchema.index({ deliveryDate: -1 });

// ========== PRE-FIND HOOKS ==========
// Automatically exclude soft-deleted records from all find queries
dubaiDispatchOrderSchema.pre(/^find/, function (next) {
  this.where({ deleted: { $ne: true } });
  next();
});

// ========== VIRTUALS ==========
// Calculate total boxes across all items
dubaiDispatchOrderSchema.virtual('totalBoxes').get(function () {
  return this.dispatchedItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
});

// Ensure virtuals are included when converting to JSON
dubaiDispatchOrderSchema.set('toJSON', { virtuals: true });
dubaiDispatchOrderSchema.set('toObject', { virtuals: true });

// ========== STATIC METHODS ==========

/**
 * Get a dispatch with all related data populated
 */
dubaiDispatchOrderSchema.statics.getWithDetails = async function (id) {
  return this.findById(id)
    .populate({
      path: 'booking',
      select: 'bookingId company tilesList status dispatchOrders',
      populate: [
        {
          path: 'company',
          select: 'companyName contactPerson contactNumber email address',
        },
        {
          path: 'tilesList.tile',
          select: 'name size surface finish stockDetails',
        },
        {
          path: 'dispatchOrders',
          select: 'dispatchNumber dispatchedItems status',
          populate: {
            path: 'dispatchedItems.tile',
            select: 'name size',
          },
        },
      ],
    })
    .populate({
      path: 'dispatchedItems.tile',
      select: 'name size surface finish stockDetails',
    })
    .populate('createdBy', 'username email role')
    .populate('verifiedBy', 'username email role')
    .populate('sourceImage.uploadedBy', 'username');
};

/**
 * Get all dispatches for a specific booking
 */
dubaiDispatchOrderSchema.statics.getByBooking = async function (bookingId) {
  return this.find({ booking: bookingId })
    .populate('dispatchedItems.tile', 'name size')
    .populate('createdBy', 'username')
    .sort({ createdAt: -1 });
};

/**
 * Soft delete a dispatch
 */
dubaiDispatchOrderSchema.statics.archive = async function (id, userId) {
  const dispatch = await this.findById(id);
  if (dispatch) {
    dispatch.deleted = true;
    dispatch.deletedAt = new Date();
    dispatch.deletedBy = userId;
    await dispatch.save();
  }
  return dispatch;
};

/**
 * Get statistics for dashboard
 */
dubaiDispatchOrderSchema.statics.getStats = async function (filters = {}) {
  const matchStage = { deleted: { $ne: true }, ...filters };

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalBoxes: {
          $sum: {
            $reduce: {
              input: '$dispatchedItems',
              initialValue: 0,
              in: { $add: ['$$value', '$$this.quantity'] },
            },
          },
        },
      },
    },
  ]);

  // Transform to more readable format
  const result = {
    total: 0,
    byStatus: {},
    totalBoxes: 0,
  };

  stats.forEach((stat) => {
    result.byStatus[stat._id] = {
      count: stat.count,
      boxes: stat.totalBoxes,
    };
    result.total += stat.count;
    result.totalBoxes += stat.totalBoxes;
  });

  return result;
};

// ========== INSTANCE METHODS ==========

/**
 * Add a status change to history
 */
dubaiDispatchOrderSchema.methods.changeStatus = function (newStatus, userId, remarks = '') {
  this.status = newStatus;
  this.statusHistory.push({
    status: newStatus,
    changedBy: userId,
    changedAt: new Date(),
    remarks,
  });

  if (newStatus === 'Verified' && !this.verifiedBy) {
    this.verifiedBy = userId;
    this.verifiedAt = new Date();
  }

  return this.save();
};

const DubaiDispatchOrder = mongoose.model('DubaiDispatchOrder', dubaiDispatchOrderSchema);

export default DubaiDispatchOrder;