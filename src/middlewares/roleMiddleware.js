const role = (...roles) => {
    return (req, res, next) => {
      if (!req.user || !roles.includes(req.user.role)) {
        res.status(403);
        throw new Error('Forbidden: You do not have permission to perform this action');
      }
      next();
    };
  };
  
  const location = (...locations) => {
    return (req, res, next) => {
      if (!req.user || !locations.includes(req.user.location)) {
        res.status(403);
        throw new Error(`Forbidden: This action is restricted to the ${locations.join(' or ')} office`);
      }
      next();
    };
  };
  
  module.exports = { role, location };
  