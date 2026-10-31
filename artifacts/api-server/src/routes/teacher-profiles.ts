import { Router } from "express";
import { and, asc, count, desc, eq, gte, inArray, lt, or, sql } from "drizzle-orm";
import { db, usersTable, teacherFollowsTable, teacherProfilesTable, lecturesTable, lectureVotesTable, bookingsTable, teacherVerificationsTable } from "@workspace/db";
import type { TeacherProfileDTO, TeacherLecturesDTO } from "@workspace/live-core";
import { requireRole } from "../lib/auth";
import { badRequest, notFound, param, uuidParam } from "../lib/http";
import { lectureDTOs } from "../lib/dto";

const router = Router();
async function publicTeacher(id: string) {
  const row = await db.query.usersTable.findFirst({ where: and(eq(usersTable.id, id), eq(usersTable.role, "teacher"), eq(usersTable.suspended, false)) });
  if (!row) throw notFound("ملف المدرس غير متاح");
  return row;
}
router.get("/teachers/:id", async (req, res) => {
  const id = uuidParam(req.params.id);
  const teacher = await publicTeacher(id);
  const viewer = req.user;
  const [profile, [votes], [lessons], [students], verification, [followers], mine] = await Promise.all([
    db.query.teacherProfilesTable.findFirst({ where: eq(teacherProfilesTable.userId, id) }),
    db.select({ likes: sql<number>`count(*) filter (where ${lectureVotesTable.value} = 1)`, dislikes: sql<number>`count(*) filter (where ${lectureVotesTable.value} = -1)`, raters: sql<number>`count(distinct ${lectureVotesTable.studentId})` })
      .from(lectureVotesTable).innerJoin(lecturesTable, eq(lecturesTable.id, lectureVotesTable.lectureId))
      .where(and(eq(lecturesTable.teacherId, id), inArray(lecturesTable.status, ["live", "ended", "scheduled"]))),
    db.select({ n: count() }).from(lecturesTable).where(and(eq(lecturesTable.teacherId, id), eq(lecturesTable.status, "ended"))),
    db.select({ n: sql<number>`count(distinct ${bookingsTable.studentId})` }).from(bookingsTable).innerJoin(lecturesTable, eq(lecturesTable.id, bookingsTable.lectureId)).where(and(eq(lecturesTable.teacherId, id), eq(bookingsTable.status, "confirmed"))),
    db.query.teacherVerificationsTable.findFirst({ where: eq(teacherVerificationsTable.teacherId, id) }),
    db.select({ n: count() }).from(teacherFollowsTable).where(eq(teacherFollowsTable.teacherId, id)),
    viewer?.role === "student" ? db.query.teacherFollowsTable.findFirst({ where: and(eq(teacherFollowsTable.studentId, viewer.id), eq(teacherFollowsTable.teacherId, id)) }) : undefined,
  ]);
  const likes = Number(votes?.likes ?? 0), dislikes = Number(votes?.dislikes ?? 0), total = likes + dislikes;
  const body: TeacherProfileDTO = {
    teacher: { id, followed: Boolean(mine), verified: verification?.status === "approved", name: teacher.name, avatarUrl: teacher.avatarUrl, headline: profile?.headline ?? null, subject: profile?.subject ?? null, bio: profile?.bio ?? "", experience: profile?.experience ?? "", socialLinks: profile?.socialLinks ?? [], certificates: profile?.certificates ?? [] },
    rating: { likes, dislikes, total, positivePercent: total ? Math.round(likes / total * 100) : null, raters: Number(votes?.raters ?? 0) },
    stats: { completedLessons: Number(lessons?.n ?? 0), students: Number(students?.n ?? 0), followers: Number(followers?.n ?? 0) },
  };
  res.json(body);
});
router.get("/teachers/:id/lectures", async (req, res) => {
  const id = uuidParam(req.params.id);
  await publicTeacher(id);
  const period = param(req.query.period as string) || "upcoming";
  if (!["upcoming", "past"].includes(period)) throw badRequest("اختر حصصًا قادمة أو سابقة");
  const offset = Number(req.query.offset ?? 0);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) throw badRequest("رقم الصفحة غير صالح");
  const endsAt = sql`${lecturesTable.startsAt} + ${lecturesTable.durationMin} * interval '1 minute'`;
  const active = and(inArray(lecturesTable.status, ["scheduled", "live"]), or(eq(lecturesTable.status, "live"), sql`${endsAt} > ${new Date()}`));
  const past = or(eq(lecturesTable.status, "ended"), and(eq(lecturesTable.status, "scheduled"), sql`${endsAt} <= ${new Date()}`));
  const rows = await db.select().from(lecturesTable).where(and(eq(lecturesTable.teacherId, id), eq(lecturesTable.listed, true), period === "upcoming" ? active : past)).orderBy(period === "upcoming" ? asc(lecturesTable.startsAt) : desc(lecturesTable.startsAt), asc(lecturesTable.id)).limit(13).offset(offset);
  const body: TeacherLecturesDTO = { items: await lectureDTOs(rows.slice(0, 12), req.user ?? null), nextOffset: rows.length > 12 ? offset + 12 : null };
  res.json(body);
});
router.get("/teacher/calendar", async (req, res) => {
  const user = requireRole(req, "teacher");
  const from = new Date(param(req.query.from as string)), to = new Date(param(req.query.to as string));
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from || to.getTime() - from.getTime() > 35 * 86400000) throw badRequest("اختر فترة صحيحة لا تتجاوز 35 يومًا");
  const rows = await db.select().from(lecturesTable).where(and(eq(lecturesTable.teacherId, user.id), lt(lecturesTable.startsAt, to), sql`${lecturesTable.startsAt} + ${lecturesTable.durationMin} * interval '1 minute' > ${from}`, inArray(lecturesTable.status, ["draft", "scheduled", "live", "ended"]))).orderBy(asc(lecturesTable.startsAt)).limit(500);
  res.json(await lectureDTOs(rows, user));
});
export default router;
