import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getSession, saveSession, clearSession } from '../utils/storage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState({ token: '', role: '', realName: '', loginName: '', userId: '' });
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    (async () => {
      const s = await getSession();
      setSession(s);
      setBootstrapping(false);
    })();
  }, []);

  const login = useCallback(async (apiData) => {
    await saveSession(apiData);
    const s = await getSession();
    setSession(s);
  }, []);

  const logout = useCallback(async () => {
    await clearSession();
    setSession({ token: '', role: '', realName: '', loginName: '', userId: '' });
  }, []);

  return (
    <AuthContext.Provider value={{ session, bootstrapping, login, logout, isAuthenticated: !!session.token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
