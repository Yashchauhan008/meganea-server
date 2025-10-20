import mongoose from 'mongoose';

const partySchema = new mongoose.Schema({
  partyId: { type: String, required: true, unique: true, trim: true },
  partyName: { type: String, required: true },
  contactPerson: { type: String },
  contactNumber: { type: String, required: true },
  email: { type: String, lowercase: true, trim: true },
  address: { type: String },
  salesman: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
}, { timestamps: true });

const Party = mongoose.model('Party', partySchema);
export default Party;
