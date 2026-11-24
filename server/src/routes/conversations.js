const express = require('express');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const { authRequired } = require('../middleware/auth');
const { isObjectId } = require('../middleware/validate');
const { serializeConversation } = require('../utils/serialize');

const router = express.Router();
router.use(authRequired);

async function loadPopulated(id) {
  return Conversation.findById(id).populate('members', 'name email').populate('lastMessage');
}

// List my conversations, most recent activity first.
router.get('/', async (req, res, next) => {
  try {
    const convs = await Conversation.find({ members: req.user._id })
      .sort({ lastMessageAt: -1 })
      .populate('members', 'name email')
      .populate('lastMessage');
    const out = [];
    for (const c of convs) out.push(await serializeConversation(c, req.user._id));
    return res.json({ conversations: out });
  } catch (err) {
    return next(err);
  }
});

// Create a direct (1-to-1) conversation — idempotent: returns the existing one if present.
router.post('/direct', async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!isObjectId(userId)) return res.status(400).json({ error: 'Valid userId is required' });
    if (userId === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot start a conversation with yourself' });
    }
    const other = await User.findById(userId);
    if (!other) return res.status(404).json({ error: 'User not found' });

    let conv = await Conversation.findOne({
      isGroup: false,
      members: { $all: [req.user._id, other._id], $size: 2 },
    });
    const existed = Boolean(conv);
    if (!conv) {
      conv = await Conversation.create({
        isGroup: false,
        members: [req.user._id, other._id],
        createdBy: req.user._id,
        readBy: { [req.user._id.toString()]: new Date() },
      });
    }
    const populated = await loadPopulated(conv._id);
    return res
      .status(existed ? 200 : 201)
      .json({ conversation: await serializeConversation(populated, req.user._id) });
  } catch (err) {
    return next(err);
  }
});

// Create a group conversation (creator + at least 2 others).
router.post('/group', async (req, res, next) => {
  try {
    const { name, memberIds } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Group name is required' });
    }
    if (!Array.isArray(memberIds) || memberIds.length < 2) {
      return res.status(400).json({ error: 'A group needs at least 2 other members' });
    }
    if (!memberIds.every(isObjectId)) {
      return res.status(400).json({ error: 'memberIds must be valid user ids' });
    }
    const unique = [...new Set(memberIds.filter((id) => id !== req.user._id.toString()))];
    const users = await User.find({ _id: { $in: unique } });
    if (users.length !== unique.length) {
      return res.status(404).json({ error: 'One or more members not found' });
    }
    const conv = await Conversation.create({
      isGroup: true,
      name: String(name).trim(),
      members: [req.user._id, ...users.map((u) => u._id)],
      createdBy: req.user._id,
      readBy: { [req.user._id.toString()]: new Date() },
    });
    const populated = await loadPopulated(conv._id);
    return res.status(201).json({ conversation: await serializeConversation(populated, req.user._id) });
  } catch (err) {
    return next(err);
  }
});

// Get one conversation (must be a member).
router.get('/:id', async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid conversation id' });
    const conv = await loadPopulated(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    if (!conv.members.some((m) => m._id.equals(req.user._id))) {
      return res.status(403).json({ error: 'Not a member of this conversation' });
    }
    return res.json({ conversation: await serializeConversation(conv, req.user._id) });
  } catch (err) {
    return next(err);
  }
});

// Mark conversation as read up to now.
router.post('/:id/read', async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid conversation id' });
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    if (!conv.members.some((m) => m.equals(req.user._id))) {
      return res.status(403).json({ error: 'Not a member of this conversation' });
    }
    conv.readBy.set(req.user._id.toString(), new Date());
    await conv.save();
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
