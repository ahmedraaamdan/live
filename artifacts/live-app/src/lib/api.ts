/**
 * The one way the app talks to the API. Same-origin on the web (Vite proxies
 * /api in development); the Capacitor shells set VITE_API_URL to the
 * production origin at build time.
 */
import type { ApiErrorBody, UploadDTO } from '@workspace/live-core';

export const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '');
const TOKEN_KEY = 'gl.token';

let token: string | null = null;
try {
  token = localStorage.getItem(TOKEN_KEY);
} catch {
  token = null;
}

export function getToken() {
  return token;
}

export function setToken(next: string | null) {
  token = next;
  try {
    if (next) localStorage.setItem(TOKEN_KEY, next);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private mode: the session lasts for this tab only.
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export const apiUrl = (path: string) => `${API_BASE}/api${path}`;

export function authHeaders(): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers: { ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...authHeaders() },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch {
    throw new ApiError(0, 'مفيش اتصال بالإنترنت، اتأكد من الشبكة وجرّب تاني', 'offline');
  }
  const data = (await res.json().catch(() => null)) as (T & Partial<ApiErrorBody>) | null;
  if (!res.ok) {
    if (res.status === 401 && token) {
      setToken(null);
      window.dispatchEvent(new Event('gl:signed-out'));
    }
    throw new ApiError(res.status, data?.error ?? 'حصلت مشكلة، جرّب تاني', data?.code);
  }
  return data as T;
}

export async function uploadFile(file: File): Promise<UploadDTO> {
  const res = await fetch(apiUrl('/uploads'), {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-Filename': encodeURIComponent(file.name), ...authHeaders() },
    body: file,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? 'الرفع فشل، جرّب تاني');
  return data as UploadDTO;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'حصلت مشكلة، جرّب تاني';
}
