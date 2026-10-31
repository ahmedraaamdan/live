import { assertVerifiedTeacher } from "../lib/teacher-verification";
import { Router } from "express";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  attendanceTable,
  boardOpsTable,
  db,
  lectureMessagesTable,
  lecturesTable,
  recordingsTable,
  usersTable,
  type LectureMessage,
  type User,
} from "@workspace/db";
import {
  EPHEMERAL_OPS,
  HEARTBEAT_SECONDS,
  boardOpsSchema,
  type BoardOp,
  LIVE_OPEN_MINUTES_BEFORE,
  heartbeatSchema,
  messageInputSchema,
  messagePatchSchema,
  recordingInputSchema,
  type LiveTokenDTO,
  type MessageDTO,
} from "@workspace/live-core";
import { assertAccess, assertOwner, bookedStudentIds, getLecture } from "../lib/access";
import { requireRole, requireUser } from "../lib/auth";
import { lectureDTO, toMini, toRecording } from "../lib/dto";
import { sendLectureLive, sendRecordingReady } from "../lib/emails";
import { env, liveConfigured } from "../lib/env";
import { publish, subscribe } from "../lib/events";
import { badRequest, forbidden, notFound, parse, uuidParam } from "../lib/http";
import { closeRoom, liveToken, openRoom, startRecording, stopRecording } from "../lib/livekit";
import { notify } from "../lib/notify";
import { enforce, LIMITS } from "../lib/rate-limit";

const router = Router();

function toMessage(m: LectureMessage, author: Pick<User, "id" | "name" | "avatarUrl" | "role">): MessageDTO {
  return {
    id: m.id,
    lectureId: m.lectureId,
    kind: m.kind,
    body: m.body,
    parentId: m.parentId,
    answered: m.answered,
    pinned: m.pinned,
    createdAt: m.createdAt.toISOString(),
    author: { ...toMini(author), role: author.role },
  };
}

// ---------------------------------------------------------------- go live / end

router.post("/lectures/:id/live/start", async (req, res) => {
  const user = requireRole(req, "teacher");
  if (env.isProd && !liveConfigured) throw badRequest("البث المباشر غير متاح حاليًا؛ يجب ربط خدمة البث أولًا.", "live_unavailable");
  const lecture = await getLecture(uuidParam(req.params.id));
  assertOwner(user, lecture);
  if (lecture.status === "live") return void res.json(await lectureDTO(lecture, user));
  await assertVerifiedTeacher(user);
  if (lecture.status !== "scheduled") throw badRequest("الحصة دي مش متاحة للبث");
  if (lecture.startsAt.getTime() - Date.now() > LIVE_OPEN_MINUTES_BEFORE * 60_000) {
    throw badRequest(`تقدر تبدأ البث قبل الميعاد بـ${LIVE_OPEN_MINUTES_BEFORE} دقيقة بس`);
  }

  const live = await db.transaction(async tx => {
    if (env.livekit.maxRooms > 0) {
      await tx.execute(sql`select pg_advisory_xact_lock(772102)`);
      const active = await tx.select({ id: lecturesTable.id }).from(lecturesTable).where(eq(lecturesTable.status, "live"));
      if (active.some(l => l.id === lecture.id)) return null;
      if (active.length >= env.livekit.maxRooms) throw badRequest("التجربة الحالية تسمح بحصة مباشرة واحدة في الوقت نفسه. أنهِ الحصة المفتوحة أولًا.");
    }
    const [current] = await tx.select().from(lecturesTable).where(eq(lecturesTable.id, lecture.id)).for("update");
    if (current!.status === "live") return null;
    if (current!.status !== "scheduled") throw badRequest("تغيرت حالة الحصة ولم تعد متاحة للبث");
    try { await openRoom(current!); } catch { throw badRequest("تعذر الاتصال بغرفة البث. لم تبدأ الحصة؛ حاول مجددًا."); }
    const [row] = await tx.update(lecturesTable).set({ status: "live", liveStartedAt: new Date(), updatedAt: new Date() }).where(eq(lecturesTable.id, lecture.id)).returning();
    return row!;
  });
  if (!live) return void res.json(await lectureDTO(await getLecture(lecture.id), user));
  const egressId = await startRecording(live!);
  if (egressId) await db.insert(recordingsTable).values({ lectureId: live!.id, provider: "livekit", egressId, status: "recording" });

  publish(live!.id, { type: "status", status: "live", liveStartedAt: live!.liveStartedAt!.toISOString(), liveEndedAt: null });
  const ids = await bookedStudentIds(live!.id);
  await notify(ids, { kind: "live", title: "الحصة بدأت! 🔴", body: live!.title, link: `/live/${live!.id}` });
  if (ids.length) {
    const students = await db.select().from(usersTable).where(inArray(usersTable.id, ids));
    void sendLectureLive(students, live!, user.name);
  }
  res.json(await lectureDTO(live!, user));
});

router.post("/lectures/:id/live/end", async (req, res) => {
  const user = requireRole(req, "teacher", "admin");
  const lecture = await getLecture(uuidParam(req.params.id));
  assertOwner(user, lecture);
  if (lecture.status !== "live") throw badRequest("البث مش شغال");
  const ended = await endLecture(lecture.id);
  res.json(await lectureDTO(ended, user));
});

/** Also used by the scheduler for lectures left running. */
export async function endLecture(lectureId: string) {
  const [ended] = await db
    .update(lecturesTable)
    .set({ status: "ended", liveEndedAt: new Date(), updatedAt: new Date() })
    .where(eq(lecturesTable.id, lectureId))
    .returning();
  const active = await db
    .select()
    .from(recordingsTable)
    .where(and(eq(recordingsTable.lectureId, lectureId), eq(recordingsTable.status, "recording")));
  for (const r of active) {
    if (r.egressId) await stopRecording(r.egressId);
    await db.update(recordingsTable).set({ status: "processing" }).where(eq(recordingsTable.id, r.id));
  }
  await closeRoom(ended!);
  publish(lectureId, { type: "status", status: "ended", liveStartedAt: ended!.liveStartedAt?.toISOString() ?? null, liveEndedAt: ended!.liveEndedAt!.toISOString() });
  return ended!;
}

router.post("/lectures/:id/live/token", async (req, res) => {
  const user = requireUser(req);
  const lecture = await getLecture(uuidParam(req.params.id));
  const host = user.role === "teacher" && user.id === lecture.teacherId;
  if (host && lecture.status !== "live") await assertVerifiedTeacher(user);
  if (!host) {
    if (user.role !== "student") throw forbidden("البث للطلاب الحاجزين بس");
    await assertAccess(user, lecture);
  }
  if (lecture.status !== "live" && !(host && lecture.status === "scheduled")) {
    throw badRequest(lecture.status === "ended" ? "الحصة خلصت، تقدر تشوف التسجيل" : "البث لسه مبدأش");
  }
  const body: LiveTokenDTO = {
    configured: liveConfigured,
    url: liveConfigured ? env.livekit.url : null,
    token: await liveToken(lecture, user, host),
    role: host ? "host" : "viewer",
  };
  res.json(body);
});

// ---------------------------------------------------------------- attendance

router.post("/lectures/:id/heartbeat", async (req, res) => {
  const user = requireRole(req, "student");
  const lecture = await getLecture(uuidParam(req.params.id));
  await assertAccess(user, lecture);
  const { mode } = parse(heartbeatSchema, req.body);
  const live = mode === "live";
  if (live && lecture.status !== "live") throw badRequest("الحصة ليست مباشرة الآن");
  if (!live) {
    const recording = await db.query.recordingsTable.findFirst({ where: and(eq(recordingsTable.lectureId, lecture.id), eq(recordingsTable.status, "ready")) });
    if (!recording?.url) throw badRequest("لا يوجد تسجيل متاح لهذه الحصة");
  }
  // Credit elapsed server time, capped to one heartbeat interval. Repeated requests
  // and multiple tabs cannot inflate attendance or turn an inactive live into replay time.
  const elapsed = sql`least(${HEARTBEAT_SECONDS}, greatest(0, floor(extract(epoch from (now() - ${attendanceTable.lastSeenAt})))))::int`;
  await db.insert(attendanceTable).values({ lectureId: lecture.id, studentId: user.id, liveSeconds: 0, replaySeconds: 0 }).onConflictDoUpdate({
    target: [attendanceTable.lectureId, attendanceTable.studentId],
    set: {
      liveSeconds: live ? sql`${attendanceTable.liveSeconds} + ${elapsed}` : attendanceTable.liveSeconds,
      replaySeconds: live ? attendanceTable.replaySeconds : sql`${attendanceTable.replaySeconds} + ${elapsed}`,
      lastSeenAt: sql`now()`,
    },
  });
  res.json({ ok: true });
});

// ---------------------------------------------------------------- Q&A and events

router.get("/lectures/:id/events", async (req, res) => {
  const user = requireUser(req);
  const lecture = await getLecture(uuidParam(req.params.id));
  await assertAccess(user, lecture);
  subscribe(lecture.id, { res, userId: user.id, role: user.role });
});

router.get("/lectures/:id/messages", async (req, res) => {
  const user = requireUser(req);
  const lecture = await getLecture(uuidParam(req.params.id));
  await assertAccess(user, lecture);
  const rows = await db
    .select({ m: lectureMessagesTable, u: usersTable })
    .from(lectureMessagesTable)
    .innerJoin(usersTable, eq(usersTable.id, lectureMessagesTable.userId))
    .where(eq(lectureMessagesTable.lectureId, lecture.id))
    .orderBy(asc(lectureMessagesTable.createdAt))
    .limit(1000);
  res.json(rows.map((r) => toMessage(r.m, r.u)));
});

router.post("/lectures/:id/messages", async (req, res) => {
  const user = requireUser(req);
  const lecture = await getLecture(uuidParam(req.params.id));
  await assertAccess(user, lecture);
  if (user.role === "parent") throw forbidden("أولياء الأمور بيتابعوا بس");
  enforce(LIMITS.message, user.id, "ترسل رسائل بسرعة كبيرة. انتظر قليلًا ثم حاول مجددًا.");
  const input = parse(messageInputSchema, req.body);
  const host = user.role === "teacher" && user.id === lecture.teacherId;
  if (host && lecture.status !== "live") await assertVerifiedTeacher(user);
  // Students ask or comment; only the teacher answers.
  const kind = host ? (input.parentId ? "answer" : "comment") : input.kind === "answer" ? "question" : input.kind;
  const [m] = await db
    .insert(lectureMessagesTable)
    .values({ lectureId: lecture.id, userId: user.id, kind, body: input.body, parentId: input.parentId })
    .returning();
  if (kind === "answer" && input.parentId) {
    const [q] = await db
      .update(lectureMessagesTable)
      .set({ answered: true })
      .where(and(eq(lectureMessagesTable.id, input.parentId), eq(lectureMessagesTable.lectureId, lecture.id)))
      .returning();
    if (q) {
      const asker = await db.query.usersTable.findFirst({ where: eq(usersTable.id, q.userId) });
      if (asker) publish(lecture.id, { type: "message_update", message: toMessage(q, asker) });
      // Answers given after the class reach the student as a notification.
      if (lecture.status !== "live") await notify([q.userId], { kind: "answer", title: "المدرس رد على سؤالك", body: input.body.slice(0, 120), link: `/lectures/${lecture.id}` });
    }
  }
  const dto = toMessage(m!, user);
  publish(lecture.id, { type: "message", message: dto });
  res.status(201).json(dto);
});

router.patch("/messages/:id", async (req, res) => {
  const user = requireRole(req, "teacher", "admin");
  const id = uuidParam(req.params.id);
  const msg = await db.query.lectureMessagesTable.findFirst({ where: eq(lectureMessagesTable.id, id) });
  if (!msg) throw notFound();
  assertOwner(user, await getLecture(msg.lectureId));
  const input = parse(messagePatchSchema, req.body);
  const [m] = await db.update(lectureMessagesTable).set(input).where(eq(lectureMessagesTable.id, id)).returning();
  const author = await db.query.usersTable.findFirst({ where: eq(usersTable.id, m!.userId) });
  const dto = toMessage(m!, author!);
  publish(m!.lectureId, { type: "message_update", message: dto });
  res.json(dto);
});

// ---------------------------------------------------------------- whiteboard

/** The whole board as stored ops, for late joiners and for review after class. */
router.get("/lectures/:id/board", async (req, res) => {
  const user = requireUser(req);
  const lecture = await getLecture(uuidParam(req.params.id));
  await assertAccess(user, lecture);
  const rows = await db.select({ op: boardOpsTable.op }).from(boardOpsTable).where(eq(boardOpsTable.lectureId, lecture.id)).orderBy(asc(boardOpsTable.seq));
  res.json(rows.map((r) => r.op as BoardOp));
});

/** The teacher's drawing, batched by the app every ~60 ms. */
router.post("/lectures/:id/board", async (req, res) => {
  const user = requireRole(req, "teacher");
  const lecture = await getLecture(uuidParam(req.params.id));
  assertOwner(user, lecture);
  const { ops } = parse(boardOpsSchema, req.body) as { ops: BoardOp[] };
  if (JSON.stringify(ops).length > 512_000) throw badRequest("التعديل ده كبير قوي");
  const durable = ops.filter((o) => !EPHEMERAL_OPS.has(o.op));
  if (durable.length) await db.insert(boardOpsTable).values(durable.map((op) => ({ lectureId: lecture.id, op })));
  publish(lecture.id, { type: "board", ops });
  res.json({ ok: true });
});

// ---------------------------------------------------------------- recordings

/** A teacher can attach a recording link by hand (e.g. when recording is off). */
router.post("/lectures/:id/recording", async (req, res) => {
  const user = requireRole(req, "teacher", "admin");
  const lecture = await getLecture(uuidParam(req.params.id));
  assertOwner(user, lecture);
  const { url } = parse(recordingInputSchema, req.body);
  const [rec] = await db
    .insert(recordingsTable)
    .values({ lectureId: lecture.id, provider: "manual", status: "ready", url, readyAt: new Date() })
    .returning();
  await announceRecording(lecture.id);
  res.status(201).json(toRecording(rec!, true));
});

export async function announceRecording(lectureId: string) {
  const lecture = await getLecture(lectureId);
  const rec = await db.query.recordingsTable.findFirst({
    where: and(eq(recordingsTable.lectureId, lectureId), eq(recordingsTable.status, "ready")),
  });
  if (rec) publish(lectureId, { type: "recording", recording: toRecording(rec, true) });
  const ids = await bookedStudentIds(lectureId);
  if (!ids.length) return;
  await notify(ids, { kind: "recording", title: "التسجيل جاهز 🎬", body: lecture.title, link: `/lectures/${lectureId}` });
  const students = await db.select().from(usersTable).where(inArray(usersTable.id, ids));
  void sendRecordingReady(students, lecture);
}

export default router;
