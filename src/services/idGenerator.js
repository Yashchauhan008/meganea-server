import mongoose from 'mongoose';
import Booking from '../models/bookingModel.js';
import DispatchOrder from '../models/dispatchOrderModel.js';
import Party from '../models/partyModel.js';
import RestockRequest from '../models/restockRequestModel.js';
import Tile from '../models/tileModel.js';

const generateId = async (prefix) => {
  let model;
  let modelName;
  let idFieldName;

  switch (prefix) {
    case 'BK': model = Booking; modelName = 'Booking'; idFieldName = 'bookingId'; break;
    case 'DO': model = DispatchOrder; modelName = 'DispatchOrder'; idFieldName = 'dispatchNumber'; break;
    case 'PT': model = Party; modelName = 'Party'; idFieldName = 'partyId'; break;
    case 'RQ': model = RestockRequest; modelName = 'RestockRequest'; idFieldName = 'requestId'; break;
    case 'TL': model = Tile; modelName = 'Tile'; idFieldName = 'tileId'; break;
    default: throw new Error('Invalid prefix for ID generation');
  }

  const lastDocument = await model.findOne({}, {}, { sort: { 'createdAt': -1 } });
  let sequenceNumber = 1;

  if (lastDocument && lastDocument[idFieldName]) {
    const lastId = lastDocument[idFieldName];
    if (lastId.startsWith(prefix)) {
      const lastNumber = parseInt(lastId.split('-')[1], 10);
      sequenceNumber = lastNumber + 1;
    }
  }

  return `${prefix}-${String(sequenceNumber).padStart(5, '0')}`;
};

export { generateId };
