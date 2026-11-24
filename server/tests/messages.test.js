const request = require('supertest');
const { setupTestServer, registerUser, auth } = require('./helpers');

let ctx;
let alice;
let bob;
let carol;
let conversationId;

beforeAll(async () => {
  ctx = await setupTestServer();
  alice = await registerUser(ctx.app, { name: 'Alice' });
  bob = await registerUser(ctx.app, { name: 'Bob' });
  carol = await registerUser(ctx.app, { name: 'Carol' });
  const res = await request(ctx.app)
    .post('/api/conversations/direct')
    .set(auth(alice.token))
    .send({ userId: bob.id });
  conversationId = res.body.conversation.id;
});
afterAll(async () => {
  await ctx.teardown();
});

function sendAs(user, body) {
  return request(ctx.app)
    .post(`/api/conversations/${conversationId}/messages`)
    .set(auth(user.token))
    .send({ body });
}

describe('messages + unread counts', () => {
  test('send a message over REST and read it back (persistence)', async () => {
    const sent = await sendAs(alice, 'Hello Bob!');
    expect(sent.status).toBe(201);
    expect(sent.body.message.body).toBe('Hello Bob!');
    expect(sent.body.message.sender.name).toBe('Alice');

    const list = await request(ctx.app)
      .get(`/api/conversations/${conversationId}/messages`)
      .set(auth(bob.token));
    expect(list.status).toBe(200);
    expect(list.body.messages).toHaveLength(1);
    expect(list.body.messages[0].body).toBe('Hello Bob!');
  });

  test('empty message body is rejected', async () => {
    const res = await sendAs(alice, '   ');
    expect(res.status).toBe(400);
  });

  test('non-member cannot read or post messages', async () => {
    const read = await request(ctx.app)
      .get(`/api/conversations/${conversationId}/messages`)
      .set(auth(carol.token));
    expect(read.status).toBe(403);
    const post = await request(ctx.app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set(auth(carol.token))
      .send({ body: 'intruder' });
    expect(post.status).toBe(403);
  });

  test('unread count rises for the recipient and clears on read', async () => {
    await sendAs(alice, 'second message');
    await sendAs(alice, 'third message');

    const bobList = await request(ctx.app).get('/api/conversations').set(auth(bob.token));
    const bobConv = bobList.body.conversations.find((c) => c.id === conversationId);
    expect(bobConv.unreadCount).toBe(3);

    // The sender never has unread from their own messages.
    const aliceList = await request(ctx.app).get('/api/conversations').set(auth(alice.token));
    const aliceConv = aliceList.body.conversations.find((c) => c.id === conversationId);
    expect(aliceConv.unreadCount).toBe(0);

    await request(ctx.app)
      .post(`/api/conversations/${conversationId}/read`)
      .set(auth(bob.token))
      .expect(200);

    const after = await request(ctx.app).get('/api/conversations').set(auth(bob.token));
    expect(after.body.conversations.find((c) => c.id === conversationId).unreadCount).toBe(0);
  });

  test('replies increment unread for the other side', async () => {
    await sendAs(bob, 'Hi Alice!');
    const aliceList = await request(ctx.app).get('/api/conversations').set(auth(alice.token));
    expect(
      aliceList.body.conversations.find((c) => c.id === conversationId).unreadCount
    ).toBe(1);
    const bobList = await request(ctx.app).get('/api/conversations').set(auth(bob.token));
    expect(bobList.body.conversations.find((c) => c.id === conversationId).unreadCount).toBe(0);
  });
});
