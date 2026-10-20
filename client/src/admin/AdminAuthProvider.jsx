import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import api from '../services/api.js';

const AdminAuthContext = createContext(null);

/**
 * Verifies the HTTP-only session cookie against
 * GET /api/admin/auth/me whenever the admin area is opened.
 */
export default function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get('/admin/auth/me');
      setAdmin(data.admin || null);
      return data.admin || null;
    } catch {
      setAdmin(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email, password) => {
    const data = await api.post('/admin/auth/login', { email, password });
    setAdmin(data.admin);
    return data.admin;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/admin/auth/logout');
    } finally {
      setAdmin(null);
    }
  }, []);

  return (
    <AdminAuthContext.Provider value={{ admin, loading, refresh, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}
