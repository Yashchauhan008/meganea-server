
// import mongoose from 'mongoose';
// import bcrypt from 'bcryptjs';

// const userSchema = new mongoose.Schema({
//   username: { type: String, required: true, unique: true, trim: true },
//   email: { type: String, required: true, unique: true, lowercase: true, trim: true },
//   // ADDED: contactNumber field
//   contactNumber: { type: String, required: true, trim: true },
//   password: { type: String, required: true, select: false },
//   role: {
//     type: String,
//     required: true,
//     enum: ['admin', 'dubai-staff', 'india-staff', 'salesman', 'labor'],
//   },
//   location: { type: String, enum: ['Dubai', 'India'] },
//   isActive: { type: Boolean, default: true },
//   lastLogin: { type: Date },
// }, { timestamps: true });

// userSchema.pre('save', async function (next) {
//   if (!this.isModified('password')) return next();
//   const salt = await bcrypt.genSalt(10);
//   this.password = await bcrypt.hash(this.password, salt);
//   next();
// });

// userSchema.methods.matchPassword = async function (enteredPassword) {
//   return await bcrypt.compare(enteredPassword, this.password);
// };

// const User = mongoose.model('User', userSchema);
// export default User;

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  contactNumber: { type: String, required: true, trim: true },
  password: { type: String, required: true, select: false },
  role: {
    type: String,
    required: true,
    enum: ['admin', 'dubai-staff', 'india-staff', 'salesman', 'labor'],
  },
  location: { type: String, enum: ['Dubai', 'India'] },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
  // ADDED: Soft delete field
  deleted: { type: Boolean, default: false, select: false },
}, { timestamps: true });

// --- MIDDLEWARE & METHODS ---

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Exclude soft-deleted documents from all find queries
userSchema.pre(/^find/, function (next) {
  // 'this' refers to the query
  this.where({ deleted: { $ne: true } });
  next();
});

// Method to compare passwords
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Static method to soft delete a user
userSchema.statics.archive = async function (id) {
  const user = await this.findById(id);
  if (user) {
    user.deleted = true;
    await user.save();
  }
  return user;
};


const User = mongoose.model('User', userSchema);
export default User;
