const Message = require('../models/Message');

/**
 * Serialize a conversation for a given viewer, including unread count.
 * Unread = messages after the viewer's readBy marker (or after epoch if never read),
 * excluding the viewer's own messages.
 */
async function serializeConversation(conversation, viewerId) {
  const doc = conversation.toObject ? conversation.toObject() : conversation;
  const members = (doc.members || []).map((m) =>
    m && m.name ? { id: m._id.toString(), name: m.name, email: m.email } : { id: m.toString() }
  );

  let readAtRaw;
  if (doc.readBy) {
    readAtRaw =
      typeof doc.readBy.get === 'function'
        ? doc.readBy.get(viewerId.toString())
        : doc.readBy[viewerId.toString()];
  }
  const readAt = readAtRaw ? new Date(readAtRaw) : new Date(0);

  const unreadCount = await Message.countDocuments({
    conversation: doc._id,
    sender: { $ne: viewerId },
    createdAt: { $gt: readAt },
  });

  let lastMessage = null;
  if (doc.lastMessage && doc.lastMessage.body) {
    const lm = doc.lastMessage;
    lastMessage = {
      id: lm._id.toString(),
      body: lm.body,
      sender: lm.sender && lm.sender.toString ? lm.sender.toString() : String(lm.sender),
      createdAt: lm.createdAt,
    };
  }

  return {
    id: doc._id.toString(),
    isGroup: doc.isGroup,
    name: doc.name || '',
    members,
    createdBy: doc.createdBy ? doc.createdBy.toString() : null,
    lastMessage,
    lastMessageAt: doc.lastMessageAt,
    unreadCount,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function serializeMessage(message) {
  const doc = message.toObject ? message.toObject() : message;
  const sender =
    doc.sender && doc.sender.name
      ? { id: doc.sender._id.toString(), name: doc.sender.name }
      : { id: doc.sender.toString() };
  return {
    id: doc._id.toString(),
    conversation: doc.conversation.toString(),
    sender,
    body: doc.body,
    createdAt: doc.createdAt,
  };
}

module.exports = { serializeConversation, serializeMessage };
