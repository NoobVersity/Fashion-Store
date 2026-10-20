/**
 * Tiny fetch wrapper for the THREADS API.
 * All requests stay same-origin (/api is proxied to Express in dev and
 * served by Express in production), so HTTP-only session cookies just work.
 *
 * Errors: throws an Error with `.status`, `.details` (field errors) and
 * `.data` (full JSON payload) when the response is not OK.
 */
async function request(path, { method = 'GET', body } = {}) {
  const options = {
    method,
    credentials: 'same-origin',
    headers: {},
  };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`/api${path}`, options);
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const error = new Error(
      (data && data.error) || `Request failed (${res.status})`
    );
    error.status = res.status;
    error.details = data && data.details;
    error.data = data;
    throw error;
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
};

export default api;
