import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

/**
 * BIOMETRIC LOGIN (fingerprint / Face ID / iris – whatever the device offers)
 *
 * When the user turns it on, their login name + password are kept in the
 * device's secure hardware store (iOS Keychain / Android Keystore via
 * expo-secure-store). Every app launch then asks for the biometric and calls
 * the normal /Zentao/Login API with those credentials, so a locked account or
 * a changed password is still caught by the server exactly like a manual login.
 */

const CREDS_KEY = 'ajwain_bio_credentials';
const ENABLED_KEY = 'ajwain_bio_enabled';
const ASKED_KEY = 'ajwain_bio_asked';
const STORE_OPTS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

/** { available, enrolled, label, icon } for the current device. */
export async function getBiometricInfo() {
  try {
    const [hasHardware, enrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    const T = LocalAuthentication.AuthenticationType;
    const face = types.includes(T.FACIAL_RECOGNITION);
    const finger = types.includes(T.FINGERPRINT);
    const iris = types.includes(T.IRIS);
    let label = 'Biometrics';
    let icon = 'shield';
    if (face && !finger) {
      label = Platform.OS === 'ios' ? 'Face ID' : 'Face Unlock';
      icon = 'smile';
    } else if (finger && !face) {
      label = Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
      icon = 'target';
    } else if (iris && !face && !finger) {
      label = 'Iris';
      icon = 'eye';
    } else if (face && finger) {
      label = 'Fingerprint / Face';
      icon = 'target';
    }
    // Expo Go on iPhone can't use Face ID (iOS replaces it with the passcode) – only the installed app can.
    const expoGoBlocked = isExpoGo && Platform.OS === 'ios';
    return { available: hasHardware && enrolled && !expoGoBlocked, hasHardware, enrolled, expoGoBlocked, label, icon };
  } catch {
    return { available: false, hasHardware: false, enrolled: false, label: 'Biometrics', icon: 'shield' };
  }
}

/** True when running inside the Expo Go app (not your own build). */
export const isExpoGo = Constants.executionEnvironment === 'storeClient';

const ERROR_TEXT = {
  not_enrolled: 'No fingerprint or face is set up on this phone.',
  not_available: 'Biometric sign-in is not available on this phone.',
  passcode_not_set: 'Set a phone passcode first to use biometric sign-in.',
  lockout: 'Too many failed attempts. Unlock the phone with its passcode, then try again.',
  missing_usage_description: 'Face ID is not allowed for this build.',
};

/**
 * Show the system biometric prompt – fingerprint / Face ID ONLY.
 * The phone passcode is never offered as a fallback (disableDeviceFallback),
 * so a recognised face or finger opens the app straight away.
 * Resolves { ok, cancelled, message }.
 */
export async function authenticate(promptMessage = 'Sign in to Ajwain') {
  if (isExpoGo && Platform.OS === 'ios') {
    // Expo Go cannot use Face ID for another app's bundle – iOS silently swaps it for the passcode.
    return { ok: false, message: 'Face ID only works in the installed Ajwain app, not in Expo Go. Please sign in with your password here.' };
  }
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Use password',
      disableDeviceFallback: true, // no "Enter Passcode" – biometrics only
      fallbackLabel: '', // iOS: hide the passcode button after a failed attempt
      biometricsSecurityLevel: 'strong', // Android: real fingerprint / face sensor only
      requireConfirmation: false, // Android face unlock: open as soon as the face is recognised
    });
    if (res.success) return { ok: true };
    const cancelled = ['user_cancel', 'system_cancel', 'app_cancel', 'user_fallback'].includes(res.error);
    return { ok: false, cancelled, message: cancelled ? '' : ERROR_TEXT[res.error] || 'Biometric check failed. Please try again.' };
  } catch (e) {
    return { ok: false, message: e?.message || 'Biometric check failed.' };
  }
}

export async function isBiometricEnabled() {
  try {
    if ((await SecureStore.getItemAsync(ENABLED_KEY)) !== '1') return false;
    return !!(await SecureStore.getItemAsync(CREDS_KEY));
  } catch {
    return false;
  }
}

export async function enableBiometric(loginName, password) {
  await SecureStore.setItemAsync(CREDS_KEY, JSON.stringify({ loginName, password }), STORE_OPTS);
  await SecureStore.setItemAsync(ENABLED_KEY, '1', STORE_OPTS);
  await SecureStore.setItemAsync(ASKED_KEY, '1', STORE_OPTS);
}

export async function disableBiometric() {
  try {
    await SecureStore.deleteItemAsync(CREDS_KEY);
    await SecureStore.setItemAsync(ENABLED_KEY, '0', STORE_OPTS);
  } catch {
    /* ignore */
  }
}

export async function getStoredCredentials() {
  try {
    const raw = await SecureStore.getItemAsync(CREDS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Keep the stored password in sync after "Change Password". */
export async function updateStoredPassword(loginName, password) {
  const creds = await getStoredCredentials();
  if (creds && creds.loginName === loginName) {
    await SecureStore.setItemAsync(CREDS_KEY, JSON.stringify({ loginName, password }), STORE_OPTS);
  }
}

/** True once we've offered "Enable Face ID?" so we don't nag after every login. */
export async function wasAskedToEnable() {
  try {
    return (await SecureStore.getItemAsync(ASKED_KEY)) === '1';
  } catch {
    return true;
  }
}

export async function markAskedToEnable() {
  try {
    await SecureStore.setItemAsync(ASKED_KEY, '1', STORE_OPTS);
  } catch {
    /* ignore */
  }
}
