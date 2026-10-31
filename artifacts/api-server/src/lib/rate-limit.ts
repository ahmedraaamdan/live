/**
 * Fixed-window request budgets, in memory. Like events.ts this assumes one API
 * process; a restart forgets the counts, which only ever errs towards allowing.
 * Budgets per address stay generous because a school or a mobile carrier can put
 * many real people behind one IP.
 */
import { tooMany } from "./http";

export interface Limit {
  name: string;
  max: number;
  windowMs: number;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const LIMITS = {
  loginAttempt: { name: "login-attempt", max: 10, windowMs: 15 * MINUTE },
  loginEmail: { name: "login-email", max: 50, windowMs: HOUR },
  loginIp: { name: "login-ip", max: 200, windowMs: 15 * MINUTE },
  mfaIp: { name: "mfa-ip", max: 30, windowMs: 15 * MINUTE },
  signupIp: { name: "signup-ip", max: 60, windowMs: HOUR },
  forgotEmail: { name: "forgot-email", max: 3, windowMs: HOUR },
  forgotIp: { name: "forgot-ip", max: 30, windowMs: HOUR },
  resetIp: { name: "reset-ip", max: 30, windowMs: 15 * MINUTE },
  parentInvite: { name: "parent-invite", max: 5, windowMs: HOUR },
  parentLink: { name: "parent-link", max: 10, windowMs: HOUR },
  upload: { name: "upload", max: 60, windowMs: HOUR },
  message: { name: "message", max: 30, windowMs: MINUTE },
  ticket: { name: "ticket", max: 5, windowMs: HOUR },
  ticketMessage: { name: "ticket-message", max: 20, windowMs: HOUR },
} satisfies Record<string, Limit>;

const windows = new Map<string, { count: number; resetAt: number }>();

function hit(limit: Limit, key: string) {
  const now = Date.now();
  if (windows.size > 50_000) for (const [id, entry] of windows) if (entry.resetAt <= now) windows.delete(id);
  const id = `${limit.name}:${key}`;
  const current = windows.get(id);
  if (!current || current.resetAt <= now) {
    const fresh = { count: 1, resetAt: now + limit.windowMs };
    windows.set(id, fresh);
    return fresh;
  }
  current.count += 1;
  return current;
}

/** Spends one request; false once the budget for this key is gone. */
export function allow(limit: Limit, key: string): boolean {
  return hit(limit, key).count <= limit.max;
}

/** Spends one request, or answers 429 once the budget for this key is gone. */
export function enforce(limit: Limit, key: string, message = "محاولات كثيرة. حاول مرة أخرى بعد قليل.") {
  const entry = hit(limit, key);
  if (entry.count > limit.max) throw tooMany(message, Math.ceil((entry.resetAt - Date.now()) / 1000));
}

/** Gives the budget back, e.g. after the right password. */
export function forgive(limit: Limit, key: string) {
  windows.delete(`${limit.name}:${key}`);
}
