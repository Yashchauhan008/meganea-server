import User from '../models/userModel.js';
import asyncHandler from '../utils/asyncHandler.js';

// @desc    Create a new user
// @route   POST /api/users
// @access  Private/Admin
export const createUser = asyncHandler(async (req, res) => {
  // ... function content remains the same
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
  // ... function content remains the same
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

  if (req.body.password) {
    user.password = req.body.password;
  }

  const updatedUser = await user.save();
  res.status(200).json(updatedUser);
});

// @desc    Delete user (soft delete)
// @route   DELETE /api/users/:id
// @access  Private/Admin
export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.archive(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  
  res.status(200).json({ message: 'User archived successfully' });
});

// @desc    Get all salesmen
// @route   GET /api/users/salesmen
// @access  Private (Admin, Dubai-Staff)
export const getAllSalesmen = asyncHandler(async (req, res) => {
    const salesmen = await User.find({ role: 'salesman' });
    res.status(200).json(salesmen);
});

// @desc    Create a new salesman
// @route   POST /api/users/salesmen
// @access  Private/Admin
export const createSalesman = asyncHandler(async (req, res) => {
    const { username, email, password, location, contactNumber } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
        res.status(400);
        throw new Error('User with this email already exists');
    }

    const salesman = await User.create({
        username,
        email,
        password,
        contactNumber,
        location,
        role: 'salesman', // Role is fixed
        isActive: true,
    });

    res.status(201).json(salesman);
});

// @desc    Update a salesman
// @route   PUT /api/users/salesmen/:id
// @access  Private/Admin
export const updateSalesman = asyncHandler(async (req, res) => {
    const { username, email, location, contactNumber, isActive } = req.body;
    const user = await User.findById(req.params.id);

    if (!user || user.role !== 'salesman') {
        res.status(404);
        throw new Error('Salesman not found');
    }

    user.username = username || user.username;
    user.email = email || user.email;
    user.location = location || user.location;
    user.contactNumber = contactNumber || user.contactNumber;
    user.isActive = isActive !== undefined ? isActive : user.isActive;

    if (req.body.password) {
        user.password = req.body.password;
    }

    const updatedUser = await user.save();
    res.status(200).json(updatedUser);
});

// @desc    Delete a salesman (soft delete)
// @route   DELETE /api/users/salesmen/:id
// @access  Private/Admin
export const deleteSalesman = asyncHandler(async (req, res) => {
    const user = await User.archive(req.params.id);

    if (!user || user.role !== 'salesman') {
        res.status(404);
        throw new Error('Salesman not found');
    }

    res.status(200).json({ message: 'Salesman archived successfully' });
});