import mongoose from 'mongoose';
import Booking from '../models/bookingModel.js';
import DispatchOrder from '../models/dispatchOrderModel.js';
import Company from '../models/companyModel.js';
import RestockRequest from '../models/restockRequestModel.js';
import Tile from '../models/tileModel.js';

const generateId = async (prefix) => {
  let model;
  let modelName;
  let idFieldName;

  switch (prefix) {
    case 'BK': model = Booking; modelName = 'Booking'; idFieldName = 'bookingId'; break;
    case 'DO': model = DispatchOrder; modelName = 'DispatchOrder'; idFieldName = 'dispatchNumber'; break;
    case 'PT': model = Company; modelName = 'Company'; idFieldName = 'companyId'; break;
    case 'RQ': model = RestockRequest; modelName = 'RestockRequest'; idFieldName = 'requestId'; break;
    case 'TL': model = Tile; modelName = 'Tile'; idFieldName = 'tileId'; break;
    default: throw new Error('Invalid prefix for ID generation');
  }

  // --- THIS IS THE CORRECTED LOGIC ---
  // We use .unscoped() if you have a default scope, or add a condition to find all documents.
  // A more direct way is to bypass the middleware for this specific query.
  // Mongoose middleware does not apply to aggregation pipelines, so we can use one.
  
  const lastDocuments = await model.aggregate([
    { $sort: { createdAt: -1 } }, // Sort by creation date descending
    { $limit: 1 }, // Take only the most recent one
    { $project: { [idFieldName]: 1 } } // Project only the ID field we need
  ]);

  let sequenceNumber = 1;

  if (lastDocuments.length > 0) {
    const lastDocument = lastDocuments[0];
    if (lastDocument && lastDocument[idFieldName]) {
      const lastId = lastDocument[idFieldName];
      if (lastId.startsWith(prefix)) {
        const lastNumber = parseInt(lastId.split('-')[1], 10);
        if (!isNaN(lastNumber)) {
          sequenceNumber = lastNumber + 1;
        }
      }
    }
  }
  // ------------------------------------

  return `${prefix}-${String(sequenceNumber).padStart(5, '0')}`;
};

export { generateId };
