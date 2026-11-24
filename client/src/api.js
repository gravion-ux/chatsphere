const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function getToken() {
  return localStorage.getItem('chatsphere_token');
}

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...options.headers,
    },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  register: (payload) =>
    request('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  me: () => request('/api/users/me'),
  searchUsers: (q) => request(`/api/users/search?q=${encodeURIComponent(q)}`),
  listConversations: () => request('/api/conversations'),
  createDirect: (userId) =>
    request('/api/conversations/direct', { method: 'POST', body: JSON.stringify({ userId }) }),
  createGroup: (name, memberIds) =>
    request('/api/conversations/group', {
      method: 'POST',
      body: JSON.stringify({ name, memberIds }),
    }),
  listMessages: (conversationId) => request(`/api/conversations/${conversationId}/messages`),
  markRead: (conversationId) =>
    request(`/api/conversations/${conversationId}/read`, { method: 'POST' }),
};

export { API_URL };
