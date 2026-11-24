import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from '../api';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [onlineUserIds, setOnlineUserIds] = useState([]);

  useEffect(() => {
    if (!user) return undefined;
    const socket = io(API_URL, {
      auth: { token: localStorage.getItem('chatsphere_token') },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('presence:list', ({ onlineUserIds: ids }) => setOnlineUserIds(ids || []));
    socket.on('presence:update', ({ userId, online }) => {
      setOnlineUserIds((prev) =>
        online ? [...new Set([...prev, userId])] : prev.filter((id) => id !== userId)
      );
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setOnlineUserIds([]);
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ socketRef, onlineUserIds }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
