require('dotenv').config();

const DEV_JWT_SECRET = 'dev-only-secret-change-me';
const jwtSecret = process.env.JWT_SECRET || DEV_JWT_SECRET;

// A known fallback secret is fine for local development and tests, but in
// production it would let anyone forge sessions. Fail fast instead.
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || jwtSecret === DEV_JWT_SECRET || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be set to a random value of at least 32 characters in production');
  }
}

module.exports = {
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/chatsphere',
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
};
