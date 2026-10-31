import type { ErrorRequestHandler } from "express";
import type { z } from "zod/v4";
import { logger } from "./logger";

/** Thrown anywhere in a handler; the error middleware turns it into JSON. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, code?: string) => new HttpError(400, msg, code);
export const unauthorized = (msg = "لازم تسجّل دخول الأول") => new HttpError(401, msg, "unauthorized");
export const forbidden = (msg = "مش مسموح لك تعمل ده") => new HttpError(403, msg, "forbidden");
export const notFound = (msg = "مش لاقيين اللي بتدور عليه") => new HttpError(404, msg, "not_found");
export const conflict = (msg: string, code?: string) => new HttpError(409, msg, code);
export const tooMany = (msg: string, retryAfterSeconds?: number) => new HttpError(429, msg, "rate_limited", retryAfterSeconds);

/** Validates a body against a shared schema; the first issue becomes the message. */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input ?? {});
  if (!result.success) {
    const issue = result.error.issues[0];
    throw badRequest(issue?.message ?? "البيانات مش مظبوطة", "validation");
  }
  return result.data;
}

/** Route params are typed loosely by Express 5; this keeps call sites short. */
export function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function uuidParam(value: string | string[] | undefined): string {
  const v = param(value);
  if (!UUID.test(v)) throw notFound();
  return v;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    if (err.retryAfterSeconds) res.setHeader("Retry-After", String(err.retryAfterSeconds));
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  if (err?.type === "entity.too.large") {
    res.status(413).json({ error: "الملف أكبر من المسموح", code: "too_large" });
    return;
  }
  logger.error({ err, url: req.url }, "Unhandled error");
  res.status(500).json({ error: "حصلت مشكلة عندنا، جرّب تاني بعد شوية", code: "internal" });
};
