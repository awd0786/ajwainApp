import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../context/AuthContext';
import { useShell } from '../navigation/ShellContext';
import { isPageAllowed } from '../auth/navigationMap';
import { useToast } from '../ui';
import { registerForPush, routeOf } from './notifications';

// Notification ids already handled in this app run (cold-start response is reported again on re-login).
const handled = new Set();

/**
 * Lives inside the logged-in shell:
 *  - registers this device's push token for the current user
 *  - opens the right page when a notification is tapped (app open, in
 *    background, or launched from the notification)
 */
export default function PushBridge() {
  const { session } = useAuth();
  const { replace } = useShell();
  const toast = useToast();
  const roleRef = useRef(session.role);
  roleRef.current = session.role;

  useEffect(() => {
    registerForPush(session.userId);
  }, [session.userId]);

  useEffect(() => {
    const open = (response) => {
      const route = routeOf(response);
      if (!route || (route.id && handled.has(route.id))) return;
      if (route.id) handled.add(route.id);
      if (!isPageAllowed(roleRef.current, route.page)) {
        toast.info('You do not have access to that page.');
        return;
      }
      replace(route.page, route.params || {});
    };

    // App launched by tapping a notification (also covers biometric unlock before the shell mounts).
    Notifications.getLastNotificationResponseAsync()
      .then((r) => r && open(r))
      .catch(() => {});

    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [replace, toast]);

  return null;
}
