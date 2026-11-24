const express = require('express');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { authRequired } = require('../middleware/auth');
const { isObjectId } = require('../middleware/validate');
const { sendMessage } = require('../services/messaging');
const { serializeMessage } = require('../utils/serialize');

const router = express.Router({ mergeParams: true });
router.use(authRequired);

async function requireMembership(req, res, next) {
  const { conversationId } = req.params;
  if (!isObjectId(conversationId)) {
    return res.status(400).json({ error: 'Invalid conversation id' });
  }
  const conv = await Conversation.findById(conversationId);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });
  if (!conv.members.some((m) => m.equals(req.user._id))) {
    return res.status(403).json({ error: 'Not a member of this conversation' });
  }
  req.conversation = conv;
  return next();
}

// List messages in a conversation (oldest first, paginated by limit/before).
router.get('/', requireMembership, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const query = { conversation: req.conversation._id };
    if (req.query.before) query.createdAt = { $lt: new Date(req.query.before) };
    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('sender', 'name');
    return res.json({ messages: messages.reverse().map(serializeMessage) });
  } catch (err) {
    return next(err);
  }
});

// Send a message over REST (sockets are the primary path; this mirrors it).
router.post('/', requireMembership, async (req, res, next) => {
  try {
    const { message } = await sendMessage({
      conversationId: req.conversation._id,
      senderId: req.user._id,
      body: req.body.body,
    });
    await message.populate('sender', 'name');
    const payload = serializeMessage(message);
    const io = req.app.get('io');
    if (io) io.to(req.conversation._id.toString()).emit('message:new', payload);
    return res.status(201).json({ message: payload });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
