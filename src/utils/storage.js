import AsyncStorage from '@react-native-async-storage/async-storage';

// Mirrors the sessionStorage keys used by the web app so the mental model
// (and API responses) stay identical between web and mobile.
const KEYS = {
  token: 'access_token',
  userId: 'user_id',
  loginName: 'login_name',
  realName: 'real_name',
  role: 'role',
};

export async function saveSession(data) {
  await AsyncStorage.multiSet([
    [KEYS.token, data.access_token || ''],
    [KEYS.userId, String(data?.data?.Id ?? '')],
    [KEYS.loginName, data?.data?.LoginName ?? ''],
    [KEYS.realName, data?.data?.RealName ?? ''],
    [KEYS.role, data?.data?.Role ?? ''],
  ]);
}

export async function clearSession() {
  await AsyncStorage.multiRemove(Object.values(KEYS));
}

export async function getSession() {
  const entries = await AsyncStorage.multiGet(Object.values(KEYS));
  const map = Object.fromEntries(entries);
  return {
    token: map[KEYS.token] || '',
    userId: map[KEYS.userId] || '',
    loginName: map[KEYS.loginName] || '',
    realName: map[KEYS.realName] || '',
    role: map[KEYS.role] || '',
  };
}

export async function getToken() {
  return (await AsyncStorage.getItem(KEYS.token)) || '';
}

export async function getRole() {
  return (await AsyncStorage.getItem(KEYS.role)) || '';
}

export async function getUserId() {
  return (await AsyncStorage.getItem(KEYS.userId)) || '';
}
