// import mongoose from 'mongoose';

// const companySchema = new mongoose.Schema({
//     companyId: { type: String, required: true, unique: true, trim: true },
//     companyName: { type: String, required: true }, // Required
//     contactPerson: { type: String }, // Optional
//     contactNumber: { type: String }, // Optional
//     email: { type: String, lowercase: true, trim: true }, // Optional
//     address: { type: String }, // Optional
//     salesman: { // Required
//       type: mongoose.Schema.Types.ObjectId,
//       required: true,
//       ref: 'User',
//     },
//     deleted: { type: Boolean, default: false, select: false },
//   }, { timestamps: true });
  

// // Exclude soft-deleted documents from all find queries
// companySchema.pre(/^find/, function (next) {
//   this.where({ deleted: { $ne: true } });
//   next();
// });

// // Static method to soft delete a company
// companySchema.statics.archive = async function (id) {
//   const company = await this.findById(id);
//   if (company) {
//     company.deleted = true;
//     await company.save();
//   }
//   return company;
// };

// const Company = mongoose.model('Company', companySchema);
// export default Company;


import mongoose from 'mongoose';

const companySchema = new mongoose.Schema({
  companyId: { type: String, required: true, unique: true, trim: true },
  companyName: { 
    type: String, 
    required: true,
    unique: true // This creates the unique index.
  },
  contactPerson: { type: String },
  contactNumber: { type: String, required: true },
  email: { type: String, lowercase: true, trim: true },
  address: { type: String },
  salesman: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  deleted: { type: Boolean, default: false, select: false },
}, { timestamps: true });

// Middleware to exclude soft-deleted documents from normal queries
companySchema.pre('find', function() {
  this.where({ deleted: { $ne: true } });
});
companySchema.pre('findOne', function() {
  this.where({ deleted: { $ne: true } });
});

const Company = mongoose.model('Company', companySchema);
export default Company;
