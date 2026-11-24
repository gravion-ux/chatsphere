const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

/**
 * Persist a message, update conversation metadata, and mark it read for the sender.
 * Throws an Error with .status for HTTP-style handling.
 */
async function sendMessage({ conversationId, senderId, body }) {
  const text = typeof body === 'string' ? body.trim() : '';
  if (!text) {
    const err = new Error('Message body is required');
    err.status = 400;
    throw err;
  }
  if (text.length > 4000) {
    const err = new Error('Message is too long (max 4000 characters)');
    err.status = 400;
    throw err;
  }
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    const err = new Error('Conversation not found');
    err.status = 404;
    throw err;
  }
  if (!conversation.members.some((m) => m.equals(senderId))) {
    const err = new Error('Not a member of this conversation');
    err.status = 403;
    throw err;
  }

  const message = await Message.create({ conversation: conversation._id, sender: senderId, body: text });
  conversation.lastMessage = message._id;
  conversation.lastMessageAt = message.createdAt;
  conversation.readBy.set(senderId.toString(), message.createdAt);
  await conversation.save();

  return { conversation, message };
}

async function markRead(conversationId, userId) {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) return null;
  if (!conversation.members.some((m) => m.equals(userId))) return null;
  conversation.readBy.set(userId.toString(), new Date());
  await conversation.save();
  return conversation;
}

module.exports = { sendMessage, markRead };
