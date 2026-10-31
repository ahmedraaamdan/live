import { Router } from "express";
import { and, asc, count, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import {
  attendanceTable,
  bookingsTable,
  db,
  lectureVotesTable,
  lecturesTable,
  savedLecturesTable,
  studentProfilesTable,
  teacherFollowsTable,
  usersTable,
} from "@workspace/db";
import { VOTE_MIN_LIVE_SECONDS, VOTE_MIN_REPLAY_SECONDS, voteSchema, type FeedDTO, type FeedItem } from "@workspace/live-core";
import { getLecture } from "../lib/access";
import { requireRole } from "../lib/auth";
import { lectureDTOs } from "../lib/dto";
import { publish, viewerCount } from "../lib/events";
import { badRequest, forbidden, notFound, parse, uuidParam } from "../lib/http";
import { rank, type TeacherRecord } from "../lib/ranking";

const router = Router();

/** Seconds counted as "watched the class" for retention and attendee numbers. */
const ATTENDED_SECONDS = 300;

/**
 * The discovery feed: live classes and the next two weeks, from every
 * teacher, ranked (lib/ranking.ts). Personalised for a signed-in student;
 * anyone can read it.
 */
router.get("/feed", async (req, res) => {
  const viewer = req.user ?? null;
  const text = (key: string) => (typeof req.query[key] === "string" ? (req.query[key] as string).trim() : "");
  const subject = text("subject") || undefined;
  const gradeFilter = text("grade") || undefined;
  const price = text("price");
  const search = text("q").slice(0, 80);
  const onlyFollowing = text("following") === "1" && viewer?.role === "student";
  const limit = Math.min(Math.max(Number(text("limit")) || 30, 1), 120);
  const now = new Date();
  // Looking for something specific reaches further ahead than browsing.
  const horizon = new Date(now.getTime() + (search || onlyFollowing ? 60 : 14) * 86_400_000);
  const follows = viewer?.role === "student" ? await db.select({ id: teacherFollowsTable.teacherId }).from(teacherFollowsTable).where(eq(teacherFollowsTable.studentId, viewer.id)) : [];
  const following = new Set(follows.map((f) => f.id));
  if (onlyFollowing && following.size === 0) return void res.json({ live: [], upcoming: [], hasMore: false } satisfies FeedDTO);
  const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;

  const candidates = (
    await db
      .select({ l: lecturesTable })
      .from(lecturesTable)
      .innerJoin(usersTable, eq(usersTable.id, lecturesTable.teacherId))
      .where(
        and(
          eq(lecturesTable.listed, true),
          eq(usersTable.suspended, false),
          subject ? eq(lecturesTable.subject, subject) : undefined,
          gradeFilter ? eq(lecturesTable.grade, gradeFilter) : undefined,
          price === "free" ? eq(lecturesTable.priceCents, 0) : price === "paid" ? sql`${lecturesTable.priceCents} > 0` : undefined,
          search ? or(ilike(lecturesTable.title, pattern), ilike(usersTable.name, pattern)) : undefined,
          onlyFollowing ? inArray(lecturesTable.teacherId, [...following]) : undefined,
          or(
            eq(lecturesTable.status, "live"),
            and(eq(lecturesTable.status, "scheduled"), gte(lecturesTable.startsAt, new Date(now.getTime() - 10 * 60_000)), lte(lecturesTable.startsAt, horizon)),
          ),
        ),
      )
      .orderBy(asc(lecturesTable.startsAt))
      .limit(300)
  ).map((r) => r.l);
  if (candidates.length === 0) return void res.json({ live: [], upcoming: [], hasMore: false } satisfies FeedDTO);

  const ids = candidates.map((l) => l.id);
  const teacherIds = [...new Set(candidates.map((l) => l.teacherId))];

  const [votes, attend, seats, tVotes, tAttend, tCount] = await Promise.all([
    db
      .select({ id: lectureVotesTable.lectureId, likes: sql<number>`count(*) filter (where ${lectureVotesTable.value} > 0)`, dislikes: sql<number>`count(*) filter (where ${lectureVotesTable.value} < 0)` })
      .from(lectureVotesTable)
      .where(inArray(lectureVotesTable.lectureId, ids))
      .groupBy(lectureVotesTable.lectureId),
    db
      .select({
        id: attendanceTable.lectureId,
        attendees: sql<number>`count(*) filter (where ${attendanceTable.liveSeconds} + ${attendanceTable.replaySeconds} >= ${ATTENDED_SECONDS})`,
        watched: sql<number>`sum(${attendanceTable.liveSeconds} + ${attendanceTable.replaySeconds})`,
      })
      .from(attendanceTable)
      .where(inArray(attendanceTable.lectureId, ids))
      .groupBy(attendanceTable.lectureId),
    db
      .select({ id: bookingsTable.lectureId, n: count() })
      .from(bookingsTable)
      .where(and(inArray(bookingsTable.lectureId, ids), eq(bookingsTable.status, "confirmed")))
      .groupBy(bookingsTable.lectureId),
    // The teacher's record across lectures already given.
    db
      .select({ id: lecturesTable.teacherId, likes: sql<number>`count(*) filter (where ${lectureVotesTable.value} > 0)`, dislikes: sql<number>`count(*) filter (where ${lectureVotesTable.value} < 0)` })
      .from(lectureVotesTable)
      .innerJoin(lecturesTable, eq(lecturesTable.id, lectureVotesTable.lectureId))
      .where(and(inArray(lecturesTable.teacherId, teacherIds), eq(lecturesTable.status, "ended")))
      .groupBy(lecturesTable.teacherId),
    db
      .select({
        id: lecturesTable.teacherId,
        completion: sql<number>`avg(least(1.0, (${attendanceTable.liveSeconds} + ${attendanceTable.replaySeconds})::float / (${lecturesTable.durationMin} * 60)))`,
      })
      .from(attendanceTable)
      .innerJoin(lecturesTable, eq(lecturesTable.id, attendanceTable.lectureId))
      .where(and(inArray(lecturesTable.teacherId, teacherIds), eq(lecturesTable.status, "ended")))
      .groupBy(lecturesTable.teacherId),
    db
      .select({ id: lecturesTable.teacherId, n: count() })
      .from(lecturesTable)
      .where(and(inArray(lecturesTable.teacherId, teacherIds), eq(lecturesTable.status, "ended")))
      .groupBy(lecturesTable.teacherId),
  ]);

  // The viewer: their grade, and what (and whom) they've booked before.
  let grade: string | null = null;
  const subjectShare = new Map<string, number>();
  const followed = new Set<string>();
  if (viewer?.role === "student") {
    const profile = await db.query.studentProfilesTable.findFirst({ where: eq(studentProfilesTable.userId, viewer.id) });
    grade = profile?.grade ?? null;
    const history = await db
      .select({ subject: lecturesTable.subject, teacherId: lecturesTable.teacherId })
      .from(bookingsTable)
      .innerJoin(lecturesTable, eq(lecturesTable.id, bookingsTable.lectureId))
      .where(and(eq(bookingsTable.studentId, viewer.id), eq(bookingsTable.status, "confirmed")));
    for (const h of history) {
      subjectShare.set(h.subject, (subjectShare.get(h.subject) ?? 0) + 1 / history.length);
      followed.add(h.teacherId);
    }
  }

  const by = <T extends { id: string }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));
  const [V, A, S, TV, TA, TC] = [by(votes), by(attend), by(seats), by(tVotes), by(tAttend), by(tCount)];

  const ranked = candidates.map((l) => {
    const a = A.get(l.id);
    const attendees = Number(a?.attendees ?? 0);
    const watchedSecs = Number(a?.watched ?? 0);
    const teacher: TeacherRecord = {
      likes: Number(TV.get(l.teacherId)?.likes ?? 0),
      dislikes: Number(TV.get(l.teacherId)?.dislikes ?? 0),
      completion: TA.get(l.teacherId)?.completion != null ? Number(TA.get(l.teacherId)!.completion) : null,
      lectures: Number(TC.get(l.teacherId)?.n ?? 0),
    };
    const r = rank({
      live: l.status === "live",
      startsAt: l.startsAt,
      likes: Number(V.get(l.id)?.likes ?? 0),
      dislikes: Number(V.get(l.id)?.dislikes ?? 0),
      viewersNow: viewerCount(l.id),
      attendees,
      bookings: Number(S.get(l.id)?.n ?? 0),
      completion: attendees ? Math.min(1, watchedSecs / attendees / (l.durationMin * 60)) : null,
      teacher,
      gradeMatch: grade ? l.grade === grade : null,
      subjectAffinity: subjectShare.get(l.subject) ?? 0,
      followsTeacher: followed.has(l.teacherId) || following.has(l.teacherId),
    });
    return { l, r };
  });
  // Teachers the student chose to follow come first; the ranking orders the rest.
  ranked.sort((x, y) => Number(following.has(y.l.teacherId)) - Number(following.has(x.l.teacherId)) || y.r.score - x.r.score);

  const liveAll = ranked.filter((x) => x.l.status === "live");
  const upcomingAll = ranked.filter((x) => x.l.status !== "live");
  const live = liveAll.slice(0, limit);
  const upcoming = upcomingAll.slice(0, limit);
  const dtos = new Map((await lectureDTOs([...live, ...upcoming].map((x) => x.l), viewer)).map((d) => [d.id, d]));
  const item = (x: (typeof ranked)[number]): FeedItem => ({ lecture: dtos.get(x.l.id)!, reason: following.has(x.l.teacherId) ? "مدرس تتابعه" : x.r.reason, score: Math.round(x.r.score * 1000) / 1000 });
  const body: FeedDTO = { live: live.map(item), upcoming: upcoming.map(item), hasMore: liveAll.length > limit || upcomingAll.length > limit };
  res.json(body);
});

/** Follow a teacher: their classes come first in the student's feed. */
router.post("/teachers/:id/follow", async (req, res) => {
  const user = requireRole(req, "student");
  const teacherId = uuidParam(req.params.id);
  const teacher = await db.query.usersTable.findFirst({ where: and(eq(usersTable.id, teacherId), eq(usersTable.role, "teacher"), eq(usersTable.suspended, false)) });
  if (!teacher) throw notFound("ملف المدرس غير متاح");
  await db.insert(teacherFollowsTable).values({ studentId: user.id, teacherId }).onConflictDoNothing();
  res.json({ followed: true });
});

router.delete("/teachers/:id/follow", async (req, res) => {
  const user = requireRole(req, "student");
  await db.delete(teacherFollowsTable).where(and(eq(teacherFollowsTable.studentId, user.id), eq(teacherFollowsTable.teacherId, uuidParam(req.params.id))));
  res.json({ followed: false });
});

/** Keep a class for later, to come back and book it. */
router.post("/lectures/:id/save", async (req, res) => {
  const user = requireRole(req, "student");
  const lecture = await getLecture(uuidParam(req.params.id));
  if (lecture.status === "draft") throw notFound();
  await db.insert(savedLecturesTable).values({ studentId: user.id, lectureId: lecture.id }).onConflictDoNothing();
  res.json({ saved: true });
});

router.delete("/lectures/:id/save", async (req, res) => {
  const user = requireRole(req, "student");
  await db.delete(savedLecturesTable).where(and(eq(savedLecturesTable.studentId, user.id), eq(savedLecturesTable.lectureId, uuidParam(req.params.id))));
  res.json({ saved: false });
});

/** What the student kept and can still attend, soonest first. */
router.get("/me/saved", async (req, res) => {
  const user = requireRole(req, "student");
  const rows = await db
    .select({ l: lecturesTable })
    .from(savedLecturesTable)
    .innerJoin(lecturesTable, eq(lecturesTable.id, savedLecturesTable.lectureId))
    .where(and(eq(savedLecturesTable.studentId, user.id), inArray(lecturesTable.status, ["scheduled", "live"])))
    .orderBy(asc(lecturesTable.startsAt))
    .limit(60);
  res.json(await lectureDTOs(rows.map((r) => r.l), user));
});

/** Like (+1), dislike (−1) or clear (0). Only for students who watched enough. */
router.post("/lectures/:id/vote", async (req, res) => {
  const user = requireRole(req, "student");
  const lecture = await getLecture(uuidParam(req.params.id));
  const { value } = parse(voteSchema, req.body);
  const booking = await db.query.bookingsTable.findFirst({
    where: and(eq(bookingsTable.lectureId, lecture.id), eq(bookingsTable.studentId, user.id), eq(bookingsTable.status, "confirmed")),
  });
  if (!booking) throw forbidden("التقييم للي حضروا الحصة بس");
  const att = await db.query.attendanceTable.findFirst({
    where: and(eq(attendanceTable.lectureId, lecture.id), eq(attendanceTable.studentId, user.id)),
  });
  if (!att || (att.liveSeconds < VOTE_MIN_LIVE_SECONDS && att.replaySeconds < VOTE_MIN_REPLAY_SECONDS)) {
    throw badRequest("اتفرج على الحصة شوية الأول، وبعدين قيّمها", "watch_first");
  }
  if (value === 0) {
    await db.delete(lectureVotesTable).where(and(eq(lectureVotesTable.lectureId, lecture.id), eq(lectureVotesTable.studentId, user.id)));
  } else {
    await db
      .insert(lectureVotesTable)
      .values({ lectureId: lecture.id, studentId: user.id, value })
      .onConflictDoUpdate({ target: [lectureVotesTable.lectureId, lectureVotesTable.studentId], set: { value, updatedAt: new Date() } });
  }
  const [t] = await db
    .select({ likes: sql<number>`count(*) filter (where ${lectureVotesTable.value} > 0)`, dislikes: sql<number>`count(*) filter (where ${lectureVotesTable.value} < 0)` })
    .from(lectureVotesTable)
    .where(eq(lectureVotesTable.lectureId, lecture.id));
  const tally = { likes: Number(t?.likes ?? 0), dislikes: Number(t?.dislikes ?? 0) };
  publish(lecture.id, { type: "votes", ...tally });
  res.json({ ...tally, mine: value, canVote: true });
});

export default router;
