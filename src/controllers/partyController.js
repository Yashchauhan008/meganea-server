import Party from '../models/partyModel.js';
import User from '../models/userModel.js';
import asyncHandler from '../utils/asyncHandler.js';
import { generateId } from '../services/idGenerator.js';

// @desc    Create a new party
// @route   POST /api/parties
// @access  Private/Admin, Private/Dubai-Staff, Private/Salesman
export const createParty = asyncHandler(async (req, res) => {
  const { partyName, contactPerson, contactNumber, email, address, salesman } = req.body;

  // A user can assign themselves if they are a salesman, or an admin/staff can assign any salesman
  const salesmanToAssign = req.user.role === 'salesman' ? req.user._id : salesman;

  if (!salesmanToAssign) {
    res.status(400);
    throw new Error('A salesman must be assigned to the party.');
  }

  const salesmanUser = await User.findById(salesmanToAssign);
  if (!salesmanUser || salesmanUser.role !== 'salesman') {
    res.status(400);
    throw new Error('Invalid salesman ID or the assigned user is not a salesman.');
  }

  const partyId = await generateId('PT');

  const party = await Party.create({
    partyId,
    partyName,
    contactPerson,
    contactNumber,
    email,
    address,
    salesman: salesmanToAssign,
  });

  res.status(201).json(party);
});

// @desc    Get all parties
// @route   GET /api/parties
// @access  Private/Admin, Private/Dubai-Staff, Private/Salesman
export const getAllParties = asyncHandler(async (req, res) => {
  let query = {};
  // If the user is a salesman, only show their parties
  if (req.user.role === 'salesman') {
    query.salesman = req.user._id;
  }
  const parties = await Party.find(query).populate('salesman', 'username email');
  res.status(200).json(parties);
});

// @desc    Get a single party by ID
// @route   GET /api/parties/:id
// @access  Private
export const getPartyById = asyncHandler(async (req, res) => {
  const party = await Party.findById(req.params.id).populate('salesman', 'username email');

  if (!party) {
    res.status(404);
    throw new Error('Party not found');
  }

  // A salesman can only access their own party
  if (req.user.role === 'salesman' && party.salesman._id.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('User not authorized to view this party');
  }

  res.status(200).json(party);
});

// @desc    Update a party
// @route   PUT /api/parties/:id
// @access  Private
export const updateParty = asyncHandler(async (req, res) => {
  const party = await Party.findById(req.params.id);

  if (!party) {
    res.status(404);
    throw new Error('Party not found');
  }

  // A salesman can only update their own party
  if (req.user.role === 'salesman' && party.salesman.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('User not authorized to update this party');
  }

  const updatedParty = await Party.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json(updatedParty);
});

// @desc    Delete a party (soft delete)
// @route   DELETE /api/parties/:id
// @access  Private/Admin
export const deleteParty = asyncHandler(async (req, res) => {
  const party = await Party.archive(req.params.id);

  if (!party) {
    res.status(404);
    throw new Error('Party not found');
  }

  res.status(200).json({ message: 'Party archived successfully' });
});

// @desc    Get all salesmen to populate dropdown
// @route   GET /api/users/salesmen
// @access  Private
export const getSalesmen = asyncHandler(async (req, res) => {
    const salesmen = await User.find({ role: 'salesman', isActive: true });
    res.status(200).json(salesmen);
});
