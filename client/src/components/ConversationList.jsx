import { conversationTitle, otherMemberIds, formatTime } from '../utils';

export default function ConversationList({
  conversations,
  currentUserId,
  activeId,
  onSelect,
  onlineUserIds,
}) {
  if (!conversations.length) {
    return <p className="empty-note">No conversations yet. Start a new chat!</p>;
  }
  return (
    <ul className="conversation-list">
      {conversations.map((c) => {
        const others = otherMemberIds(c, currentUserId);
        const anyOnline = others.some((id) => onlineUserIds.includes(id));
        return (
          <li key={c.id}>
            <button
              type="button"
              className={`conversation-item ${c.id === activeId ? 'active' : ''}`}
              onClick={() => onSelect(c)}
            >
              <span className="avatar-wrap">
                <span className="avatar">{conversationTitle(c, currentUserId).charAt(0)}</span>
                {!c.isGroup && (
                  <span
                    data-testid={`presence-${c.id}`}
                    className={`presence-dot ${anyOnline ? 'online' : ''}`}
                  />
                )}
              </span>
              <span className="conversation-meta">
                <span className="conversation-title">{conversationTitle(c, currentUserId)}</span>
                <span className="conversation-preview">
                  {c.lastMessage ? c.lastMessage.body : 'Say hello 👋'}
                </span>
              </span>
              <span className="conversation-side">
                <span className="conversation-time">
                  {c.lastMessage ? formatTime(c.lastMessage.createdAt) : ''}
                </span>
                {c.unreadCount > 0 && (
                  <span className="unread-badge" data-testid={`unread-${c.id}`}>
                    {c.unreadCount}
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
