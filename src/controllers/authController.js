// import User from '../models/userModel.js';
// import asyncHandler from '../utils/asyncHandler.js';
// import jwt from 'jsonwebtoken';

// // Generate JWT
// const generateToken = (id) => {
//   // --- FIX IMPLEMENTED HERE ---

//   // 1. Use the JWT_SECRET from the .env file, or fall back to a default secret for development.
//   const jwtSecret = process.env.JWT_SECRET || 'a-default-secret-for-dev-environment';

//   // 2. Use the JWT_EXPIRES_IN from the .env file, or fall back to a default of '30d' (30 days).
//   const expiresIn = process.env.JWT_EXPIRES_IN || '30d';

//   // 3. Check if a secret is available. If not, the app cannot run securely.
//   if (jwtSecret === 'a-default-secret-for-dev-environment' && process.env.NODE_ENV === 'production') {
//       console.error('FATAL ERROR: JWT_SECRET is not defined in a production environment.');
//       process.exit(1); // Exit the process with an error code
//   }

//   return jwt.sign({ id }, jwtSecret, {
//     expiresIn: expiresIn,
//   });
// };

// // @desc    Register a new user (for setup, should be admin-only)
// // @route   POST /api/auth/register
// // @access  Public (for now, should be Private/Admin)
// export const registerUser = asyncHandler(async (req, res) => {
//   const { username, email, password, role, location } = req.body;

//   const userExists = await User.findOne({ email });

//   if (userExists) {
//     res.status(400);
//     throw new Error('User already exists');
//   }

//   const user = await User.create({
//     username,
//     email,
//     password,
//     role,
//     location,
//   });

//   if (user) {
//     // Correctly structure the response to match the frontend's expectation
//     res.status(201).json({
//       user: {
//         _id: user._id,
//         username: user.username,
//         email: user.email,
//         role: user.role,
//       },
//       token: generateToken(user._id),
//     });
//   } else {
//     res.status(400);
//     throw new Error('Invalid user data');
//   }
// });

// // @desc    Authenticate user & get token
// // @route   POST /api/auth/login
// // @access  Public
// export const loginUser = asyncHandler(async (req, res) => {
//   const { email, password } = req.body;

//   if (!email || !password) {
//     res.status(400);
//     throw new Error('Please provide email and password');
//   }

//   const user = await User.findOne({ email }).select('+password');

//   if (user && (await user.matchPassword(password))) {
//     // Update last login
//     user.lastLogin = Date.now();
//     await user.save();

//     // Correctly structure the response to match the frontend's expectation
//     res.json({
//       user: {
//         _id: user._id,
//         username: user.username,
//         email: user.email,
//         role: user.role,
//       },
//       token: generateToken(user._id),
//     });
//   } else {
//     res.status(401);
//     throw new Error('Invalid email or password');
//   }
// });

// // @desc    Get current user profile
// // @route   GET /api/auth/me
// // @access  Private
// export const getMe = asyncHandler(async (req, res) => {
//   // req.user is attached by the 'protect' middleware
//   res.status(200).json(req.user);
// });

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
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error('Please provide email and password');
  }

  const user = await User.findOne({ email }).select('+password');

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
    throw new Error('Invalid email or password');
  }
});

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
export const getMe = asyncHandler(async (req, res) => {
  // req.user is already selected without the password in the middleware
  res.status(200).json(req.user);
});
