const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { signToken } = require('../middleware/auth');
const { requireFields, isEmail } = require('../middleware/validate');

const router = express.Router();

router.post('/register', requireFields(['name', 'email', 'password']), async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!isEmail(email)) return res.status(400).json({ error: 'Invalid email address' });
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name: name.trim(), email: email.toLowerCase(), passwordHash });
    return res.status(201).json({ token: signToken(user), user: user.toPublic() });
  } catch (err) {
    return next(err);
  }
});

router.post('/login', requireFields(['email', 'password']), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });
    return res.json({ token: signToken(user), user: user.toPublic() });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
