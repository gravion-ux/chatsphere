const { verifyToken } = require('../middleware/auth');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const { sendMessage, markRead } = require('../services/messaging');
const { serializeMessage } = require('../utils/serialize');

// userId -> Set<socketId>
const onlineUsers = new Map();

function addOnline(userId, socketId) {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  const wasOffline = onlineUsers.get(userId).size === 0;
  onlineUsers.get(userId).add(socketId);
  return wasOffline;
}

function removeOnline(userId, socketId) {
  const set = onlineUsers.get(userId);
  if (!set) return false;
  set.delete(socketId);
  if (set.size === 0) {
    onlineUsers.delete(userId);
    return true; // went fully offline
  }
  return false;
}

function isOnline(userId) {
  return onlineUsers.has(userId) && onlineUsers.get(userId).size > 0;
}

function initSocket(io) {
  // JWT authentication for sockets — bad/missing tokens are rejected here.
  io.use(async (socket, next) => {
    let user;
    try {
      const token =
        (socket.handshake.auth && socket.handshake.auth.token) ||
        (socket.handshake.headers.authorization || '').replace('Bearer ', '');
      if (!token) return next(new Error('Authentication required'));
      const payload = verifyToken(token);
      user = await User.findById(payload.sub);
      if (!user) return next(new Error('Invalid token'));
    } catch {
      return next(new Error('Invalid or expired token'));
    }
    socket.user = user;

    // Resolve the conversation rooms during the handshake. Socket.IO sends the
    // CONNECT packet before it runs the "connection" handler, so an await in
    // that handler left the socket in no room while the client had already been
    // told it was connected, and the first room-scoped event was broadcast to an
    // empty room. The handshake is awaited before CONNECT is sent, so resolving
    // the rooms here closes that window.
    try {
      const conversations = await Conversation.find({ members: user._id }).select('_id');
      socket.conversationIds = conversations.map((c) => c._id.toString());
    } catch {
      return next(new Error('Could not load conversations'));
    }
    return next();
  });

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();

    // Join a room per conversation the user belongs to + a personal room.
    // The conversation list was resolved during the handshake, so joining is
    // synchronous: the rooms are in place before any client packet that
    // follows CONNECT can be processed.
    (socket.conversationIds || []).forEach((id) => socket.join(id));
    socket.join(`user:${userId}`);

    const cameOnline = addOnline(userId, socket.id);
    socket.emit('presence:list', { onlineUserIds: [...onlineUsers.keys()] });
    if (cameOnline) io.emit('presence:update', { userId, online: true });

    // Allow joining a room for a conversation created after connect.
    socket.on('conversation:join', async ({ conversationId } = {}) => {
      const conv = await Conversation.findById(conversationId).select('members');
      if (conv && conv.members.some((m) => m.equals(socket.user._id))) {
        socket.join(conversationId.toString());
      }
    });

    socket.on('message:send', async ({ conversationId, body } = {}, ack) => {
      try {
        const { message } = await sendMessage({
          conversationId,
          senderId: socket.user._id,
          body,
        });
        await message.populate('sender', 'name');
        const payload = serializeMessage(message);
        io.to(conversationId.toString()).emit('message:new', payload);
        if (typeof ack === 'function') ack({ ok: true, message: payload });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, error: err.message });
        socket.emit('message:error', { error: err.message });
      }
    });

    socket.on('typing:start', ({ conversationId } = {}) => {
      if (!conversationId) return;
      socket.to(conversationId.toString()).emit('typing:update', {
        conversationId: conversationId.toString(),
        userId,
        name: socket.user.name,
        typing: true,
      });
    });

    socket.on('typing:stop', ({ conversationId } = {}) => {
      if (!conversationId) return;
      socket.to(conversationId.toString()).emit('typing:update', {
        conversationId: conversationId.toString(),
        userId,
        name: socket.user.name,
        typing: false,
      });
    });

    socket.on('conversation:read', async ({ conversationId } = {}) => {
      if (!conversationId) return;
      await markRead(conversationId, socket.user._id);
      io.to(conversationId.toString()).emit('conversation:read', {
        conversationId: conversationId.toString(),
        userId,
      });
    });

    socket.on('disconnect', () => {
      const wentOffline = removeOnline(userId, socket.id);
      if (wentOffline) io.emit('presence:update', { userId, online: false });
    });
  });
}

module.exports = { initSocket, isOnline, onlineUsers };
