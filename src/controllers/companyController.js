import Company from '../models/companyModel.js';
import User from '../models/userModel.js';
import asyncHandler from '../utils/asyncHandler.js';
import { generateId } from '../services/idGenerator.js';
import logger from '../config/logger.js';

// --- CREATE ---
export const createCompany = asyncHandler(async (req, res) => {
  const { companyName, contactPerson, contactNumber, email, address, salesman } = req.body;
  
  // Validate salesman
  const salesmanUser = await User.findById(salesman);
  if (!salesmanUser || salesmanUser.role !== 'salesman') {
    res.status(400);
    throw new Error('Invalid salesman ID or user is not a salesman');
  }
  
  // Check for duplicate company name (among non-deleted companies)
  const existingCompany = await Company.findOne({ companyName: companyName.trim() });
  if (existingCompany) {
    res.status(400);
    throw new Error(`A company with the name '${companyName}' already exists.`);
  }
  
  const companyId = await generateId('PT');
  const company = await Company.create({ 
    companyId, 
    companyName: companyName.trim(), 
    contactPerson, 
    contactNumber, 
    email, 
    address, 
    salesman 
  });
  
  logger.info(`Company "${company.companyName}" created and assigned to ${salesmanUser.username}`);
  res.status(201).json(company);
});

// --- READ (ALL) ---
export const getAllCompanies = asyncHandler(async (req, res) => {
  const { search, salesman } = req.query;
  let query = {};
  
  if (req.user.role === 'salesman') {
    query.salesman = req.user._id;
  } else if (salesman) {
    query.salesman = salesman;
  }
  
  if (search) {
    query.companyName = new RegExp(search, 'i');
  }
  
  const companies = await Company.find(query)
    .populate('salesman', 'username email')
    .sort({ companyName: 1 });
  res.status(200).json(companies);
});

// --- READ (ONE) ---
export const getCompanyById = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id).populate('salesman', 'username');
  
  if (!company) {
    res.status(404);
    throw new Error('Company not found');
  }

  // Authorization check
  if (req.user.role === 'salesman' && company.salesman._id.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('User not authorized to view this company');
  }

  res.status(200).json(company);
});

// --- UPDATE ---
export const updateCompany = asyncHandler(async (req, res) => {
  const { companyName, contactPerson, contactNumber, email, address, salesman } = req.body;
  
  const company = await Company.findById(req.params.id);
  if (!company) {
    res.status(404);
    throw new Error('Company not found');
  }
  
  // Check for duplicate company name (if name is being changed)
  if (companyName && companyName.trim() !== company.companyName) {
    const existingCompany = await Company.findOne({ 
      companyName: companyName.trim(), 
      _id: { $ne: req.params.id } 
    });
    if (existingCompany) {
      res.status(400);
      throw new Error(`A company with the name '${companyName}' already exists.`);
    }
  }
  
  // Authorization check
  if (req.user.role === 'salesman' && company.salesman.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('User not authorized to update this company');
  }
  
  // Update fields
  company.companyName = companyName?.trim() ?? company.companyName;
  company.contactPerson = contactPerson ?? company.contactPerson;
  company.contactNumber = contactNumber ?? company.contactNumber;
  company.email = email ?? company.email;
  company.address = address ?? company.address;
  company.salesman = salesman ?? company.salesman;
  
  const updatedCompany = await company.save();
  logger.info(`Company "${updatedCompany.companyName}" updated by ${req.user.username}`);
  res.status(200).json(updatedCompany);
});

// --- SOFT DELETE ---
export const deleteCompany = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id);
  if (!company) {
    res.status(404);
    throw new Error('Company not found');
  }
  
  company.deleted = true;
  await company.save();
  logger.info(`Company "${company.companyName}" archived by ${req.user.username}`);
  res.status(200).json({ message: 'Company archived successfully' });
});