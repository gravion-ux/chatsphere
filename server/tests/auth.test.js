const request = require('supertest');
const { setupTestServer, registerUser, auth } = require('./helpers');

let ctx;
beforeAll(async () => {
  ctx = await setupTestServer();
});
afterAll(async () => {
  await ctx.teardown();
});

describe('auth', () => {
  test('register creates a user and returns a token', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/register')
      .send({ name: 'Asha', email: 'asha@example.com', password: 'secret123' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('asha@example.com');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  test('register rejects duplicate email', async () => {
    const data = { name: 'Dup', email: 'dup@example.com', password: 'secret123' };
    await request(ctx.app).post('/api/auth/register').send(data).expect(201);
    const res = await request(ctx.app).post('/api/auth/register').send(data);
    expect(res.status).toBe(409);
  });

  test('register rejects short password and bad email', async () => {
    const short = await request(ctx.app)
      .post('/api/auth/register')
      .send({ name: 'X', email: 'x@example.com', password: '123' });
    expect(short.status).toBe(400);
    const badEmail = await request(ctx.app)
      .post('/api/auth/register')
      .send({ name: 'X', email: 'not-an-email', password: 'secret123' });
    expect(badEmail.status).toBe(400);
  });

  test('login works with correct credentials and fails with wrong ones', async () => {
    const user = await registerUser(ctx.app, { email: 'login@example.com' });
    const ok = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: user.password });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTruthy();

    const bad = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'wrong-password' });
    expect(bad.status).toBe(401);
  });

  test('protected route rejects missing and invalid tokens', async () => {
    const noToken = await request(ctx.app).get('/api/users/me');
    expect(noToken.status).toBe(401);
    const badToken = await request(ctx.app).get('/api/users/me').set(auth('not.a.token'));
    expect(badToken.status).toBe(401);
  });

  test('GET /api/users/me returns the current user', async () => {
    const user = await registerUser(ctx.app);
    const res = await request(ctx.app).get('/api/users/me').set(auth(user.token));
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
  });
});
