/**
 * The one way the app talks to the API. Same-origin on the web (Vite proxies
 * /api in development); the Capacitor shells set VITE_API_URL to the
 * production origin at build time.
 */
import type { ApiErrorBody, UploadDTO } from '@workspace/live-core';

export const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '');
const TOKEN_KEY = 'gl.token';

const SWITCH_TOKEN_KEY = 'gl.switch-token';
let baseToken: string | null = null;
let token: string | null = null;
try {
  baseToken = localStorage.getItem(TOKEN_KEY);
  token = baseToken;
} catch {
  token = null;
}

try { token = sessionStorage.getItem(SWITCH_TOKEN_KEY) || baseToken; } catch { /* tab storage unavailable */ }

export function hasSwitchToken() { return Boolean(token && token !== baseToken); }
export function setSwitchToken(next: string | null) {
  token = next || baseToken;
  try { if (next) sessionStorage.setItem(SWITCH_TOKEN_KEY, next); else sessionStorage.removeItem(SWITCH_TOKEN_KEY); } catch { /* memory only */ }
}

export function getToken() {
  return token;
}

export function setToken(next: string | null) {
  baseToken = next;
  token = next;
  try { sessionStorage.removeItem(SWITCH_TOKEN_KEY); } catch { /* memory only */ }
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
  const requestToken = token;
  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers: { ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...authHeaders() },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal ? AbortSignal.any([opts.signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') throw new ApiError(0, 'استغرق الاتصال وقتًا طويلًا. حاول مجددًا.', 'timeout');
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'لا يوجد اتصال بالإنترنت. تحقّق من الشبكة وحاول مجددًا.', 'offline');
  }
  const data = (await res.json().catch(() => null)) as (T & Partial<ApiErrorBody>) | null;
  if (!res.ok) {
    if (res.status === 401 && requestToken && requestToken === token) {
      if (hasSwitchToken()) { setSwitchToken(null); window.dispatchEvent(new Event('gl:switch-expired')); }
      else { setToken(null); window.dispatchEvent(new Event('gl:signed-out')); }
    }
    throw new ApiError(res.status, data?.error ?? 'حصلت مشكلة، جرّب تاني', data?.code);
  }
  return data as T;
}

export async function uploadFile(file: File): Promise<UploadDTO> {
  if (file.size > 12 * 1024 * 1024) throw new ApiError(413, 'حجم الملف أكبر من 12 ميغابايت');
  if (!/^(image\/(png|jpe?g|webp|heic|heif)|application\/pdf)$/.test(file.type)) throw new ApiError(400, 'اختر صورة أو ملف PDF');
  const res = await fetch(apiUrl('/uploads'), {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-Filename': encodeURIComponent(file.name), ...authHeaders() },
    body: file,
    signal: AbortSignal.timeout(60_000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) { setToken(null); window.dispatchEvent(new Event('gl:signed-out')); }
    throw new ApiError(res.status, data?.error ?? 'تعذر رفع الملف. حاول مجددًا.');
  }
  return data as UploadDTO;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'حصلت مشكلة، جرّب تاني';
}
