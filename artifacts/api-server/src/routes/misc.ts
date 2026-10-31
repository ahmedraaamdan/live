import { logger } from "../lib/logger";
/** Uploads, notifications, public config and the dev outbox. */
import express, { Router, type RequestHandler } from "express";
import { readdir, readFile as readText } from "node:fs/promises";
import path from "node:path";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, notificationsTable, uploadsTable } from "@workspace/db";
import type { NotificationDTO, PublicConfigDTO } from "@workspace/live-core";
import { requireUser } from "../lib/auth";
import { toUpload } from "../lib/dto";
import { env, liveConfigured, paymentConfigured, recordingConfigured } from "../lib/env";
import { badRequest, notFound, param, tooMany, uuidParam } from "../lib/http";
import { enforce, LIMITS } from "../lib/rate-limit";
import { readFile, saveFile } from "../lib/storage";
import { randomUUID } from "node:crypto";

const router = Router();

router.get("/config", (_req, res) => {
  const body: PublicConfigDTO = { paymentProvider: env.payment.provider, liveConfigured, paymentConfigured, recordingConfigured, liveParticipantLimit: env.livekit.maxParticipants || null, liveRoomLimit: env.livekit.maxRooms || null, feeBps: env.feeBps, appUrl: env.appUrl };
  res.json(body);
});

const clientErrorLimits = new Map<string, { until: number; count: number }>();
router.post("/client-errors", (req, res) => {
  const user = requireUser(req);
  const now = Date.now();
  const rate = clientErrorLimits.get(user.id);
  if (rate && rate.until > now && rate.count >= 10) return void res.status(202).json({ ok: true });
  if (clientErrorLimits.size > 5000) for (const [id, item] of clientErrorLimits) if (item.until < now) clientErrorLimits.delete(id);
  clientErrorLimits.set(user.id, { until: rate && rate.until > now ? rate.until : now + 300000, count: rate && rate.until > now ? rate.count + 1 : 1 });
  const clean = (value: unknown, max: number) => (typeof value === 'string' ? value : '').slice(0, max).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]').replace(/Bearer\s+[^\s]+/gi, 'Bearer [redacted]');
  logger.error({ userId: user.id, clientMessage: clean(req.body?.message, 400), clientStack: clean(req.body?.stack, 2000), clientPath: clean(req.body?.path, 160).split('?')[0] }, "Client render failure");
  res.status(202).json({ ok: true });
});

// ---------------------------------------------------------------- uploads

const ALLOWED = /^(image\/(png|jpe?g|webp|heic|heif)|application\/pdf)$/;
const UPLOAD_MAX_PER_DAY = { files: 100, bytes: 300 * 1024 * 1024 };
const UPLOAD_MAX_TOTAL_BYTES = 1024 * 1024 * 1024;

/** Runs before the body is read: uploads land on a disk shared with other services. */
const uploadGate: RequestHandler = async (req, _res, next) => {
  const user = requireUser(req);
  enforce(LIMITS.upload, user.id);
  const since = new Date(Date.now() - 86_400_000);
  const [used] = await db
    .select({
      files: sql<number>`count(*) filter (where ${uploadsTable.createdAt} >= ${since})`,
      bytesToday: sql<number>`coalesce(sum(${uploadsTable.size}) filter (where ${uploadsTable.createdAt} >= ${since}), 0)`,
      bytes: sql<number>`coalesce(sum(${uploadsTable.size}), 0)`,
    })
    .from(uploadsTable)
    .where(eq(uploadsTable.ownerId, user.id));
  if (Number(used?.files) >= UPLOAD_MAX_PER_DAY.files || Number(used?.bytesToday) >= UPLOAD_MAX_PER_DAY.bytes) throw tooMany("وصلت إلى الحد اليومي لرفع الملفات. حاول غدًا.");
  if (Number(used?.bytes) >= UPLOAD_MAX_TOTAL_BYTES) throw tooMany("امتلأت مساحة ملفاتك. تواصل مع الدعم لزيادتها.");
  next();
};

router.post("/uploads", uploadGate, express.raw({ type: () => true, limit: "12mb" }), async (req, res) => {
  const user = requireUser(req);
  const mime = String(req.headers["content-type"] ?? "").split(";")[0]!.trim();
  if (!ALLOWED.test(mime)) throw badRequest("ارفع صورة أو PDF بس");
  const data = req.body as Buffer;
  if (!Buffer.isBuffer(data) || data.length === 0) throw badRequest("الملف فاضي");
  let filename: string;
  try { filename = decodeURIComponent(String(req.headers["x-filename"] ?? "file")).slice(0, 120); }
  catch { throw badRequest("اسم الملف غير صالح"); }
  const header = data.subarray(0, 16);
  const valid = mime === "application/pdf" ? header.toString("ascii").startsWith("%PDF-")
    : /image\/jpe?g/.test(mime) ? header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff
    : mime === "image/png" ? header.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : mime === "image/webp" ? header.toString("ascii", 0, 4) === "RIFF" && header.toString("ascii", 8, 12) === "WEBP"
    : header.toString("ascii", 4, 8) === "ftyp";
  if (!valid) throw badRequest("محتوى الملف لا يطابق نوع الصورة أو PDF");
  const id = randomUUID();
  const storageKey = await saveFile(id, data);
  const [row] = await db.insert(uploadsTable).values({ id, ownerId: user.id, filename, mime, size: data.length, storageKey }).returning();
  res.status(201).json(toUpload(row!));
});

/** The id is a random UUID, so the URL itself is the permission (an <img> can't send a token). */
router.get("/uploads/:id", async (req, res) => {
  const id = uuidParam(req.params.id);
  const row = await db.query.uploadsTable.findFirst({ where: eq(uploadsTable.id, id) });
  if (!row) throw notFound();
  res.setHeader("Content-Type", row.mime);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
  res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(row.filename)}`);
  readFile(row.storageKey).on("error", () => res.status(404).end()).pipe(res);
});

// ---------------------------------------------------------------- notifications

router.get("/notifications", async (req, res) => {
  const user = requireUser(req);
  const rows = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, user.id))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(60);
  const body: NotificationDTO[] = rows.map((n) => ({
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    link: n.link,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  }));
  res.json(body);
});

router.post("/notifications/read", async (req, res) => {
  const user = requireUser(req);
  await db
    .update(notificationsTable)
    .set({ readAt: new Date() })
    .where(and(eq(notificationsTable.userId, user.id), isNull(notificationsTable.readAt)));
  res.json({ ok: true });
});

// ---------------------------------------------------------------- dev outbox

if (!env.isProd) {
  router.get("/dev/outbox", async (_req, res) => {
    const files = await readdir(env.outboxDir).catch(() => [] as string[]);
    const items = await Promise.all(
      files
        .filter((f) => f.endsWith(".html"))
        .sort()
        .reverse()
        .slice(0, 100)
        .map(async (f) => {
          const head = (await readText(path.join(env.outboxDir, f), "utf8")).split("\n", 1)[0] ?? "";
          const m = head.match(/to: (.*) \| subject: (.*) -->/);
          return { file: f, to: m?.[1] ?? "", subject: m?.[2] ?? "" };
        }),
    );
    res.json(items);
  });
  router.get("/dev/outbox/:file", async (req, res) => {
    const file = path.basename(param(req.params.file));
    res.type("html").send(await readText(path.join(env.outboxDir, file), "utf8"));
  });
}

export default router;
