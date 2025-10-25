// import Party from '../models/partyModel.js';
// import User from '../models/userModel.js';
// import asyncHandler from '../utils/asyncHandler.js';
// import { generateId } from '../services/idGenerator.js';
// import logger from '../config/logger.js';

// // --- CREATE ---
// export const createParty = asyncHandler(async (req, res) => {
//   const { partyName, contactPerson, contactNumber, email, address, salesman } = req.body;
//   const salesmanUser = await User.findById(salesman);
//   if (!salesmanUser || salesmanUser.role !== 'salesman') {
//     res.status(400);
//     throw new Error('Invalid salesman ID or user is not a salesman');
//   }
//   const partyId = await generateId('PT');
//   const party = await Party.create({ partyId, partyName, contactPerson, contactNumber, email, address, salesman });
//   logger.info(`Party "${party.partyName}" created and assigned to ${salesmanUser.username}`);
//   res.status(201).json(party);
// });

// // --- READ (ALL) ---
// export const getAllParties = asyncHandler(async (req, res) => {
//   const { search, salesman } = req.query;
//   let query = {};

//   // If the logged-in user is a salesman, they can only see their own parties, regardless of filter.
//   if (req.user.role === 'salesman') {
//     query.salesman = req.user._id;
//   } else if (salesman) { // Admins/Staff can filter by any salesman
//     query.salesman = salesman;
//   }
  
//   if (search) {
//     query.partyName = new RegExp(search, 'i');
//   }

//   const parties = await Party.find(query).populate('salesman', 'username email').sort({ partyName: 1 });
//   res.status(200).json(parties);
// });

// // --- READ (ONE) ---
// export const getPartyById = asyncHandler(async (req, res) => {
//   const party = await Party.findById(req.params.id).populate('salesman', 'username email');
//   if (!party) {
//     res.status(404);
//     throw new Error('Party not found');
//   }
//   if (req.user.role === 'salesman' && party.salesman._id.toString() !== req.user._id.toString()) {
//     res.status(403);
//     throw new Error('User not authorized to view this party');
//   }
//   res.status(200).json(party);
// });

// // --- UPDATE ---
// export const updateParty = asyncHandler(async (req, res) => {
//   const party = await Party.findById(req.params.id);
//   if (!party) {
//     res.status(404);
//     throw new Error('Party not found');
//   }
//   if (req.user.role === 'salesman' && party.salesman.toString() !== req.user._id.toString()) {
//     res.status(403);
//     throw new Error('User not authorized to update this party');
//   }
//   const updatedParty = await Party.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
//   logger.info(`Party "${updatedParty.partyName}" updated by ${req.user.username}`);
//   res.status(200).json(updatedParty);
// });

// // --- SOFT DELETE ---
// export const deleteParty = asyncHandler(async (req, res) => {
//   const party = await Party.findById(req.params.id);
//   if (!party) {
//     res.status(404);
//     throw new Error('Party not found');
//   }
//   party.deleted = true;
//   await party.save();
//   logger.info(`Party "${party.partyName}" archived by ${req.user.username}`);
//   res.status(200).json({ message: 'Party archived successfully' });
// });


import Party from '../models/partyModel.js';
import User from '../models/userModel.js';
import asyncHandler from '../utils/asyncHandler.js';
import { generateId } from '../services/idGenerator.js';
import logger from '../config/logger.js';

// --- CREATE ---
export const createParty = asyncHandler(async (req, res) => {
  const { partyName, contactPerson, contactNumber, email, address, salesman } = req.body;
  
  // Validate salesman
  const salesmanUser = await User.findById(salesman);
  if (!salesmanUser || salesmanUser.role !== 'salesman') {
    res.status(400);
    throw new Error('Invalid salesman ID or user is not a salesman');
  }
  
  // Check for duplicate party name (among non-deleted parties)
  const existingParty = await Party.findOne({ partyName: partyName.trim() });
  if (existingParty) {
    res.status(400);
    throw new Error(`A party with the name '${partyName}' already exists.`);
  }
  
  const partyId = await generateId('PT');
  const party = await Party.create({ 
    partyId, 
    partyName: partyName.trim(), 
    contactPerson, 
    contactNumber, 
    email, 
    address, 
    salesman 
  });
  
  logger.info(`Party "${party.partyName}" created and assigned to ${salesmanUser.username}`);
  res.status(201).json(party);
});

// --- READ (ALL) ---
export const getAllParties = asyncHandler(async (req, res) => {
  const { search, salesman } = req.query;
  let query = {};
  
  if (req.user.role === 'salesman') {
    query.salesman = req.user._id;
  } else if (salesman) {
    query.salesman = salesman;
  }
  
  if (search) {
    query.partyName = new RegExp(search, 'i');
  }
  
  const parties = await Party.find(query)
    .populate('salesman', 'username email')
    .sort({ partyName: 1 });
  res.status(200).json(parties);
});

// --- READ (ONE) ---
export const getPartyById = asyncHandler(async (req, res) => {
  const party = await Party.findById(req.params.id).populate('salesman', 'username');
  
  if (!party) {
    res.status(404);
    throw new Error('Party not found');
  }

  // Authorization check
  if (req.user.role === 'salesman' && party.salesman._id.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('User not authorized to view this party');
  }

  res.status(200).json(party);
});

// --- UPDATE ---
export const updateParty = asyncHandler(async (req, res) => {
  const { partyName, contactPerson, contactNumber, email, address, salesman } = req.body;
  
  const party = await Party.findById(req.params.id);
  if (!party) {
    res.status(404);
    throw new Error('Party not found');
  }
  
  // Check for duplicate party name (if name is being changed)
  if (partyName && partyName.trim() !== party.partyName) {
    const existingParty = await Party.findOne({ 
      partyName: partyName.trim(), 
      _id: { $ne: req.params.id } 
    });
    if (existingParty) {
      res.status(400);
      throw new Error(`A party with the name '${partyName}' already exists.`);
    }
  }
  
  // Authorization check
  if (req.user.role === 'salesman' && party.salesman.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('User not authorized to update this party');
  }
  
  // Update fields
  party.partyName = partyName?.trim() ?? party.partyName;
  party.contactPerson = contactPerson ?? party.contactPerson;
  party.contactNumber = contactNumber ?? party.contactNumber;
  party.email = email ?? party.email;
  party.address = address ?? party.address;
  party.salesman = salesman ?? party.salesman;
  
  const updatedParty = await party.save();
  logger.info(`Party "${updatedParty.partyName}" updated by ${req.user.username}`);
  res.status(200).json(updatedParty);
});

// --- SOFT DELETE ---
export const deleteParty = asyncHandler(async (req, res) => {
  const party = await Party.findById(req.params.id);
  if (!party) {
    res.status(404);
    throw new Error('Party not found');
  }
  
  party.deleted = true;
  await party.save();
  logger.info(`Party "${party.partyName}" archived by ${req.user.username}`);
  res.status(200).json({ message: 'Party archived successfully' });
});