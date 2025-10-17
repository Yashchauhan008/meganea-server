const generateUniqueId = async (model, prefix) => {
    const year = new Date().getFullYear();
    const count = await model.countDocuments({});
    const sequence = (count + 1).toString().padStart(4, '0');
    return `${prefix}-${year}-${sequence}`;
  };
  
  module.exports = { generateUniqueId };
  