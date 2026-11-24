# ChatSphere

A real-time chat web application with direct (1-to-1) and group conversations, live
presence and typing indicators, and persistent message history.

**Author:** Priyanshu Kumar Thakur (Gravion) — [github.com/gravion-ux](https://github.com/gravion-ux)

## Features

- **Accounts** — register/login with bcrypt-hashed passwords and JWT sessions
- **Direct chats** — start a 1-to-1 conversation with any user (idempotent: reopening
  an existing chat returns the same conversation)
- **Group chats** — named groups with 3+ members, member-only access enforced on
  every route and socket event
- **Real-time messaging** — Socket.io with JWT-authenticated sockets; messages are
  persisted to MongoDB and broadcast live to all conversation members
- **Presence** — online/offline indicators driven by live socket connections
- **Typing indicators** — see when someone is typing, per conversation
- **Unread counts** — per-conversation unread badges backed by per-user read markers
- **History** — message history loads over REST when a conversation opens

## Tech stack

| Layer    | Tech |
|----------|------|
| Backend  | Node.js, Express, Socket.io, MongoDB + Mongoose, JWT (jsonwebtoken), bcryptjs |
| Frontend | React 18 (Vite), React Router, socket.io-client, plain CSS (dark theme) |
| Tests    | Jest + Supertest + mongodb-memory-server (backend), Vitest + Testing Library (frontend) |

## Project structure

```
chatsphere/
├── server/            # Express + Socket.io API
│   ├── src/
│   │   ├── models/        # User, Conversation, Message
│   │   ├── routes/        # auth, users, conversations, messages
│   │   ├── services/      # messaging core shared by REST + sockets
│   │   ├── socket/        # Socket.io auth, presence, typing, live messages
│   │   └── middleware/    # JWT auth, validation, central error handler
│   └── tests/             # API + socket integration tests
└── client/            # React app
    ├── src/
    │   ├── pages/         # Login, Register, Chat
    │   ├── components/    # ConversationList, ChatWindow, NewChatModal
    │   └── context/       # AuthContext, SocketContext
    └── tests/             # Vitest smoke tests
```

## Getting started

Prerequisites: Node.js 18+ and MongoDB running locally (or a MongoDB Atlas URI).

```bash
# 1. Backend
cd server
cp .env.example .env        # set MONGO_URI and a strong JWT_SECRET
npm install
npm run dev                 # http://localhost:5000

# 2. Frontend (separate terminal)
cd client
npm install
npm run dev                 # http://localhost:5173
```

Open http://localhost:5173, create two accounts (use a second browser/incognito
window for the other user), search for each other, and chat in real time.

## Socket events

| Direction | Event | Payload / notes |
|-----------|-------|-----------------|
| client → server | `message:send` | `{ conversationId, body }`, ack `{ ok, message }` |
| client → server | `typing:start` / `typing:stop` | `{ conversationId }` |
| client → server | `conversation:read` | `{ conversationId }` |
| client → server | `conversation:join` | `{ conversationId }` (join a room created after connect) |
| server → client | `message:new` | the serialized message |
| server → client | `typing:update` | `{ conversationId, userId, name, typing }` |
| server → client | `presence:list` | `{ onlineUserIds }` (sent on connect) |
| server → client | `presence:update` | `{ userId, online }` |
| server → client | `conversation:read` | `{ conversationId, userId }` |
| server → client | `message:error` | `{ error }` |

Sockets authenticate with the same JWT used for REST: `io(url, { auth: { token } })`.
Connections with a missing or invalid token are rejected during the handshake.

## REST API (summary)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account → `{ token, user }` |
| POST | `/api/auth/login` | Sign in → `{ token, user }` |
| GET  | `/api/users/me` | Current user |
| GET  | `/api/users/search?q=` | Find users to chat with |
| GET  | `/api/conversations` | My conversations (with unread counts) |
| POST | `/api/conversations/direct` | `{ userId }` → direct conversation |
| POST | `/api/conversations/group` | `{ name, memberIds[] }` → group conversation |
| GET  | `/api/conversations/:id/messages` | Message history |
| POST | `/api/conversations/:id/messages` | Send via REST (also broadcast over sockets) |
| POST | `/api/conversations/:id/read` | Mark conversation as read |

## Running the tests

```bash
# Backend — 23 integration tests (auth, conversations, messages/unread, sockets)
cd server && npm test

# Frontend — 7 Vitest smoke tests
cd client && npm test

# Production build of the frontend
cd client && npm run build
```

Backend tests run against an in-memory MongoDB (`mongodb-memory-server`), so no
local database is needed. Socket tests connect real `socket.io-client` instances
to verify handshake rejection for bad tokens and live message delivery.

## License

MIT
