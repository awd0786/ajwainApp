import { getToken, setToken } from '../utils/storage';

/* ------------------------------------------------------------------ */
/* Session-expiry broadcast (web: window 'tokenExpired' event)         */
/* ------------------------------------------------------------------ */
const listeners = new Set();
export function onSessionExpired(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emitExpired() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

/**
 * Drop-in replacement for the web app's authFetch(url, options).
 * Attaches the bearer token stored from login. If there is no token, or
 * the API answers 401, the session-expired listeners are fired (the
 * AuthContext logs the user out — same as the web 'tokenExpired' event).
 */
export async function authFetch(url, options = {}) {
  const token = await getToken();
  if (!token) {
    emitExpired();
    throw new Error('No session found. Please log in again.');
  }
  const headers = {
    accept: '*/*',
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };

  const res = await fetch(url, { ...options, headers });

  // Sliding session: the API sends a renewed token while the current one is still valid.
  const refreshed = res.headers?.get?.('X-Refreshed-Token');
  if (refreshed) await setToken(refreshed);

  if (res.status === 401) {
    emitExpired();
    const err = new Error('Session expired. Please log in again.');
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

/** Read a response body as JSON when possible, else as plain text. */
export async function readBody(res) {
  const raw = (await res.text()).trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** Pull a human message out of whatever the API returned. */
export function messageOf(body, fallback = '') {
  if (body == null) return fallback;
  if (typeof body === 'string') return body;
  if (typeof body === 'object') {
    return body.message || body.Message || body.result || body.Result || body.title || fallback;
  }
  return String(body);
}

/** Normalise list-shaped responses: [], {data: []}, {Table: []} … */
export function rowsOf(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    for (const k of ['data', 'Data', 'Table', 'table', 'result', 'Result', 'items']) {
      if (Array.isArray(payload[k])) return payload[k];
    }
  }
  return [];
}
