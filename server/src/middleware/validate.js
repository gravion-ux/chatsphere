// Dependency-free request validation helpers.

function requireFields(fields) {
  return (req, res, next) => {
    const missing = fields.filter(
      (f) => req.body[f] === undefined || req.body[f] === null || req.body[f] === ''
    );
    if (missing.length) {
      return res.status(400).json({ error: `Missing required field(s): ${missing.join(', ')}` });
    }
    return next();
  };
}

function isEmail(value) {
  return typeof value === 'string' && /^\S+@\S+\.\S+$/.test(value);
}

function isObjectId(value) {
  return typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
}

module.exports = { requireFields, isEmail, isObjectId };
