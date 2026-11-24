const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const config = require('./config');
const { createApp } = require('./app');
const { initSocket } = require('./socket');

async function main() {
  await mongoose.connect(config.mongoUri);
  console.log('Connected to MongoDB');

  const app = createApp();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: config.clientOrigin, credentials: true },
  });
  app.set('io', io);
  initSocket(io);

  server.listen(config.port, () => {
    console.log(`ChatSphere server listening on http://localhost:${config.port}`);
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = { main };
