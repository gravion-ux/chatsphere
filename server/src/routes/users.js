const express = require('express');
const User = require('../models/User');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// Search users by name/email (for starting conversations). Excludes self.
router.get('/search', authRequired, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json({ users: [] });
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const users = await User.find({
      _id: { $ne: req.user._id },
      $or: [{ name: rx }, { email: rx }],
    })
      .limit(20)
      .select('name email');
    return res.json({ users: users.map((u) => u.toPublic()) });
  } catch (err) {
    return next(err);
  }
});

router.get('/me', authRequired, (req, res) => {
  res.json({ user: req.user.toPublic() });
});

module.exports = router;
