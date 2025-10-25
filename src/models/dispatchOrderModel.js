import mongoose from 'mongoose';

const dispatchOrderSchema = new mongoose.Schema({
  // The human-readable ID for this dispatch (e.g., DO-00001)
  dispatchNumber: { 
    type: String, 
    required: true, 
    unique: true 
  },
  
  // The parent booking this dispatch belongs to.
  booking: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Booking', 
    required: true 
  },
  
  // The invoice number from the physical delivery note.
  invoiceNumber: { 
    type: String, 
    trim: true 
  },

  // The image that was processed to create this dispatch order.
  sourceImage: {
    imageUrl: { type: String, required: true },
    publicId: { type: String, required: true },
    // Storing the original ID from the booking's array is excellent for cleanup.
    unprocessedImageId: { type: mongoose.Schema.Types.ObjectId, required: true }
  },

  // The list of items that were ACTUALLY dispatched in this specific delivery.
  dispatchedItems: [{
    tile: { type: mongoose.Schema.Types.ObjectId, ref: 'Tile', required: true },
    quantity: { type: Number, required: true, min: 1 },
  }],
  
  // The admin/staff user who created this dispatch record.
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  
  // The date of the physical dispatch. Defaults to when the record is created.
  dispatchedAt: { 
    type: Date, 
    default: Date.now 
  },

  // Soft delete field.
  deleted: { 
    type: Boolean, 
    default: false, 
    select: false 
  },
}, { timestamps: true });

// Pre-find hook for soft delete.
dispatchOrderSchema.pre(/^find/, function (next) {
  this.where({ deleted: { $ne: true } });
  next();
});

// Static archive method.
dispatchOrderSchema.statics.archive = async function (id) {
  const dispatchOrder = await this.findById(id);
  if (dispatchOrder) {
    dispatchOrder.deleted = true;
    await dispatchOrder.save();
  }
  return dispatchOrder;
};

const DispatchOrder = mongoose.model('DispatchOrder', dispatchOrderSchema);

export default DispatchOrder;
