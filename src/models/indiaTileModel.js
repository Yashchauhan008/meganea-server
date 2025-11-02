import mongoose from 'mongoose';

const indiaTileSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: [true, 'Tile name is required.'],
        trim: true 
    },
    number: { 
        type: String, 
        unique: true, 
        sparse: true,
        trim: true 
    },
    size: { 
        type: String,
        required: true // Size is important for conversion, so let's make it required
    },
    surface: { 
        type: String,
        trim: true 
    },
    // ADDED: The conversion factor is crucial for business logic
    conversionFactor: { 
        type: Number, 
        required: true, 
        default: 1 
    },
    // The publicId from Cloudinary is needed to manage the image
    publicId: {
        type: String
    },
    image: { 
        type: String,
        trim: true 
    },
    manufacturingFactories: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Factory' 
    }],
    deleted: { 
        type: Boolean, 
        default: false, 
        select: false
    },
}, { 
    timestamps: true 
});

indiaTileSchema.pre(/^find/, function(next) {
  this.where({ deleted: { $ne: true } });
  next();
});

const IndiaTile = mongoose.model('IndiaTile', indiaTileSchema);

export default IndiaTile;
