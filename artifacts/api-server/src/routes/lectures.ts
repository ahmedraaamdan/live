import { Router } from "express";
import { and, asc, count, desc, eq, gte, inArray, lt, or, sql } from "drizzle-orm";
import {
  assignmentsTable,
  attendanceTable,
  bookingsTable,
  db,
  lecturesTable,
  paymentsTable,
  studentProfilesTable,
  submissionsTable,
  usersTable,
  type Lecture,
} from "@workspace/db";
import { lectureInputSchema, splitBooking, type AttendanceDTO, type BookingDTO, type BookResult, type StudentHomeDTO, type TeacherDashboardDTO } from "@workspace/live-core";
import { assertOwner, bookedStudentIds, getLecture } from "../lib/access";
import { requireRole, requireUser } from "../lib/auth";
import { onBookingConfirmed, refundLecture } from "../lib/bookings";
import { shortCode } from "../lib/codes";
import { lectureDTO, lectureDTOs, toMini } from "../lib/dto";
import { sendLectureCancelled } from "../lib/emails";
import { env } from "../lib/env";
import { teacherBalances } from "../lib/ledger";
import { badRequest, conflict, notFound, param, parse, uuidParam } from "../lib/http";
import { logger } from "../lib/logger";
import { notify } from "../lib/notify";
import { provider } from "../lib/payments";

const router = Router();

/** Seats held by a pending payment are released after this long. */
export const PENDING_HOLD_MIN = 60;

const endsAt = (l: Lecture) => new Date(l.startsAt.getTime() + l.durationMin * 60_000);

async function uniqueLectureCode(): Promise<string> {
  for (;;) {
    const code = shortCode(7);
    if (!(await db.query.lecturesTable.findFirst({ where: eq(lecturesTable.code, code) }))) return code;
  }
}

// ---------------------------------------------------------------- lists

router.get("/lectures", async (req, res) => {
  const user = requireUser(req);
  const scope = String(req.query.scope ?? "all");
  const now = new Date();
  const timeFilter =
    scope === "upcoming"
      ? or(inArray(lecturesTable.status, ["live"]), and(inArray(lecturesTable.status, ["scheduled", "draft"]), gte(sql`${lecturesTable.startsAt} + make_interval(mins => ${lecturesTable.durationMin})`, now)))
      : scope === "past"
        ? or(inArray(lecturesTable.status, ["ended", "cancelled"]), and(eq(lecturesTable.status, "scheduled"), lt(sql`${lecturesTable.startsAt} + make_interval(mins => ${lecturesTable.durationMin})`, now)))
        : undefined;
  const order = scope === "past" ? desc(lecturesTable.startsAt) : asc(lecturesTable.startsAt);

  let rows: Lecture[];
  if (user.role === "teacher" || user.role === "admin") {
    rows = await db
      .select()
      .from(lecturesTable)
      .where(and(user.role === "teacher" ? eq(lecturesTable.teacherId, user.id) : undefined, timeFilter))
      .orderBy(order)
      .limit(200);
  } else if (user.role === "student") {
    rows = (
      await db
        .select({ l: lecturesTable })
        .from(bookingsTable)
        .innerJoin(lecturesTable, eq(lecturesTable.id, bookingsTable.lectureId))
        .where(and(eq(bookingsTable.studentId, user.id), eq(bookingsTable.status, "confirmed"), timeFilter))
        .orderBy(order)
        .limit(200)
    ).map((r) => r.l);
  } else {
    rows = [];
  }
  res.json(await lectureDTOs(rows, user));
});

router.get("/teacher/dashboard", async (req, res) => {
  const user = requireRole(req, "teacher");
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const upcoming = await db
    .select()
    .from(lecturesTable)
    .where(
      and(
        eq(lecturesTable.teacherId, user.id),
        or(eq(lecturesTable.status, "live"), and(eq(lecturesTable.status, "scheduled"), gte(sql`${lecturesTable.startsAt} + make_interval(mins => ${lecturesTable.durationMin})`, now))),
      ),
    )
    .orderBy(asc(lecturesTable.startsAt))
    .limit(10);
  const [month] = await db
    .select({ n: count(), revenue: sql<number>`coalesce(sum(${bookingsTable.pricePaidCents}), 0)` })
    .from(bookingsTable)
    .innerJoin(lecturesTable, eq(lecturesTable.id, bookingsTable.lectureId))
    .where(and(eq(lecturesTable.teacherId, user.id), eq(bookingsTable.status, "confirmed"), gte(bookingsTable.confirmedAt, monthStart)));
  const [students] = await db
    .select({ n: sql<number>`count(distinct ${bookingsTable.studentId})` })
    .from(bookingsTable)
    .innerJoin(lecturesTable, eq(lecturesTable.id, bookingsTable.lectureId))
    .where(and(eq(lecturesTable.teacherId, user.id), eq(bookingsTable.status, "confirmed")));
  const [toGrade] = await db
    .select({ n: count() })
    .from(submissionsTable)
    .innerJoin(assignmentsTable, eq(assignmentsTable.id, submissionsTable.assignmentId))
    .where(and(eq(assignmentsTable.teacherId, user.id), sql`${submissionsTable.gradedAt} is null`));
  const balances = await teacherBalances(user.id);
  const dtos = await lectureDTOs(upcoming, user);
  const body: TeacherDashboardDTO = {
    stats: {
      monthEarningsCents: splitBooking(Number(month?.revenue ?? 0), env.feeBps).teacherCents,
      availableCents: balances.availableCents,
      pendingCents: balances.pendingCents,
      upcomingCount: dtos.filter((l) => l.status !== "live").length,
      studentsCount: Number(students?.n ?? 0),
      monthBookings: Number(month?.n ?? 0),
      toGrade: Number(toGrade?.n ?? 0),
    },
    liveNow: dtos.find((l) => l.status === "live") ?? null,
    upcoming: dtos.filter((l) => l.status !== "live"),
  };
  res.json(body);
});

router.get("/student/home", async (req, res) => {
  const user = requireRole(req, "student");
  const now = new Date();
  const booked = (
    await db
      .select({ l: lecturesTable })
      .from(bookingsTable)
      .innerJoin(lecturesTable, eq(lecturesTable.id, bookingsTable.lectureId))
      .where(and(eq(bookingsTable.studentId, user.id), eq(bookingsTable.status, "confirmed")))
      .orderBy(asc(lecturesTable.startsAt))
  ).map((r) => r.l);
  const dtos = await lectureDTOs(booked, user);
  const live = dtos.filter((l) => l.status === "live");
  const upcoming = dtos.filter((l) => l.status === "scheduled" && new Date(l.startsAt).getTime() + l.durationMin * 60_000 > now.getTime());
  const recent = dtos.filter((l) => l.status === "ended").reverse().slice(0, 6);

  const { studentAssignments } = await import("./assignments");
  const pending = (await studentAssignments(user)).filter((a) => !a.mySubmission);
  const body: StudentHomeDTO = { liveNow: live, upcoming: upcoming.slice(0, 10), pendingAssignments: pending.slice(0, 10), recent };
  res.json(body);
});

// ---------------------------------------------------------------- one lecture

router.post("/lectures", async (req, res) => {
  const user = requireRole(req, "teacher");
  const input = parse(lectureInputSchema, req.body);
  const startsAt = new Date(input.startsAt);
  if (startsAt.getTime() < Date.now() - 5 * 60_000) throw badRequest("الميعاد ده فات، اختار ميعاد جاي");
  const [lecture] = await db
    .insert(lecturesTable)
    .values({
      teacherId: user.id,
      code: await uniqueLectureCode(),
      title: input.title,
      subject: input.subject,
      grade: input.grade,
      description: input.description,
      startsAt,
      durationMin: input.durationMin,
      priceCents: input.priceCents,
      capacity: input.capacity ?? null,
      listed: input.listed,
      status: input.publish ? "scheduled" : "draft",
    })
    .returning();
  res.status(201).json(await lectureDTO(lecture!, user));
});

/** The public booking page behind the shared link. No login needed. */
router.get("/l/:code", async (req, res) => {
  const code = param(req.params.code).toUpperCase();
  const lecture = await db.query.lecturesTable.findFirst({ where: eq(lecturesTable.code, code) });
  if (!lecture || lecture.status === "draft") throw notFound("اللينك ده مش شغال، اتأكد منه مع المدرس");
  res.json(await lectureDTO(lecture, req.user ?? null));
});

router.get("/lectures/:id", async (req, res) => {
  const user = requireUser(req);
  const lecture = await getLecture(uuidParam(req.params.id));
  // Anyone signed in can see a published lecture's page (it's shared publicly);
  // recordings and room access are gated separately.
  if (lecture.status === "draft") assertOwner(user, lecture);
  res.json(await lectureDTO(lecture, user));
});

router.patch("/lectures/:id", async (req, res) => {
  const user = requireRole(req, "teacher", "admin");
  const lecture = await getLecture(uuidParam(req.params.id));
  assertOwner(user, lecture);
  if (!["draft", "scheduled"].includes(lecture.status)) throw badRequest("مينفعش تعدّل حصة بدأت أو خلصت");
  const input = parse(lectureInputSchema, req.body);
  const [{ n }] = (await db
    .select({ n: count() })
    .from(bookingsTable)
    .where(and(eq(bookingsTable.lectureId, lecture.id), eq(bookingsTable.status, "confirmed")))) as [{ n: number }];
  if (Number(n) > 0 && input.priceCents !== lecture.priceCents) throw badRequest("فيه طلاب حجزوا، مينفعش تغيّر السعر دلوقتي");
  const [updated] = await db
    .update(lecturesTable)
    .set({
      title: input.title,
      subject: input.subject,
      grade: input.grade,
      description: input.description,
      startsAt: new Date(input.startsAt),
      durationMin: input.durationMin,
      priceCents: input.priceCents,
      capacity: input.capacity ?? null,
      listed: input.listed,
      status: input.publish ? "scheduled" : "draft",
      // A new time means a new reminder.
      reminderSentAt: new Date(input.startsAt).getTime() === lecture.startsAt.getTime() ? lecture.reminderSentAt : null,
      updatedAt: new Date(),
    })
    .where(eq(lecturesTable.id, lecture.id))
    .returning();
  res.json(await lectureDTO(updated!, user));
});

router.post("/lectures/:id/cancel", async (req, res) => {
  const user = requireRole(req, "teacher", "admin");
  const lecture = await getLecture(uuidParam(req.params.id));
  assertOwner(user, lecture);
  if (!["draft", "scheduled"].includes(lecture.status)) throw badRequest("مينفعش تلغي حصة بدأت أو خلصت");
  const [cancelled] = await db.update(lecturesTable).set({ status: "cancelled", updatedAt: new Date() }).where(eq(lecturesTable.id, lecture.id)).returning();
  const studentIds = await refundLecture(lecture.id);
  if (studentIds.length) {
    const students = await db.select().from(usersTable).where(inArray(usersTable.id, studentIds));
    await notify(studentIds, { kind: "cancelled", title: "اتلغت حصة", body: `${lecture.title} — الفلوس هترجعلك`, link: `/lectures/${lecture.id}` });
    void sendLectureCancelled(students, lecture);
  }
  res.json(await lectureDTO(cancelled!, user));
});

router.get("/lectures/:id/bookings", async (req, res) => {
  const user = requireRole(req, "teacher", "admin");
  const lecture = await getLecture(uuidParam(req.params.id));
  assertOwner(user, lecture);
  const rows = await db
    .select({ b: bookingsTable, u: usersTable, grade: studentProfilesTable.grade })
    .from(bookingsTable)
    .innerJoin(usersTable, eq(usersTable.id, bookingsTable.studentId))
    .leftJoin(studentProfilesTable, eq(studentProfilesTable.userId, usersTable.id))
    .where(and(eq(bookingsTable.lectureId, lecture.id), inArray(bookingsTable.status, ["confirmed", "refunded"])))
    .orderBy(desc(bookingsTable.confirmedAt));
  const body: BookingDTO[] = rows.map(({ b, u, grade }) => ({
    id: b.id,
    lectureId: b.lectureId,
    status: b.status,
    pricePaidCents: b.pricePaidCents,
    createdAt: b.createdAt.toISOString(),
    confirmedAt: b.confirmedAt?.toISOString() ?? null,
    student: { ...toMini(u), email: u.email, grade },
  }));
  res.json(body);
});

router.get("/lectures/:id/attendance", async (req, res) => {
  const user = requireRole(req, "teacher", "admin");
  const lecture = await getLecture(uuidParam(req.params.id));
  assertOwner(user, lecture);
  const ids = await bookedStudentIds(lecture.id);
  if (ids.length === 0) return void res.json([]);
  const [students, rows] = await Promise.all([
    db.select().from(usersTable).where(inArray(usersTable.id, ids)),
    db.select().from(attendanceTable).where(eq(attendanceTable.lectureId, lecture.id)),
  ]);
  const byStudent = new Map(rows.map((r) => [r.studentId, r]));
  const body: AttendanceDTO[] = students
    .map((s) => {
      const a = byStudent.get(s.id);
      return {
        student: toMini(s),
        liveSeconds: a?.liveSeconds ?? 0,
        replaySeconds: a?.replaySeconds ?? 0,
        firstSeenAt: a?.firstSeenAt.toISOString() ?? null,
        lastSeenAt: a?.lastSeenAt.toISOString() ?? null,
      };
    })
    .sort((x, y) => y.liveSeconds + y.replaySeconds - (x.liveSeconds + x.replaySeconds));
  res.json(body);
});

// ---------------------------------------------------------------- booking

router.post("/lectures/:id/book", async (req, res) => {
  const user = requireRole(req, "student");
  const lecture = await getLecture(uuidParam(req.params.id));
  if (!["scheduled", "live"].includes(lecture.status) || endsAt(lecture) < new Date()) {
    throw badRequest("الحجز مقفول للحصة دي");
  }

  const existing = await db.query.bookingsTable.findFirst({
    where: and(eq(bookingsTable.lectureId, lecture.id), eq(bookingsTable.studentId, user.id)),
  });
  if (existing?.status === "confirmed") {
    const body: BookResult = { booking: bookingDTO(existing), payment: null, checkoutUrl: null };
    return void res.json(body);
  }

  if (lecture.capacity) {
    const holdSince = new Date(Date.now() - PENDING_HOLD_MIN * 60_000);
    const [{ n }] = (await db
      .select({ n: count() })
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.lectureId, lecture.id),
          or(eq(bookingsTable.status, "confirmed"), and(eq(bookingsTable.status, "pending_payment"), gte(bookingsTable.createdAt, holdSince))),
          existing ? sql`${bookingsTable.id} <> ${existing.id}` : undefined,
        ),
      )) as [{ n: number }];
    if (Number(n) >= lecture.capacity) throw conflict("الأماكن خلصت في الحصة دي", "full");
  }

  const free = lecture.priceCents === 0;
  const values = { status: free ? ("confirmed" as const) : ("pending_payment" as const), pricePaidCents: lecture.priceCents, confirmedAt: free ? new Date() : null };
  const [booking] = existing
    ? await db.update(bookingsTable).set({ ...values, createdAt: new Date() }).where(eq(bookingsTable.id, existing.id)).returning()
    : await db.insert(bookingsTable).values({ lectureId: lecture.id, studentId: user.id, ...values }).returning();

  if (free) {
    void onBookingConfirmed(booking!.id);
    const body: BookResult = { booking: bookingDTO(booking!), payment: null, checkoutUrl: null };
    return void res.status(201).json(body);
  }

  const [payment] = await db
    .insert(paymentsTable)
    .values({ bookingId: booking!.id, userId: user.id, provider: provider.name, amountCents: lecture.priceCents })
    .returning();
  let checkout: { checkoutUrl: string; providerRef: string | null };
  try {
    checkout = await provider.createCheckout({ payment: payment!, lecture, payer: user });
  } catch (err) {
    logger.error({ err }, "createCheckout failed");
    await db.update(paymentsTable).set({ status: "failed" }).where(eq(paymentsTable.id, payment!.id));
    throw badRequest("بوابة الدفع مش متاحة دلوقتي، جرّب تاني بعد شوية", "gateway");
  }
  await db.update(paymentsTable).set({ providerRef: checkout.providerRef }).where(eq(paymentsTable.id, payment!.id));

  const body: BookResult = {
    booking: bookingDTO(booking!),
    payment: {
      id: payment!.id,
      status: "pending",
      amountCents: payment!.amountCents,
      method: null,
      provider: provider.name,
      bookingId: booking!.id,
      lectureId: lecture.id,
      lectureTitle: lecture.title,
      createdAt: payment!.createdAt.toISOString(),
    },
    checkoutUrl: checkout.checkoutUrl,
  };
  res.status(201).json(body);
});

function bookingDTO(b: typeof bookingsTable.$inferSelect): BookingDTO {
  return {
    id: b.id,
    lectureId: b.lectureId,
    status: b.status,
    pricePaidCents: b.pricePaidCents,
    createdAt: b.createdAt.toISOString(),
    confirmedAt: b.confirmedAt?.toISOString() ?? null,
    student: null,
  };
}

export default router;
