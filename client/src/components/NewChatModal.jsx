import { useEffect, useState } from 'react';
import { api } from '../api';

export default function NewChatModal({ onClose, onCreated }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return undefined;
    }
    const timer = setTimeout(() => {
      api
        .searchUsers(query.trim())
        .then(({ users }) => setResults(users))
        .catch((err) => setError(err.message));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  function toggle(user) {
    setSelected((prev) =>
      prev.some((u) => u.id === user.id) ? prev.filter((u) => u.id !== user.id) : [...prev, user]
    );
  }

  async function startDirect(user) {
    try {
      const { conversation } = await api.createDirect(user.id);
      onCreated(conversation);
    } catch (err) {
      setError(err.message);
    }
  }

  async function createGroup(e) {
    e.preventDefault();
    try {
      const { conversation } = await api.createGroup(
        groupName.trim(),
        selected.map((u) => u.id)
      );
      onCreated(conversation);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-label="New chat">
      <div className="modal">
        <header>
          <h3>New chat</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people by name or email…"
          aria-label="Search people"
        />

        <ul className="search-results">
          {results.map((u) => (
            <li key={u.id}>
              <label>
                <input
                  type="checkbox"
                  checked={selected.some((s) => s.id === u.id)}
                  onChange={() => toggle(u)}
                />
                {u.name} <span className="muted">{u.email}</span>
              </label>
              <button type="button" onClick={() => startDirect(u)}>
                Chat
              </button>
            </li>
          ))}
        </ul>

        {selected.length >= 2 && (
          <form onSubmit={createGroup} className="group-form">
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name"
              aria-label="Group name"
              required
            />
            <button type="submit">Create group ({selected.length} members)</button>
          </form>
        )}
        {selected.length === 1 && (
          <p className="muted">Select at least one more person to make a group.</p>
        )}
        {error && <p className="form-error">{error}</p>}
      </div>
    </div>
  );
}
