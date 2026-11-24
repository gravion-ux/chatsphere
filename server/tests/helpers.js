const http = require('http');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { Server } = require('socket.io');
const request = require('supertest');
const { createApp } = require('../src/app');
const { initSocket } = require('../src/socket');

async function setupTestServer() {
  // Prefer the shared mongod started by tests/globalSetup.js; fall back to a
  // private instance when a single file is run without the Jest config.
  const sharedUri = process.env.CHATSPHERE_TEST_MONGO_URI;
  let mongo = null;
  if (sharedUri) {
    const dbName = `chatsphere-test-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    await mongoose.connect(sharedUri, { dbName });
  } else {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  }

  const app = createApp();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });
  app.set('io', io);
  initSocket(io);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  return {
    mongo,
    app,
    server,
    io,
    baseUrl: `http://127.0.0.1:${port}`,
    async teardown() {
      io.close();
      await new Promise((resolve) => server.close(resolve));
      if (!sharedUri) {
        await mongoose.disconnect();
        if (mongo) await mongo.stop();
      } else {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
      }
    },
  };
}

let counter = 0;
async function registerUser(app, overrides = {}) {
  counter += 1;
  const data = {
    name: overrides.name || `User ${counter}`,
    email: overrides.email || `user${counter}@example.com`,
    password: overrides.password || 'secret123',
  };
  const res = await request(app).post('/api/auth/register').send(data);
  if (res.status !== 201) throw new Error(`register failed: ${JSON.stringify(res.body)}`);
  return { ...data, id: res.body.user.id, token: res.body.token };
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

module.exports = { setupTestServer, registerUser, auth };
