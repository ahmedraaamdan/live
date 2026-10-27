import { Router } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  attendanceTable,
  bookingsTable,
  db,
  lecturesTable,
  parentLinksTable,
  paymentsTable,
  studentProfilesTable,
  usersTable,
  type User,
} from "@workspace/db";
import { linkChildSchema, type ChildDetailDTO, type ChildSummaryDTO, type PaymentDTO, type PaymentMethod } from "@workspace/live-core";
import { childIds, isParentOf } from "../lib/access";
import { requireRole } from "../lib/auth";
import { lectureDTOs, toMini } from "../lib/dto";
import { forbidden, notFound, parse, uuidParam } from "../lib/http";
import { notify } from "../lib/notify";
import { studentAssignments } from "./assignments";

const router = Router();

/** A lecture counts as attended after 5 minutes live or 10 on the replay. */
const attended = (a?: { liveSeconds: number; replaySeconds: number }) => Boolean(a && (a.liveSeconds >= 300 || a.replaySeconds >= 600));

async function childReport(student: User, parent: User, full: boolean) {
  const profile = await db.query.studentProfilesTable.findFirst({ where: eq(studentProfilesTable.userId, student.id) });
  const lectures = (
    await db
      .select({ l: lecturesTable })
      .from(bookingsTable)
      .innerJoin(lecturesTable, eq(lecturesTable.id, bookingsTable.lectureId))
      .where(and(eq(bookingsTable.studentId, student.id), eq(bookingsTable.status, "confirmed")))
      .orderBy(desc(lecturesTable.startsAt))
  ).map((r) => r.l);
  const attendance = lectures.length
    ? await db
        .select()
        .from(attendanceTable)
        .where(and(eq(attendanceTable.studentId, student.id), inArray(attendanceTable.lectureId, lectures.map((l) => l.id))))
    : [];
  const attBy = new Map(attendance.map((a) => [a.lectureId, a]));
  const now = Date.now();
  const past = lectures.filter((l) => l.status === "ended" || (l.status !== "cancelled" && l.startsAt.getTime() + l.durationMin * 60_000 < now));
  const attendedCount = past.filter((l) => attended(attBy.get(l.id))).length;
  const assignments = await studentAssignments(student);
  const graded = assignments.filter((a) => a.mySubmission?.score != null);
  const avg = graded.length ? Math.round((graded.reduce((s, a) => s + a.mySubmission!.score! / a.maxScore, 0) / graded.length) * 100) : null;

  const dtos = await lectureDTOs(lectures, parent, { studentId: student.id });
  const upcoming = dtos.filter((l) => l.status === "live" || (l.status === "scheduled" && new Date(l.startsAt).getTime() + l.durationMin * 60_000 > now));
  const summary: ChildSummaryDTO = {
    student: { ...toMini(student), grade: profile?.grade ?? null },
    stats: {
      lecturesBooked: lectures.length,
      lecturesPast: past.length,
      lecturesAttended: attendedCount,
      attendanceRate: past.length ? attendedCount / past.length : null,
      minutesWatched: Math.round(attendance.reduce((s, a) => s + a.liveSeconds + a.replaySeconds, 0) / 60),
      assignmentsTotal: assignments.length,
      assignmentsSubmitted: assignments.filter((a) => a.mySubmission).length,
      avgScorePct: avg,
    },
    next: upcoming.at(-1) ?? null,
  };
  if (!full) return summary;

  const payments = await db
    .select({ p: paymentsTable, l: lecturesTable })
    .from(paymentsTable)
    .innerJoin(bookingsTable, eq(bookingsTable.id, paymentsTable.bookingId))
    .innerJoin(lecturesTable, eq(lecturesTable.id, bookingsTable.lectureId))
    .where(and(eq(paymentsTable.userId, student.id), inArray(paymentsTable.status, ["succeeded", "refunded"])))
    .orderBy(desc(paymentsTable.createdAt));
  const detail: ChildDetailDTO = {
    ...summary,
    lectures: dtos.map((l) => {
      const a = attBy.get(l.id);
      return { lecture: l, attendedSeconds: (a?.liveSeconds ?? 0) + (a?.replaySeconds ?? 0) };
    }),
    assignments,
    payments: payments.map(
      ({ p, l }): PaymentDTO => ({
        id: p.id,
        status: p.status,
        amountCents: p.amountCents,
        method: p.method as PaymentMethod | null,
        provider: p.provider,
        bookingId: p.bookingId,
        lectureId: l.id,
        lectureTitle: l.title,
        createdAt: p.createdAt.toISOString(),
      }),
    ),
  };
  return detail;
}

router.get("/parent/children", async (req, res) => {
  const user = requireRole(req, "parent");
  const ids = await childIds(user.id);
  const kids = ids.length ? await db.select().from(usersTable).where(inArray(usersTable.id, ids)) : [];
  res.json(await Promise.all(kids.map((k) => childReport(k, user, false))));
});

router.post("/parent/children", async (req, res) => {
  const user = requireRole(req, "parent");
  const { code } = parse(linkChildSchema, req.body);
  const profile = await db.query.studentProfilesTable.findFirst({ where: eq(studentProfilesTable.linkCode, code.toUpperCase()) });
  if (!profile) throw notFound("الكود ده مش صحيح، خده من صفحة \"حسابي\" عند ابنك");
  await db.insert(parentLinksTable).values({ parentId: user.id, studentId: profile.userId }).onConflictDoNothing();
  await notify([profile.userId], { kind: "parent", title: `${user.name} بقى متابع حسابك كولي أمر`, link: "/me" });
  const student = await db.query.usersTable.findFirst({ where: eq(usersTable.id, profile.userId) });
  res.status(201).json(await childReport(student!, user, false));
});

router.get("/parent/children/:id", async (req, res) => {
  const user = requireRole(req, "parent");
  const id = uuidParam(req.params.id);
  if (!(await isParentOf(user.id, id))) throw forbidden();
  const student = await db.query.usersTable.findFirst({ where: eq(usersTable.id, id) });
  if (!student) throw notFound();
  res.json(await childReport(student, user, true));
});

export default router;
