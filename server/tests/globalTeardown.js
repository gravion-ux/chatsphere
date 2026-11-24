module.exports = async function globalTeardown() {
  const server = globalThis.__CHATSPHERE_MONGO__;
  if (server) await server.stop();
};
