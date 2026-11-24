const { MongoMemoryServer } = require('mongodb-memory-server');

// One shared in-memory mongod for the whole suite (started once by Jest's
// main process) instead of one per test file — much lighter on CI machines.
module.exports = async function globalSetup() {
  const server = await MongoMemoryServer.create();
  process.env.CHATSPHERE_TEST_MONGO_URI = server.getUri();
  globalThis.__CHATSPHERE_MONGO__ = server;
};
