import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import api from '../services/api.js';

const CustomerAuthContext = createContext(null);

/**
 * Customer account state, backed by the HTTP-only
 * `threads_customer_session` cookie (see server/routes/auth.js).
 */
export default function CustomerAuthProvider({ children }) {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get('/auth/me');
      setCustomer(data.customer || null);
      return data.customer || null;
    } catch {
      setCustomer(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    setCustomer(data.customer);
    return data.customer;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const data = await api.post('/auth/register', { name, email, password });
    setCustomer(data.customer);
    return data.customer;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setCustomer(null);
    }
  }, []);

  const updateProfile = useCallback(async (fields) => {
    const data = await api.patch('/auth/me', fields);
    setCustomer(data.customer);
    return data.customer;
  }, []);

  return (
    <CustomerAuthContext.Provider
      value={{ customer, loading, login, register, logout, updateProfile }}
    >
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  return useContext(CustomerAuthContext);
}
