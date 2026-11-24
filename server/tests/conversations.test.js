const request = require('supertest');
const { setupTestServer, registerUser, auth } = require('./helpers');

let ctx;
let alice;
let bob;
let carol;

beforeAll(async () => {
  ctx = await setupTestServer();
  alice = await registerUser(ctx.app, { name: 'Alice' });
  bob = await registerUser(ctx.app, { name: 'Bob' });
  carol = await registerUser(ctx.app, { name: 'Carol' });
});
afterAll(async () => {
  await ctx.teardown();
});

describe('conversations', () => {
  test('create direct conversation and return the same one on repeat', async () => {
    const first = await request(ctx.app)
      .post('/api/conversations/direct')
      .set(auth(alice.token))
      .send({ userId: bob.id });
    expect(first.status).toBe(201);
    expect(first.body.conversation.isGroup).toBe(false);
    expect(first.body.conversation.members).toHaveLength(2);

    const second = await request(ctx.app)
      .post('/api/conversations/direct')
      .set(auth(bob.token))
      .send({ userId: alice.id });
    expect(second.status).toBe(200);
    expect(second.body.conversation.id).toBe(first.body.conversation.id);
  });

  test('direct conversation with self or unknown user is rejected', async () => {
    const self = await request(ctx.app)
      .post('/api/conversations/direct')
      .set(auth(alice.token))
      .send({ userId: alice.id });
    expect(self.status).toBe(400);

    const ghost = await request(ctx.app)
      .post('/api/conversations/direct')
      .set(auth(alice.token))
      .send({ userId: '64b64c2f4f4f4f4f4f4f4f4f' });
    expect(ghost.status).toBe(404);
  });

  test('create group conversation with a name and members', async () => {
    const res = await request(ctx.app)
      .post('/api/conversations/group')
      .set(auth(alice.token))
      .send({ name: 'Weekend Plans', memberIds: [bob.id, carol.id] });
    expect(res.status).toBe(201);
    expect(res.body.conversation.isGroup).toBe(true);
    expect(res.body.conversation.name).toBe('Weekend Plans');
    expect(res.body.conversation.members).toHaveLength(3);
  });

  test('group with fewer than 2 other members is rejected', async () => {
    const res = await request(ctx.app)
      .post('/api/conversations/group')
      .set(auth(alice.token))
      .send({ name: 'Too Small', memberIds: [bob.id] });
    expect(res.status).toBe(400);
  });

  test('list returns only my conversations', async () => {
    const res = await request(ctx.app).get('/api/conversations').set(auth(carol.token));
    expect(res.status).toBe(200);
    // Carol is only in the group, not in the Alice<->Bob direct chat.
    expect(res.body.conversations.every((c) => c.isGroup)).toBe(true);
  });

  test('non-member cannot fetch a conversation', async () => {
    const direct = await request(ctx.app)
      .post('/api/conversations/direct')
      .set(auth(alice.token))
      .send({ userId: bob.id });
    const res = await request(ctx.app)
      .get(`/api/conversations/${direct.body.conversation.id}`)
      .set(auth(carol.token));
    expect(res.status).toBe(403);
  });

  test('user search finds other users but not self', async () => {
    const res = await request(ctx.app)
      .get('/api/users/search?q=Bob')
      .set(auth(alice.token));
    expect(res.status).toBe(200);
    expect(res.body.users.some((u) => u.id === bob.id)).toBe(true);
    expect(res.body.users.some((u) => u.id === alice.id)).toBe(false);
  });
});
