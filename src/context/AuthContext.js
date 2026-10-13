import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getSession, saveSession, clearSession } from '../utils/storage';
import { onSessionExpired } from '../api/authFetch';
import { isBiometricEnabled } from '../auth/biometric';
import { unregisterPush } from '../push/notifications';

const AuthContext = createContext(null);
const EMPTY = { token: '', role: '', realName: '', loginName: '', userId: '' };

export function AuthProvider({ children }) {
  const [session, setSession] = useState(EMPTY);
  const [bootstrapping, setBootstrapping] = useState(true);
  /**
   * true when biometric login is on: the saved session is NOT restored
   * silently – the login screen asks for fingerprint / Face ID first and then
   * signs in again with the securely stored credentials.
   */
  const [biometricGate, setBiometricGate] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await getSession();
      if (s.token && (await isBiometricEnabled())) {
        setBiometricGate(true);
        setSession(EMPTY);
      } else {
        setSession(s);
      }
      setBootstrapping(false);
    })();
  }, []);

  const login = useCallback(async (apiData) => {
    await saveSession(apiData);
    const s = await getSession();
    setBiometricGate(false);
    setSession(s);
  }, []);

  const logout = useCallback(async () => {
    await unregisterPush(); // while the bearer token is still valid
    await clearSession();
    setSession(EMPTY);
  }, []);

  // Web parity: App.jsx listens for 'tokenExpired' and logs out.
  useEffect(() => onSessionExpired(() => logout()), [logout]);

  return (
    <AuthContext.Provider value={{ session, bootstrapping, biometricGate, login, logout, isAuthenticated: !!session.token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
