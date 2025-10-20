import User from '../models/userModel.js';
import asyncHandler from '../utils/asyncHandler.js';

// @desc    Create a new user
// @route   POST /api/users
// @access  Private/Admin
export const createUser = asyncHandler(async (req, res) => {
  const { username, email, password, role, location, isActive } = req.body;

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error('User with this email already exists');
  }

  const user = await User.create({
    username,
    email,
    password,
    role,
    location,
    isActive,
  });

  res.status(201).json(user);
});

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
export const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find({});
  res.status(200).json(users);
});

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private/Admin
export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  res.status(200).json(user);
});

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/Admin
export const updateUser = asyncHandler(async (req, res) => {
  const { username, email, role, location, isActive } = req.body;

  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  user.username = username || user.username;
  user.email = email || user.email;
  user.role = role || user.role;
  user.location = location || user.location;
  user.isActive = isActive !== undefined ? isActive : user.isActive;

  // If password is provided, it will be hashed by the pre-save hook
  if (req.body.password) {
    user.password = req.body.password;
  }

  const updatedUser = await user.save();
  res.status(200).json(updatedUser);
});

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Add logic here to re-assign parties if the user is a salesman
  if (user.role === 'salesman') {
    // Example: await Party.updateMany({ salesman: user._id }, { $set: { salesman: null } });
    // This is a critical business logic step you must define.
  }

  await user.deleteOne();

  res.status(200).json({ message: 'User removed successfully' });
});
