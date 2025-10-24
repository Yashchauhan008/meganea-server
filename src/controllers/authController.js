
import User from '../models/userModel.js';
import asyncHandler from '../utils/asyncHandler.js';
import jwt from 'jsonwebtoken';

// Generate JWT
const generateToken = (id) => {
  const jwtSecret = process.env.JWT_SECRET || 'a-default-secret-for-dev-environment';
  const expiresIn = process.env.JWT_EXPIRES_IN || '30d';

  if (jwtSecret === 'a-default-secret-for-dev-environment' && process.env.NODE_ENV === 'production') {
      console.error('FATAL ERROR: JWT_SECRET is not defined in a production environment.');
      process.exit(1);
  }

  return jwt.sign({ id }, jwtSecret, {
    expiresIn: expiresIn,
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public (should be Admin-only in production)
export const registerUser = asyncHandler(async (req, res) => {
  // UPDATED: Added contactNumber to destructuring
  const { username, email, password, role, location, contactNumber } = req.body;

  // Basic validation for new field
  if (!contactNumber) {
    res.status(400);
    throw new Error('Please provide a contact number');
  }

  const userExists = await User.findOne({ email });

  if (userExists) {
    res.status(400);
    throw new Error('User already exists');
  }

  const user = await User.create({
    username,
    email,
    password,
    role,
    location,
    // UPDATED: Pass contactNumber to the model
    contactNumber,
  });

  if (user) {
    res.status(201).json({
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        location: user.location,
        contactNumber: user.contactNumber,
      },
      token: generateToken(user._id),
    });
  } else {
    res.status(400);
    throw new Error('Invalid user data');
  }
});

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
export const loginUser = asyncHandler(async (req, res) => {
    // UPDATED: Destructure username instead of email
    const { username, password } = req.body;
  
    // UPDATED: Validate for username
    if (!username || !password) {
      res.status(400);
      throw new Error('Please provide a username and password');
    }
  
    // UPDATED: Find user by `username` instead of `email`
    const user = await User.findOne({ username }).select('+password');
  
    if (user && (await user.matchPassword(password))) {
      user.lastLogin = Date.now();
      await user.save();
  
      res.json({
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          location: user.location,
          contactNumber: user.contactNumber,
        },
        token: generateToken(user._id),
      });
    } else {
      res.status(401);
      // UPDATED: Error message to be more generic and secure
      throw new Error('Invalid credentials');
    }
  });

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
export const getMe = asyncHandler(async (req, res) => {
  // req.user is already selected without the password in the middleware
  res.status(200).json(req.user);
});
