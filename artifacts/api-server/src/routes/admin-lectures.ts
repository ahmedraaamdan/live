import { Router } from "express";
import { and, asc, desc, eq, gt, inArray, isNotNull } from "drizzle-orm";
import { attendanceTable, bookingsTable, db, lectureMailJobsTable, lectureReminderDeliveriesTable, lecturesTable, usersTable } from "@workspace/db";
import { adminLectureFilterSchema, lectureMailDraftSchema, queueLectureMailSchema, type AdminLecturePage, type LectureMailProgress } from "@workspace/live-core";
import { z } from "zod/v4";
import { getLecture } from "../lib/access";
import { recordAdminAction } from "../lib/audit";
import { requireUser, roleGate } from "../lib/auth";
import { renderLectureMail } from "../lib/emails";
import { badRequest, conflict, forbidden, notFound, parse, uuidParam } from "../lib/http";
import { lectureMailRecipients } from "../lib/lecture-reminders";
import { processLectureMailJobs } from "../lib/lecture-mail-jobs";
import { enforce } from "../lib/rate-limit";

const router = Router();
router.use("/admin/lectures", roleGate("admin"), (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

const listQuery = z.object({
  filter: adminLectureFilterSchema.default("upcoming"),
  page: z.coerce.number().int().min(0).max(100_000).default(0),
});
const pageSize = 30;

router.get("/admin/lectures", async (req, res) => {
  const { filter, page } = parse(listQuery, req.query);
  const status = filter === "upcoming" ? ["scheduled", "live"] as const
    : filter === "ended" ? ["ended"] as const : ["draft", "cancelled"] as const;
  const rows = await db.select({
    id: lecturesTable.id,
    title: lecturesTable.title,
    curriculum: lecturesTable.curriculum,
    subject: lecturesTable.subject,
    grade: lecturesTable.grade,
    startsAt: lecturesTable.startsAt,
    durationMin: lecturesTable.durationMin,
    priceCents: lecturesTable.priceCents,
    currency: lecturesTable.currency,
    capacity: lecturesTable.capacity,
    status: lecturesTable.status,
    teacher: { id: usersTable.id, name: usersTable.name, email: usersTable.email, phone: usersTable.phone, suspended: usersTable.suspended },
    booked: db.$count(bookingsTable, and(eq(bookingsTable.lectureId, lecturesTable.id), eq(bookingsTable.status, "confirmed"))),
    pending: db.$count(bookingsTable, and(eq(bookingsTable.lectureId, lecturesTable.id), eq(bookingsTable.status, "pending_payment"))),
    attended: db.$count(attendanceTable, and(eq(attendanceTable.lectureId, lecturesTable.id), gt(attendanceTable.liveSeconds, 0))),
    remindersSent: db.$count(lectureReminderDeliveriesTable, and(
      eq(lectureReminderDeliveriesTable.lectureId, lecturesTable.id),
      eq(lectureReminderDeliveriesTable.startsAt, lecturesTable.startsAt),
      isNotNull(lectureReminderDeliveriesTable.sentAt),
    )),
  }).from(lecturesTable).innerJoin(usersTable, eq(usersTable.id, lecturesTable.teacherId))
    .where(inArray(lecturesTable.status, status))
    .orderBy(filter === "upcoming" ? asc(lecturesTable.startsAt) : desc(lecturesTable.startsAt), asc(lecturesTable.id))
    .limit(pageSize + 1).offset(page * pageSize);
  res.json({
    rows: rows.slice(0, pageSize).map((row) => ({ ...row, startsAt: row.startsAt.toISOString() })),
    hasMore: rows.length > pageSize,
  } satisfies AdminLecturePage);
});

router.post("/admin/lectures/:id/email/preview", async (req, res) => {
  const draft = parse(lectureMailDraftSchema, req.body);
  const lecture = await getLecture(uuidParam(req.params.id));
  const { teacher } = await lectureMailRecipients(lecture, false);
  if (!teacher) throw notFound();
  res.json({ html: renderLectureMail(lecture, teacher.name, draft).html });
});

router.post("/admin/lectures/:id/email", async (req, res) => {
  if (req.impersonation) throw forbidden();
  const actor = requireUser(req);
  const draft = parse(queueLectureMailSchema, req.body);
  const lectureId = uuidParam(req.params.id);
  const checkRequest = (job: typeof lectureMailJobsTable.$inferSelect) => {
    if (job.actorId !== actor.id || job.lectureId !== lectureId) throw conflict("الطلب ده مستخدم بالفعل");
  };
  const requestMatch = eq(lectureMailJobsTable.id, draft.requestId);
  const existing = await db.query.lectureMailJobsTable.findFirst({ where: requestMatch });
  if (existing) {
    checkRequest(existing);
    res.status(202).json({ id: draft.requestId });
    return;
  }
  enforce({ name: "admin-lecture-mail", max: 8, windowMs: 60_000 }, actor.id);
  const lecture = await getLecture(lectureId);
  const { teacher, students } = await lectureMailRecipients(lecture, draft.audience !== "teacher");
  if (!teacher) throw notFound();
  const recipients = [...(draft.audience !== "students" && !teacher.suspended ? [teacher] : []), ...students];
  if (!recipients.length) throw badRequest("مفيش مستلمين متاحين للاختيار ده");

  await db.transaction(async (tx) => {
    const inserted = await tx.insert(lectureMailJobsTable).values({
      id: draft.requestId, actorId: actor.id, lectureId: lecture.id, recipientIds: recipients.map((user) => user.id),
      subject: draft.subject, title: draft.title, message: draft.message,
    }).onConflictDoNothing().returning({ id: lectureMailJobsTable.id });
    if (inserted.length) {
      await recordAdminAction(tx, actor.id, "lecture_email_requested", lecture.id, `${draft.template} / ${draft.audience} / ${recipients.length}`);
    } else {
      const duplicate = await tx.query.lectureMailJobsTable.findFirst({ where: requestMatch });
      if (!duplicate) throw conflict("حصل تعارض في طلب الإرسال، جرّب تاني");
      checkRequest(duplicate);
    }
  });
  void processLectureMailJobs();
  res.status(202).json({ id: draft.requestId });
});

router.get("/admin/lectures/:id/email/:jobId", async (req, res) => {
  const job = await db.query.lectureMailJobsTable.findFirst({ where: and(
    eq(lectureMailJobsTable.id, uuidParam(req.params.jobId)),
    eq(lectureMailJobsTable.lectureId, uuidParam(req.params.id)),
    eq(lectureMailJobsTable.actorId, requireUser(req).id),
  ) });
  if (!job) throw notFound();
  res.json({ total: job.recipientIds.length, sent: job.sent, failed: job.processed - job.sent, done: Boolean(job.completedAt) } satisfies LectureMailProgress);
});

export default router;
