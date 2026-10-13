import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';

/**
 * PUSH NOTIFICATIONS (Expo Push Service)
 *
 *  1. After login the device asks permission, gets its Expo push token and
 *     registers it with the API (POST /Zentao/RegisterPushToken).
 *  2. The .NET API sends notifications through https://exp.host when a patch
 *     is created, a point is added to a sprint, or a point is marked critical.
 *  3. Every notification carries `data.page` (+ optional `data.params`), the
 *     same page keys the app's drawer uses, so tapping it opens that screen.
 *  4. On logout the token is unregistered so the user stops receiving pushes.
 */

const TOKEN_KEY = 'ajwain_push_token';
export const ANDROID_CHANNEL = 'ajwain-default';

// Show notifications as banners even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function projectId() {
  return Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
}

/** Ask permission, get the Expo token and save it on the server for this user. */
export async function registerForPush(userId) {
  try {
    if (!Device.isDevice || !userId) return null; // simulators/emulators can't receive remote pushes

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
        name: 'Ajwain updates',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 120, 200],
        lightColor: '#5B4BF5',
      });
    }

    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return null;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
    if (!token) return null;

    await api.postJson('registerPushToken', {
      UserId: Number(userId),
      Token: token,
      Platform: Platform.OS,
      DeviceName: Device.deviceName || Device.modelName || '',
    });
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return token;
  } catch (e) {
    console.warn('Push registration failed:', e?.message || e);
    return null;
  }
}

/** Stop pushes to this device (called on logout, while the auth token is still valid). */
export async function unregisterPush() {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return;
    await api.postJson('unregisterPushToken', { Token: token });
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore – the server also prunes dead tokens */
  }
}

/** Extract { page, params } from a notification response. */
export function routeOf(response) {
  const data = response?.notification?.request?.content?.data || {};
  if (!data.page) return null;
  let params = data.params || {};
  if (typeof params === 'string') {
    try {
      params = JSON.parse(params);
    } catch {
      params = {};
    }
  }
  return { page: String(data.page), params, id: response?.notification?.request?.identifier };
}
