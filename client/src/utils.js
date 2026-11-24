export function conversationTitle(conversation, currentUserId) {
  if (conversation.isGroup) return conversation.name || 'Group';
  const other = (conversation.members || []).find((m) => m.id !== currentUserId);
  return other ? other.name : 'Conversation';
}

export function otherMemberIds(conversation, currentUserId) {
  return (conversation.members || []).map((m) => m.id).filter((id) => id !== currentUserId);
}

export function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
