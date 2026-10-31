import type { RequestHandler } from "express";
import { env } from "./env";

const liveOrigins = env.livekit.url ? [env.livekit.url, env.livekit.url.replace(/^ws/, "http")] : [];

/** What the built app may load. Teachers' avatars, covers and recordings can live on any https host. */
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  `connect-src ${["'self'", ...liveOrigins].join(" ")}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/** API responses are JSON or uploaded files, opened on their own, so only pages carry the policy. */
export const securityHeaders: RequestHandler = (req, res, next) => {
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(self), display-capture=(self), geolocation=(), payment=()");
  if (!req.path.startsWith("/api/")) res.setHeader("Content-Security-Policy", contentSecurityPolicy);
  next();
};
