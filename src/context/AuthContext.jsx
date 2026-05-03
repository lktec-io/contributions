import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

export const AuthContext = createContext(null);

const API_BASE = import.meta.env.VITE_API_URL || 'https://contribution.nardio.online/api';

const KEYS = {
  user:    'ct_user',
  refresh: 'ct_refresh',
};

// Returns { storage, token } from whichever store has the refresh token, or null.
function getStoredSession() {
  const ls = localStorage.getItem(KEYS.refresh);
  if (ls) return { storage: localStorage,    token: ls };
  const ss = sessionStorage.getItem(KEYS.refresh);
  if (ss) return { storage: sessionStorage,  token: ss };
  return null;
}

function clearAllStorage() {
  [localStorage, sessionStorage].forEach(s => {
    s.removeItem(KEYS.user);
    s.removeItem(KEYS.refresh);
  });
}

export function AuthProvider({ children }) {
  const [user,      setUser]      = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const loading = !authReady;
  const accessTokenRef = useRef(null);

  const setAccessToken = useCallback((token) => { accessTokenRef.current = token; }, []);
  const getAccessToken = useCallback(() => accessTokenRef.current, []);

  const login = useCallback(async (email, password, rememberMe = false) => {
    const res = await axios.post(
      `${API_BASE}/auth/login`,
      { email, password, remember_me: rememberMe },
      { withCredentials: true }
    );
    const { accessToken, refreshToken, user: userData } = res.data.data;

    accessTokenRef.current = accessToken;

    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem(KEYS.user,    JSON.stringify(userData));
    if (refreshToken) storage.setItem(KEYS.refresh, refreshToken);

    setUser(userData);
    return userData;
  }, []);

  const logout = useCallback(async () => {
    const session = getStoredSession();
    try {
      await axios.post(
        `${API_BASE}/auth/logout`,
        session?.token ? { refreshToken: session.token } : {},
        { withCredentials: true }
      );
    } catch { /* ignore */ }

    accessTokenRef.current = null;
    clearAllStorage();
    setUser(null);
  }, []);

  const refreshAuth = useCallback(async () => {
    try {
      const session = getStoredSession();
      const body    = session?.token ? { refreshToken: session.token } : {};

      const res = await axios.post(`${API_BASE}/auth/refresh`, body, { withCredentials: true });
      const { accessToken } = res.data.data;
      accessTokenRef.current = accessToken;

      const payload     = JSON.parse(atob(accessToken.split('.')[1]));
      const storedUser  = session
        ? JSON.parse(session.storage.getItem(KEYS.user) || '{}')
        : {};

      setUser({
        id:    payload.userId,
        email: payload.email,
        role:  payload.role,
        name:  storedUser.name || payload.email,
      });
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
