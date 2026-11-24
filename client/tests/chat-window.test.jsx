import { describe, expect, test, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import ChatWindow from '../src/components/ChatWindow';

// A controllable fake socket: captures registered handlers so tests can fire events.
const fake = vi.hoisted(() => {
  const handlers = {};
  const socket = {
    on: (event, fn) => {
      handlers[event] = fn;
    },
    off: (event) => {
      delete handlers[event];
    },
    emit: vi.fn(),
  };
  // Stable ref identity — mirrors the real SocketContext's useRef.
  return { handlers, socket, socketRef: { current: socket } };
});

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'me', name: 'Me' } }),
}));

vi.mock('../src/context/SocketContext', () => ({
  useSocket: () => ({ socketRef: fake.socketRef, onlineUserIds: ['bob'] }),
}));

vi.mock('../src/api', () => ({
  api: {
    listMessages: vi.fn(async () => ({
      messages: [
        {
          id: 'm1',
          conversation: 'c1',
          sender: { id: 'bob', name: 'Bob' },
          body: 'Hey there!',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'm2',
          conversation: 'c1',
          sender: { id: 'me', name: 'Me' },
          body: 'Hi Bob!',
          createdAt: new Date().toISOString(),
        },
      ],
    })),
    markRead: vi.fn(async () => ({ ok: true })),
  },
}));

const conversation = {
  id: 'c1',
  isGroup: false,
  name: '',
  members: [
    { id: 'me', name: 'Me' },
    { id: 'bob', name: 'Bob' },
  ],
};

describe('ChatWindow (smoke)', () => {
  test('renders history, header and online status', async () => {
    render(<ChatWindow conversation={conversation} />);
    expect(await screen.findByText('Hey there!')).toBeInTheDocument();
    expect(screen.getByText('Hi Bob!')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bob' })).toBeInTheDocument();
    expect(screen.getByText('Online')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument();
  });

  test('shows a typing indicator when the other user types', async () => {
    render(<ChatWindow conversation={conversation} />);
    await screen.findByText('Hey there!');
    act(() => {
      fake.handlers['typing:update']({
        conversationId: 'c1',
        userId: 'bob',
        name: 'Bob',
        typing: true,
      });
    });
    expect(screen.getByTestId('typing-indicator')).toHaveTextContent('Bob is typing');
  });

  test('appends a live incoming message', async () => {
    render(<ChatWindow conversation={conversation} />);
    await screen.findByText('Hey there!');
    act(() => {
      fake.handlers['message:new']({
        id: 'm3',
        conversation: 'c1',
        sender: { id: 'bob', name: 'Bob' },
        body: 'Just landed live',
        createdAt: new Date().toISOString(),
      });
    });
    expect(screen.getByText('Just landed live')).toBeInTheDocument();
  });
});
