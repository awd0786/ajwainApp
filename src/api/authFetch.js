import { getToken } from '../utils/storage';

/**
 * Drop-in replacement for the web app's authFetch(url, options).
 * Attaches the bearer token stored from login and normalizes JSON errors.
 */
export async function authFetch(url, options = {}) {
  const token = await getToken();
  const headers = {
    accept: '*/*',
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    // Session expired / invalid token. Screens can catch this and
    // redirect to Login via the AuthContext.
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }

  return res;
}

export async function authFetchJson(url, options = {}) {
  const res = await authFetch(url, options);
  if (!res.ok) throw new Error(`Server returned ${res.status}`);
  return res.json();
}
