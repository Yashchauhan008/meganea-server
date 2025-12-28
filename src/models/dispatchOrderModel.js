// import mongoose from 'mongoose';

// const dispatchOrderSchema = new mongoose.Schema({
//   // The human-readable ID for this dispatch (e.g., DO-00001)
//   dispatchNumber: { 
//     type: String, 
//     required: true, 
//     unique: true 
//   },
  
//   // The parent booking this dispatch belongs to.
//   booking: { 
//     type: mongoose.Schema.Types.ObjectId, 
//     ref: 'Booking', 
//     required: true 
//   },
  
//   // The invoice number from the physical delivery note.
//   invoiceNumber: { 
//     type: String, 
//     trim: true 
//   },

//   // The image that was processed to create this dispatch order.
//   sourceImage: {
//     imageUrl: { type: String, required: true },
//     publicId: { type: String, required: true },
//     // Storing the original ID from the booking's array is excellent for cleanup.
//     unprocessedImageId: { type: mongoose.Schema.Types.ObjectId, required: true }
//   },

//   // The list of items that were ACTUALLY dispatched in this specific delivery.
//   dispatchedItems: [{
//     tile: { type: mongoose.Schema.Types.ObjectId, ref: 'Tile', required: true },
//     quantity: { type: Number, required: true, min: 1 },
//   }],
  
//   // The admin/staff user who created this dispatch record.
//   createdBy: { 
//     type: mongoose.Schema.Types.ObjectId, 
//     ref: 'User', 
//     required: true 
//   },
  
//   // The date of the physical dispatch. Defaults to when the record is created.
//   dispatchedAt: { 
//     type: Date, 
//     default: Date.now 
//   },

//   // Soft delete field.
//   deleted: { 
//     type: Boolean, 
//     default: false, 
//     select: false 
//   },
// }, { timestamps: true });

// // Pre-find hook for soft delete.
// dispatchOrderSchema.pre(/^find/, function (next) {
//   this.where({ deleted: { $ne: true } });
//   next();
// });

// // Static archive method.
// dispatchOrderSchema.statics.archive = async function (id) {
//   const dispatchOrder = await this.findById(id);
//   if (dispatchOrder) {
//     dispatchOrder.deleted = true;
//     await dispatchOrder.save();
//   }
//   return dispatchOrder;
// };

// const DispatchOrder = mongoose.model('DispatchOrder', dispatchOrderSchema);

// export default DispatchOrder;


import mongoose from 'mongoose';

const dispatchOrderSchema = new mongoose.Schema(
  {
    // Unique dispatch identifier (e.g., DO-00001)
    dispatchNumber: {
      type: String,
      required: true,
      unique: true,
    },

    // Array of containers in this dispatch
    containers: [
      {
        containerId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Container',
          required: true,
        },
        containerNumber: String,
        truckNumber: String,
        factory: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Factory',
        },
        factoryName: String,
        
        // Items in this container
        items: [
          {
            itemId: mongoose.Schema.Types.ObjectId,
            itemType: {
              type: String,
              enum: ['Pallet', 'Khatli'],
            },
            tileId: mongoose.Schema.Types.ObjectId,
            tileName: String,
            boxCount: Number,
            quantity: Number,
          },
        ],
        
        itemCount: Number,
        totalBoxes: Number,
      },
    ],

    // Stock summary across all containers
    stockSummary: {
      totalPallets: {
        type: Number,
        default: 0,
      },
      totalKhatlis: {
        type: Number,
        default: 0,
      },
      totalBoxes: {
        type: Number,
        default: 0,
      },
      byFactory: {
        type: Map,
        of: {
          pallets: Number,
          khatlis: Number,
          boxes: Number,
        },
        default: new Map(),
      },
    },

    // Dispatch details
    invoiceNumber: {
      type: String,
      trim: true,
    },
    dispatchDate: {
      type: Date,
      default: Date.now,
    },
    destination: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },

    // Status tracking
    status: {
      type: String,
      enum: ['Pending', 'Ready', 'In Transit', 'Delivered', 'Completed', 'Cancelled'],
      default: 'Pending',
    },

    // Status history for audit trail
    statusHistory: [
      {
        status: String,
        changedAt: {
          type: Date,
          default: Date.now,
        },
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        notes: String,
      },
    ],

    // Audit fields
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Soft delete
    deleted: {
      type: Boolean,
      default: false,
      select: false,
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
    deletionReason: {
      type: String,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-find hook for soft delete
dispatchOrderSchema.pre(/^find/, function (next) {
  this.where({ deleted: { $ne: true } });
  next();
});

// Static method to get dispatch with all populated data
dispatchOrderSchema.statics.getWithDetails = async function (id) {
  return this.findById(id)
    .populate({
      path: 'containers.containerId',
      select: 'containerNumber truckNumber status',
    })
    .populate({
      path: 'containers.factory',
      select: 'name address',
    })
    .populate('createdBy', 'username email')
    .populate('statusHistory.changedBy', 'username');
};

// Instance method to calculate stock summary
dispatchOrderSchema.methods.calculateStockSummary = function () {
  let totalPallets = 0;
  let totalKhatlis = 0;
  let totalBoxes = 0;
  const byFactory = new Map();

  this.containers.forEach((container) => {
    let containerPallets = 0;
    let containerKhatlis = 0;
    let containerBoxes = 0;

    container.items.forEach((item) => {
      const itemBoxes = item.boxCount * item.quantity;
      containerBoxes += itemBoxes;
      totalBoxes += itemBoxes;

      if (item.itemType === 'Pallet') {
        containerPallets += item.quantity;
        totalPallets += item.quantity;
      } else if (item.itemType === 'Khatli') {
        containerKhatlis += item.quantity;
        totalKhatlis += item.quantity;
      }
    });

    // Handle null factory gracefully
    const factoryId = container.factory ? container.factory.toString() : 'unknown';
    if (!byFactory.has(factoryId)) {
      byFactory.set(factoryId, { pallets: 0, khatlis: 0, boxes: 0 });
    }
    const factoryData = byFactory.get(factoryId);
    factoryData.pallets += containerPallets;
    factoryData.khatlis += containerKhatlis;
    factoryData.boxes += containerBoxes;
  });

  this.stockSummary = {
    totalPallets,
    totalKhatlis,
    totalBoxes,
    byFactory,
  };

  return this.stockSummary;
};

// Instance method to add status change to history
dispatchOrderSchema.methods.addStatusChange = function (newStatus, userId, notes = '') {
  this.statusHistory.push({
    status: newStatus,
    changedAt: new Date(),
    changedBy: userId,
    notes,
  });
  this.status = newStatus;
};

const DispatchOrder = mongoose.model('DispatchOrder', dispatchOrderSchema);

export default DispatchOrder;