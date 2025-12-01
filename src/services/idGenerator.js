// backend/src/services/idGenerator.js

import Counter from '../models/counterModel.js';

export const generateId = async (prefix) => {
    const counter = await Counter.findByIdAndUpdate(
        prefix,
        { $inc: { sequence_value: 1 } },
        { new: true, upsert: true }
    );

    const sequenceNumber = String(counter.sequence_value).padStart(5, '0');

    return `${prefix}-${sequenceNumber}`;
};
