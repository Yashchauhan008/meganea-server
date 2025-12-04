// backend/src/controllers/userController.js

import User from '../models/userModel.js';
import asyncHandler from '../utils/asyncHandler.js';
import Company from '../models/companyModel.js';
import logger from '../config/logger.js';
import generateToken from '../utils/generateToken.js'; // --- THIS IMPORT IS ADDED ---

// ===================================================================================
// THIS IS THE MISSING FUNCTION THAT IS BEING ADDED
// ===================================================================================
/**
 * @desc    Authenticate user & get token
 * @route   POST /api/users/login
 * @access  Public
 */
export const loginUser = asyncHandler(async (req, res) => {
    // Your login form sends 'username', but your User model uses 'email' for login.
    // We find the user by their email, which is passed in the 'username' field from the form.
    const { username, password } = req.body;

    if (!username || !password) {
        res.status(400);
        throw new Error('Please provide an email and password');
    }

    const user = await User.findOne({ email: username });

    // Check if user exists and password is correct
    if (user && (await user.matchPassword(password))) {
        // Check if the user's account is active
        if (!user.isActive) {
            res.status(403); // 403 Forbidden
            throw new Error('Your account is deactivated. Please contact an administrator.');
        }

        // If everything is correct, send back the token and user object
        // This response format EXACTLY matches what your AuthContext expects.
        res.json({
            token: generateToken(user._id),
            user: {
                _id: user._id,
                name: user.username, // Your frontend uses 'name', so we map 'username' to 'name'
                username: user.username,
                email: user.email,
                role: user.role,
                location: user.location,
            },
        });
    } else {
        res.status(401); // 401 Unauthorized
        throw new Error('Invalid email or password');
    }
});
// ===================================================================================
// ALL OF YOUR EXISTING CODE BELOW REMAINS UNCHANGED
// ===================================================================================

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
  const { search } = req.query;
  const query = { role: 'salesman' };
  if (search) {
    query.username = new RegExp(search, 'i');
  }
  const salesmen = await User.find(query).select('-password').sort({ username: 1 });
  res.status(200).json(salesmen);
});

// @desc    Create a new salesman
// @route   POST /api/users/salesmen
// @access  Private/Admin
export const createSalesman = asyncHandler(async (req, res) => {
  const { username, email, password, contactNumber, location } = req.body;
  const emailExists = await User.findOne({ email: email.trim() });
  if (emailExists) {
    res.status(400);
    throw new Error(`A user with the email '${email}' already exists.`);
  }
  const usernameExists = await User.findOne({ username: username.trim() });
  if (usernameExists) {
    res.status(400);
    throw new Error(`A user with the username '${username}' already exists.`);
  }
  const user = await User.create({
    username: username.trim(),
    email: email.trim(),
    password,
    contactNumber,
    location,
    role: 'salesman',
  });
  logger.info(`Salesman "${user.username}" created by admin ${req.user.username}`);
  const userResponse = { ...user.toObject() };
  delete userResponse.password;
  res.status(201).json(userResponse);
});

// @desc    Update a salesman
// @route   PUT /api/users/salesmen/:id
// @access  Private/Admin
export const updateSalesman = asyncHandler(async (req, res) => {
  const { username, email, contactNumber, isActive } = req.body;
  const { id } = req.params;
  const user = await User.findById(id);
  if (!user) {
    res.status(404);
    throw new Error('Salesman not found');
  }
  if (email && email.trim() !== user.email) {
    const emailExists = await User.findOne({ email: email.trim(), _id: { $ne: id } });
    if (emailExists) {
      res.status(400);
      throw new Error(`A user with the email '${email}' already exists.`);
    }
  }
  if (username && username.trim() !== user.username) {
    const usernameExists = await User.findOne({ username: username.trim(), _id: { $ne: id } });
    if (usernameExists) {
      res.status(400);
      throw new Error(`A user with the username '${username}' already exists.`);
    }
  }
  user.username = username?.trim() ?? user.username;
  user.email = email?.trim() ?? user.email;
  user.contactNumber = contactNumber ?? user.contactNumber;
  user.isActive = isActive ?? user.isActive;
  if (req.body.password) {
    user.password = req.body.password;
  }
  const updatedUser = await user.save();
  logger.info(`Salesman "${updatedUser.username}" updated by admin ${req.user.username}`);
  const userResponse = { ...updatedUser.toObject() };
  delete userResponse.password;
  res.status(200).json(userResponse);
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

/**
 * @desc    Get all companies for a specific salesman
 * @route   GET /api/users/salesman/:id/companies
 * @access  Private/Admin, Private/Dubai-Staff
 */
export const getSalesmanCompanies = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const salesman = await User.findById(id);
  if (!salesman || salesman.role !== 'salesman') {
    res.status(404);
    throw new Error('Salesman not found');
  }
  const companies = await Company.find({ salesman: id })
    .select('companyName contactPerson contactNumber')
    .sort({ companyName: 1 });
  res.status(200).json(companies || []);
});
