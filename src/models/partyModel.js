// import mongoose from 'mongoose';

// const partySchema = new mongoose.Schema({
//   partyId: { type: String, required: true, unique: true, trim: true },
//   partyName: { type: String, required: true },
//   contactPerson: { type: String },
//   contactNumber: { type: String, required: true },
//   email: { type: String, lowercase: true, trim: true },
//   address: { type: String },
//   salesman: {
//     type: mongoose.Schema.Types.ObjectId,
//     required: true,
//     ref: 'User',
//   },
// }, { timestamps: true });

// const Party = mongoose.model('Party', partySchema);
// export default Party;

import mongoose from 'mongoose';

const partySchema = new mongoose.Schema({
    partyId: { type: String, required: true, unique: true, trim: true },
    partyName: { type: String, required: true }, // Required
    contactPerson: { type: String }, // Optional
    contactNumber: { type: String }, // Optional
    email: { type: String, lowercase: true, trim: true }, // Optional
    address: { type: String }, // Optional
    salesman: { // Required
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    deleted: { type: Boolean, default: false, select: false },
  }, { timestamps: true });
  

// Exclude soft-deleted documents from all find queries
partySchema.pre(/^find/, function (next) {
  this.where({ deleted: { $ne: true } });
  next();
});

// Static method to soft delete a party
partySchema.statics.archive = async function (id) {
  const party = await this.findById(id);
  if (party) {
    party.deleted = true;
    await party.save();
  }
  return party;
};

const Party = mongoose.model('Party', partySchema);
export default Party;
