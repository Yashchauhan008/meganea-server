// // backend/src/models/containerModel.js

// import mongoose from 'mongoose';
// import { generateId } from '../services/idGenerator.js';

// const containerSchema = new mongoose.Schema(
//     {
//         containerId: {
//             type: String,
//             required: true,
//             unique: true,
//         },
//         containerNumber: {
//             type: String,
//             required: [true, 'Container number is required.'],
//             trim: true,
//             uppercase: true,
//         },
//         truckNumber: {
//             type: String,
//             required: [true, 'Truck number is required.'],
//             trim: true,
//             uppercase: true,
//         },
//         // This is now optional, as containers can be created independently.
//         loadingPlan: {
//             type: mongoose.Schema.Types.ObjectId,
//             ref: 'LoadingPlan',
//         },
//         // We add a direct reference to the primary loading factory.
//         factory: {
//             type: mongoose.Schema.Types.ObjectId,
//             ref: 'Factory',
//         },
//         pallets: [
//             {
//                 type: mongoose.Schema.Types.ObjectId,
//                 ref: 'Pallet',
//             },
//         ],
//         status: {
//             type: String,
//             enum: ['Empty', 'Loading', 'Loaded', 'Dispatched', 'In Transit', 'Delivered'],
//             default: 'Empty',
//         },
//         // We add a createdBy field
//         createdBy: {
//             type: mongoose.Schema.Types.ObjectId,
//             ref: 'User',
//             required: true,
//         },
//     },
//     {
//         timestamps: true,
//     }
// );

// // The pre-save hook for ID generation remains.
// containerSchema.pre('save', async function (next) {
//     if (this.isNew && !this.containerId) {
//         this.containerId = await generateId('CN');
//     }
//     next();
// });

// const Container = mongoose.model('Container', containerSchema);

// export default Container;



import mongoose from 'mongoose';
import { generateId } from '../services/idGenerator.js';

const containerSchema = new mongoose.Schema(
  {
    containerId: {
      type: String,
      required: true,
      unique: true,
    },
    containerNumber: {
      type: String,
      required: [true, 'Container number is required.'],
      trim: true,
      uppercase: true,
    },
    truckNumber: {
      type: String,
      required: [true, 'Truck number is required.'],
      trim: true,
      uppercase: true,
    },
    // Reference to loading plan (optional)
    loadingPlan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LoadingPlan',
    },
    // Factory where container is loaded
    factory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Factory',
    },
    // Pallets in this container
    pallets: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Pallet',
      },
    ],
    // Khatlis in this container
    khatlis: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Khatli',
      },
    ],

    // NEW: Dispatch order reference
    dispatchOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DispatchOrder',
      default: null,
    },

    // NEW: When was this container dispatched
    dispatchedAt: {
      type: Date,
      default: null,
    },

    // NEW: Quantity of items dispatched
    dispatchedQuantity: {
      pallets: {
        type: Number,
        default: 0,
      },
      khatlis: {
        type: Number,
        default: 0,
      },
      boxes: {
        type: Number,
        default: 0,
      },
    },

    // Container status
    status: {
      type: String,
      enum: ['Empty', 'Loading', 'Loaded', 'Ready to Dispatch', 'Dispatched', 'In Transit', 'Delivered'],
      default: 'Empty',
    },

    // Who created this container
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
  },
  {
    timestamps: true,
  }
);

// Pre-save hook for ID generation
containerSchema.pre('save', async function (next) {
  if (this.isNew && !this.containerId) {
    this.containerId = await generateId('CN');
  }
  next();
});

// Pre-find hook for soft delete
containerSchema.pre(/^find/, function (next) {
  this.where({ deleted: { $ne: true } });
  next();
});

// Static method to get available containers for dispatch
containerSchema.statics.getAvailableForDispatch = async function () {
  return this.find({
    status: { $in: ['Loaded', 'Ready to Dispatch'] },
    dispatchOrder: null,
    deleted: { $ne: true },
  })
    .populate('factory', 'name address')
    .populate({
      path: 'pallets',
      select: 'palletId tile boxCount type',
      populate: {
        path: 'tile',
        select: 'name size surface',
      },
    })
    .populate({
      path: 'khatlis',
      select: 'palletId tile boxCount type',
      populate: {
        path: 'tile',
        select: 'name size surface',
      },
    })
    .sort({ createdAt: -1 });
};

// Instance method to calculate total items and boxes
containerSchema.methods.calculateTotals = function () {
  const totalPallets = this.pallets ? this.pallets.length : 0;
  const totalKhatlis = this.khatlis ? this.khatlis.length : 0;
  
  return {
    totalItems: totalPallets + totalKhatlis,
    totalPallets,
    totalKhatlis,
  };
};

// Instance method to mark as ready for dispatch
containerSchema.methods.markReadyForDispatch = async function () {
  this.status = 'Ready to Dispatch';
  return this.save();
};

// Instance method to mark as dispatched
containerSchema.methods.markDispatched = async function (dispatchOrderId, dispatchedQuantity) {
  this.status = 'Dispatched';
  this.dispatchOrder = dispatchOrderId;
  this.dispatchedAt = new Date();
  this.dispatchedQuantity = dispatchedQuantity;
  return this.save();
};

// Instance method to revert dispatch (for edit/delete)
containerSchema.methods.revertDispatch = async function () {
  this.status = 'Loaded';
  this.dispatchOrder = null;
  this.dispatchedAt = null;
  this.dispatchedQuantity = {
    pallets: 0,
    khatlis: 0,
    boxes: 0,
  };
  return this.save();
};

// Instance method to update status
containerSchema.methods.updateStatus = async function (newStatus) {
  this.status = newStatus;
  return this.save();
};

const Container = mongoose.model('Container', containerSchema);

export default Container;
