import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="muted center">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/"
              element={
                <Protected>
                  <Chat />
                </Protected>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
}
