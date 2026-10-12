import { apiUrl, apiUrlKeepEmpty } from './config';
import { authFetch, readBody, messageOf } from './authFetch';

/**
 * Small helpers on top of authFetch so screens stay short:
 *
 *   const rows = await api.get('sprintData', { productId: 3 });
 *   const msg  = await api.post('markPointStatus', { pointId, status });
 *   await api.postJson('saveModuleTeamLeadMapping', payload);
 *
 * get / post use query-string params (like 95% of the web calls).
 * keepEmpty: true keeps "" params (URLSearchParams behaviour on the web).
 */
async function request(method, key, params, { body, keepEmpty = false, json = false, headers } = {}) {
  const url = keepEmpty ? apiUrlKeepEmpty(key, params) : apiUrl(key, params);
  const opts = { method, headers: { ...(headers || {}) } };
  if (body !== undefined) {
    if (json) {
      if (!opts.headers['Content-Type']) opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    } else {
      opts.body = body; // FormData etc.
    }
  }
  const res = await authFetch(url, opts);
  const data = await readBody(res);
  if (!res.ok) {
    const err = new Error(messageOf(data, `Server returned ${res.status}`));
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

export const api = {
  get: (key, params, opts) => request('GET', key, params, opts),
  post: (key, params, opts) => request('POST', key, params, opts),
  put: (key, params, opts) => request('PUT', key, params, opts),
  del: (key, params, opts) => request('DELETE', key, params, opts),
  postJson: (key, body, params, opts) => request('POST', key, params, { ...(opts || {}), body, json: true }),
  url: apiUrl,
};

export default api;
