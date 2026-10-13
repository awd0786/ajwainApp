import { apiUrl } from './config';

/**
 * POST /Zentao/Login – shared by the password form and biometric sign-in.
 * Resolves { ok, data, message, status }. Never throws.
 */
export async function loginRequest(loginName, password) {
  try {
    const res = await fetch(apiUrl('login'), {
      method: 'POST',
      headers: { accept: '*/*', 'Content-Type': 'application/json-patch+json' },
      body: JSON.stringify({ loginName: String(loginName || '').trim(), password }),
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (res.ok && data?.success) return { ok: true, data, status: res.status };
    return { ok: false, data, status: res.status, message: data?.message || 'Invalid credentials.' };
  } catch {
    return { ok: false, network: true, message: 'Network error. Please check your connection and try again.' };
  }
}
