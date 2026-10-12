import { Platform } from 'react-native';

/**
 * iOS cannot present a new <Modal> while another one is still being dismissed –
 * the new one silently never appears (e.g. Drawer → "Change Password", or an
 * action sheet → "Sprint Change"). Every modal-based component reports when it
 * starts closing; a modal that wants to open waits until that window has passed.
 */
let busyUntil = 0;
const SETTLE_MS = 350;

export function markModalClosing(animMs = 0) {
  if (Platform.OS !== 'ios') return;
  busyUntil = Math.max(busyUntil, Date.now() + animMs + SETTLE_MS);
}

export function modalOpenDelay() {
  if (Platform.OS !== 'ios') return 0;
  return Math.max(0, busyUntil - Date.now());
}
