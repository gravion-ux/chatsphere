import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import ConversationList from '../components/ConversationList';
import ChatWindow from '../components/ChatWindow';
import NewChatModal from '../components/NewChatModal';

export default function Chat() {
  const { user, logout } = useAuth();
  const { socketRef, onlineUserIds } = useSocket();
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [showNewChat, setShowNewChat] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { conversations: list } = await api.listConversations();
      setConversations(list);
      setActive((prev) => {
        if (!prev) return prev;
        return list.find((c) => c.id === prev.id) || prev;
      });
    } catch {
      /* transient errors are ignored; list refreshes on next event */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refresh the list when any message arrives (updates previews + unread badges).
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return undefined;
    const onAny = () => refresh();
    socket.on('message:new', onAny);
    return () => {
      socket.off('message:new', onAny);
    };
  }, [socketRef, refresh]);

  function handleCreated(conversation) {
    setShowNewChat(false);
    refresh().then(() => setActive(conversation));
    const socket = socketRef.current;
    if (socket) socket.emit('conversation:join', { conversationId: conversation.id });
  }

  function handleSelect(conversation) {
    setActive(conversation);
    if (conversation.unreadCount > 0) {
      setConversations((prev) =>
        prev.map((c) => (c.id === conversation.id ? { ...c, unreadCount: 0 } : c))
      );
    }
  }

  return (
    <main className="chat-layout">
      <aside className="sidebar">
        <header className="sidebar-header">
          <div>
            <h1>ChatSphere</h1>
            <p className="muted">
              {user.name} · {onlineUserIds.length} online
            </p>
          </div>
          <div className="sidebar-actions">
            <button type="button" onClick={() => setShowNewChat(true)}>
              New chat
            </button>
            <button type="button" className="ghost" onClick={logout}>
              Log out
            </button>
          </div>
        </header>
        <ConversationList
          conversations={conversations}
          currentUserId={user.id}
          activeId={active?.id}
          onSelect={handleSelect}
          onlineUserIds={onlineUserIds}
        />
      </aside>

      {active ? (
        <ChatWindow key={active.id} conversation={active} onConversationActivity={refresh} />
      ) : (
        <section className="chat-window placeholder">
          <p className="muted">Pick a conversation or start a new chat.</p>
        </section>
      )}

      {showNewChat && (
        <NewChatModal onClose={() => setShowNewChat(false)} onCreated={handleCreated} />
      )}
    </main>
  );
}
