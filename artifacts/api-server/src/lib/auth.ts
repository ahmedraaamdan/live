/**
 * Passwords (scrypt) and sessions (opaque bearer tokens). The app sends
 * `Authorization: Bearer <token>` — the same on the web and inside the
 * Capacitor shells, where cookies are unreliable.
 */
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { and, eq, gt } from "drizzle-orm";
import { db, sessionsTable, usersTable, type User } from "@workspace/db";
import type { Role } from "@workspace/live-core";
import { forbidden, unauthorized } from "./http";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const SESSION_DAYS = 60;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, keyB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await scryptAsync(password, Buffer.from(saltB64, "base64"), expected.length);
  return timingSafeEqual(expected, actual);
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const randomToken = () => randomBytes(32).toString("base64url");

export async function createSession(userId: string, userAgent?: string): Promise<string> {
  const token = randomToken();
  await db.insert(sessionsTable).values({
    tokenHash: sha256(token),
    userId,
    userAgent: userAgent?.slice(0, 300),
    expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000),
  });
  return token;
}

export async function destroySession(token: string) {
  await db.delete(sessionsTable).where(eq(sessionsTable.tokenHash, sha256(token)));
}

export function bearer(req: Request): string | null {
  const h = req.headers.authorization;
  if (h?.startsWith("Bearer ")) return h.slice(7).trim() || null;
  return null;
}

/** Attaches req.user when a valid token is present; never rejects. */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const token = bearer(req);
  if (!token) return next();
  const [row] = await db
    .select({ user: usersTable })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(usersTable.id, sessionsTable.userId))
    .where(and(eq(sessionsTable.tokenHash, sha256(token)), gt(sessionsTable.expiresAt, new Date())))
    .limit(1);
  if (row && !row.user.suspended) req.user = row.user;
  next();
};

export function requireUser(req: Request): User {
  if (!req.user) throw unauthorized();
  return req.user;
}

export function requireRole(req: Request, ...roles: Role[]): User {
  const user = requireUser(req);
  if (!roles.includes(user.role)) throw forbidden();
  return user;
}

/** Middleware form, for whole routers. */
export const roleGate =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    requireRole(req, ...roles);
    next();
  };
