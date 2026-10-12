// Aceita VITE_API_URL com ou sem "https://" e sem barra final.
const raw = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
export const API_URL = raw && !/^https?:\/\//.test(raw) ? `https://${raw}` : raw;
const TOKEN_KEY = 'feeling_token';

export const auth = {
  get token() { return localStorage.getItem(TOKEN_KEY); },
  set(token: string) { localStorage.setItem(TOKEN_KEY, token); },
  clear() { localStorage.removeItem(TOKEN_KEY); },
};

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function request<T>(method: string, path: string, body?: unknown, opts: { auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const isForm = body instanceof FormData;
  if (body && !isForm) headers['content-type'] = 'application/json';
  if (opts.auth !== false && auth.token) headers.authorization = `Bearer ${auth.token}`;
  const res = await fetch(`${API_URL}${path}`, { method, headers, body: isForm ? body : body ? JSON.stringify(body) : undefined });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && opts.auth !== false) { auth.clear(); if (!location.pathname.startsWith('/a/')) location.assign('/login'); }
    throw new ApiError(res.status, data.error || 'Erro inesperado');
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, opts?: { auth?: boolean }) => request<T>('GET', path, undefined, opts),
  post: <T>(path: string, body?: unknown, opts?: { auth?: boolean }) => request<T>('POST', path, body, opts),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};
