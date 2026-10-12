import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { apiUrl } from '../api/config';
import { authFetch } from '../api/authFetch';
import { derivePermissions, EMPTY_PERMISSIONS } from '../auth/permissions';

/**
 * Loads the logged-in user's PermissionAPI flags once, then exposes the
 * derived action-level booleans (canAddPoint, canPointDrop, ...) to every
 * screen. This replaces the per-component `loadPermissions()` that
 * SprintDashboard, Scrum and SprintMaster each duplicate on the web.
 *
 * Web reference (SprintDashboard.jsx):
 *   const response = await authFetch(`${base}/Zentao/PermissionAPI?userId=${userId}`, ...)
 *   const data = await response.json();
 *   if (data.length > 0) setPermissions(data[0]);
 */

const PermissionContext = createContext(null);

export function PermissionProvider({ children }) {
  const { session, isAuthenticated } = useAuth();
  const [flags, setFlags] = useState(EMPTY_PERMISSIONS);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!session?.userId) return;
    setLoading(true);
    try {
      const res = await authFetch(apiUrl('permission', { userId: session.userId }));
      if (!res.ok) throw new Error('Unable to fetch permissions');
      const data = await res.json();
      // API returns an array; the web app uses data[0].
      if (Array.isArray(data) && data.length > 0) {
        setFlags(data[0]);
      } else {
        setFlags(EMPTY_PERMISSIONS);
      }
    } catch (err) {
      // Match the web app: log and fall back to no extra permissions.
      // Role-based access still applies, so the user is not locked out.
      console.error('PermissionAPI failed:', err?.message || err);
      setFlags(EMPTY_PERMISSIONS);
    } finally {
      setLoading(false);
    }
  }, [session?.userId]);

  useEffect(() => {
    if (isAuthenticated) load();
    else setFlags(EMPTY_PERMISSIONS);
  }, [isAuthenticated, load]);

  const value = useMemo(
    () => ({
      ...derivePermissions(session?.role, flags),
      permissionsLoading: loading,
      reloadPermissions: load,
    }),
    [session?.role, flags, loading, load],
  );

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

export function usePermissions() {
  const ctx = useContext(PermissionContext);
  if (!ctx) throw new Error('usePermissions must be used within PermissionProvider');
  return ctx;
}
