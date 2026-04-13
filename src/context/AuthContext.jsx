import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

export const AuthContext = createContext(null);

const API_BASE = import.meta.env.VITE_API_URL || 'https://contribution.nardio.online/api';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const loading = !authReady;
  const accessTokenRef = useRef(null);

  const setAccessToken = useCallback((token) => {
    accessTokenRef.current = token;
  }, []);

  const getAccessToken = useCallback(() => {
    return accessTokenRef.current;
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await axios.post(`${API_BASE}/auth/login`, { email, password }, { withCredentials: true });
    const { accessToken, user: userData } = res.data.data;
    accessTokenRef.current = accessToken;
    if (userData?.name) localStorage.setItem('ct_user_name', userData.name);
    setUser(userData);
    return userData;
  }, []);

  const logout = useCallback(async () => {
    try {
      await axios.post(`${API_BASE}/auth/logout`, {}, { withCredentials: true });
    } catch {
      // ignore
    }
    accessTokenRef.current = null;
    localStorage.removeItem('ct_user_name');
    setUser(null);
  }, []);

  const refreshAuth = useCallback(async () => {
    try {
      const res = await axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true });
      const { accessToken } = res.data.data;
      accessTokenRef.current = accessToken;
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      const savedName = localStorage.getItem('ct_user_name');
      setUser({ id: payload.userId, email: payload.email, role: payload.role, name: savedName || payload.email });
      return true;
    } catch {
      accessTokenRef.current = null;
      setUser(null);
      return false;
    }
  }, []);

  useEffect(() => {
    refreshAuth().finally(() => setAuthReady(true));
  }, [refreshAuth]);

  return (
    <AuthContext.Provider value={{
      user,
      setUser,
      loading,
      authReady,
      login,
      logout,
      getAccessToken,
      setAccessToken,
      refreshAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
