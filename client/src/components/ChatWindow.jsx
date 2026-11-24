import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { conversationTitle, formatTime } from '../utils';

export default function ChatWindow({ conversation, onConversationActivity }) {
  const { user } = useAuth();
  const { socketRef, onlineUserIds } = useSocket();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [typingUsers, setTypingUsers] = useState({});
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const typingTimeout = useRef(null);

  // Load history + mark read when the conversation opens.
  useEffect(() => {
    let cancelled = false;
    setMessages([]);
    setTypingUsers({});
    api
      .listMessages(conversation.id)
      .then(({ messages: history }) => {
        if (!cancelled) setMessages(history);
      })
      .catch((err) => !cancelled && setError(err.message));
    api.markRead(conversation.id).catch(() => {});
    const socket = socketRef.current;
    if (socket) socket.emit('conversation:read', { conversationId: conversation.id });
    return () => {
      cancelled = true;
    };
  }, [conversation.id, socketRef]);

  // Live events.
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return undefined;

    function onNewMessage(message) {
      if (message.conversation !== conversation.id) return;
      setMessages((prev) =>
        prev.some((m) => m.id === message.id) ? prev : [...prev, message]
      );
      if (message.sender.id !== user.id) {
        api.markRead(conversation.id).catch(() => {});
        socket.emit('conversation:read', { conversationId: conversation.id });
        onConversationActivity?.();
      }
    }
    function onTyping({ conversationId, userId, name, typing }) {
      if (conversationId !== conversation.id || userId === user.id) return;
      setTypingUsers((prev) => ({ ...prev, [userId]: typing ? name : undefined }));
    }

    socket.on('message:new', onNewMessage);
    socket.on('typing:update', onTyping);
    return () => {
      socket.off('message:new', onNewMessage);
      socket.off('typing:update', onTyping);
    };
  }, [conversation.id, socketRef, user.id, onConversationActivity]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages]);

  function handleTypingChange(e) {
    setDraft(e.target.value);
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit('typing:start', { conversationId: conversation.id });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit('typing:stop', { conversationId: conversation.id });
    }, 1500);
  }

  function handleSend(e) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    const socket = socketRef.current;
    setDraft('');
    if (socket) {
      socket.emit('typing:stop', { conversationId: conversation.id });
      socket.emit('message:send', { conversationId: conversation.id, body }, (ack) => {
        if (!ack?.ok) setError(ack?.error || 'Failed to send message');
      });
    }
  }

  const typingNames = Object.values(typingUsers).filter(Boolean);
  const others = (conversation.members || []).filter((m) => m.id !== user.id);
  const anyOnline = others.some((m) => onlineUserIds.includes(m.id));

  return (
    <section className="chat-window">
      <header className="chat-header">
        <div>
          <h2>{conversationTitle(conversation, user.id)}</h2>
          <p className="chat-status">
            {conversation.isGroup
              ? `${conversation.members.length} members`
              : anyOnline
                ? 'Online'
                : 'Offline'}
          </p>
        </div>
      </header>

      <div className="messages">
        {messages.map((m) => (
          <div key={m.id} className={`message-row ${m.sender.id === user.id ? 'mine' : ''}`}>
            <div className="message-bubble">
              {conversation.isGroup && m.sender.id !== user.id && (
                <span className="message-sender">{m.sender.name}</span>
              )}
              <p>{m.body}</p>
              <span className="message-time">{formatTime(m.createdAt)}</span>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {typingNames.length > 0 && (
        <p className="typing-indicator" data-testid="typing-indicator">
          {typingNames.join(', ')} {typingNames.length === 1 ? 'is' : 'are'} typing…
        </p>
      )}
      {error && <p className="form-error">{error}</p>}

      <form className="composer" onSubmit={handleSend}>
        <input
          value={draft}
          onChange={handleTypingChange}
          placeholder="Type a message…"
          aria-label="Message"
        />
        <button type="submit">Send</button>
      </form>
    </section>
  );
}
