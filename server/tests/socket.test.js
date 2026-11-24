const request = require('supertest');
const { io: ioClient } = require('socket.io-client');
const { setupTestServer, registerUser, auth } = require('./helpers');
const Message = require('../src/models/Message');

let ctx;
let alice;
let bob;
let conversationId;

function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = ioClient(ctx.baseUrl, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
    });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (err) => reject(err));
  });
}

function waitFor(socket, event, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeout);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

beforeAll(async () => {
  ctx = await setupTestServer();
  alice = await registerUser(ctx.app, { name: 'Alice' });
  bob = await registerUser(ctx.app, { name: 'Bob' });
  const res = await request(ctx.app)
    .post('/api/conversations/direct')
    .set(auth(alice.token))
    .send({ userId: bob.id });
  conversationId = res.body.conversation.id;
});
afterAll(async () => {
  await ctx.teardown();
});

describe('socket layer', () => {
  test('socket with a bad token is rejected', async () => {
    await expect(connect('bad.token.value')).rejects.toThrow();
  });

  test('socket without a token is rejected', async () => {
    await expect(connect('')).rejects.toThrow();
  });

  test('real-time message: sent by one user, received live by the other, and persisted', async () => {
    const aliceSocket = await connect(alice.token);
    const bobSocket = await connect(bob.token);
    try {
      const received = waitFor(bobSocket, 'message:new');
      const ack = await new Promise((resolve) => {
        aliceSocket.emit('message:send', { conversationId, body: 'Live hello!' }, resolve);
      });
      expect(ack.ok).toBe(true);
      expect(ack.message.body).toBe('Live hello!');

      const liveMsg = await received;
      expect(liveMsg.body).toBe('Live hello!');
      expect(liveMsg.conversation).toBe(conversationId);

      const stored = await Message.findOne({ conversation: conversationId, body: 'Live hello!' });
      expect(stored).not.toBeNull();
    } finally {
      aliceSocket.disconnect();
      bobSocket.disconnect();
    }
  });

  test('typing indicator is relayed to the other member', async () => {
    const aliceSocket = await connect(alice.token);
    const bobSocket = await connect(bob.token);
    try {
      const typingEvent = waitFor(bobSocket, 'typing:update');
      aliceSocket.emit('typing:start', { conversationId });
      const data = await typingEvent;
      expect(data.userId).toBe(alice.id);
      expect(data.typing).toBe(true);
      expect(data.conversationId).toBe(conversationId);
    } finally {
      aliceSocket.disconnect();
      bobSocket.disconnect();
    }
  });

  test('presence: a connecting user appears in the presence list', async () => {
    const aliceSocket = await connect(alice.token);
    try {
      const listPromise = waitFor(aliceSocket, 'presence:list', 3000).catch(() => null);
      // presence:list is emitted immediately on connect; if we missed it, connect Bob and watch the update.
      const list = await listPromise;
      if (list) {
        expect(list.onlineUserIds).toContain(alice.id);
      } else {
        const update = waitFor(aliceSocket, 'presence:update');
        const bobSocket = await connect(bob.token);
        const data = await update;
        expect(data).toEqual({ userId: bob.id, online: true });
        bobSocket.disconnect();
      }
    } finally {
      aliceSocket.disconnect();
    }
  });
});
