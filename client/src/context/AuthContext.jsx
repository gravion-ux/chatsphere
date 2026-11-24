import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('chatsphere_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(({ user: me }) => setUser(me))
      .catch(() => localStorage.removeItem('chatsphere_token'))
      .finally(() => setLoading(false));
  }, []);

  function login({ token, user: loggedIn }) {
    localStorage.setItem('chatsphere_token', token);
    setUser(loggedIn);
  }

  function logout() {
    localStorage.removeItem('chatsphere_token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
