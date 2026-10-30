import { isSuperAdmin } from "./auth";
/** Database rows → the response shapes in @workspace/live-core. */
import { and, count, desc, eq, inArray, sql, sum } from "drizzle-orm";
import {
  attendanceTable,
  bookingsTable,
  db,
  lectureVotesTable,
  notificationsTable,
  parentLinksTable,
  recordingsTable,
  studentProfilesTable,
  teacherProfilesTable,
  uploadsTable,
  usersTable,
  type Lecture,
  type Payout,
  type Recording,
  type Upload,
  type User,
} from "@workspace/db";
import type {
  LectureDTO,
  MeDTO,
  PayoutDTO,
  PayoutMethod,
  PersonMini,
  RecordingDTO,
  UploadDTO,
  UserDTO,
} from "@workspace/live-core";
import { VOTE_MIN_LIVE_SECONDS, VOTE_MIN_REPLAY_SECONDS, splitBooking } from "@workspace/live-core";
import { env } from "./env";
import { viewerCount } from "./events";

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export function toUser(u: User): UserDTO {
  return { id: u.id, role: u.role, name: u.name, email: u.email, phone: u.phone, avatarUrl: u.avatarUrl, createdAt: u.createdAt.toISOString() };
}

export const toMini = (u: Pick<User, "id" | "name" | "avatarUrl">): PersonMini => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl });

export async function loadMe(user: User, impersonation?: { actor: User }): Promise<MeDTO> {
  const [teacher, student, unread] = await Promise.all([
    user.role === "teacher" ? db.query.teacherProfilesTable.findFirst({ where: eq(teacherProfilesTable.userId, user.id) }) : undefined,
    user.role === "student" ? db.query.studentProfilesTable.findFirst({ where: eq(studentProfilesTable.userId, user.id) }) : undefined,
    db
      .select({ n: count() })
      .from(notificationsTable)
      .where(and(eq(notificationsTable.userId, user.id), sql`${notificationsTable.readAt} is null`)),
  ]);
  let parents: PersonMini[] = [];
  if (student) {
    const rows = await db
      .select({ id: usersTable.id, name: usersTable.name, avatarUrl: usersTable.avatarUrl })
      .from(parentLinksTable)
      .innerJoin(usersTable, eq(usersTable.id, parentLinksTable.parentId))
      .where(eq(parentLinksTable.studentId, user.id));
    parents = rows.map(toMini);
  }
  return {
    isSuperAdmin: !impersonation && isSuperAdmin(user),
    impersonation: impersonation ? { actorId: impersonation.actor.id, actorName: impersonation.actor.name } : null,
    user: toUser(user),
    teacher: teacher ? { bio: teacher.bio, headline: teacher.headline, subject: teacher.subject, experience: teacher.experience, socialLinks: teacher.socialLinks, certificates: teacher.certificates } : null,
    student: student ? { grade: student.grade, parentEmail: student.parentEmail, linkCode: student.linkCode, parents } : null,
    unreadNotifications: Number(unread[0]?.n ?? 0),
  };
}

export function toRecording(r: Recording, canWatch: boolean): RecordingDTO {
  return { id: r.id, status: r.status, url: canWatch ? r.url : null, durationSec: r.durationSec, createdAt: r.createdAt.toISOString() };
}

export function toUpload(u: Upload): UploadDTO {
  return { id: u.id, url: `${env.apiUrl}/api/uploads/${u.id}`, filename: u.filename, mime: u.mime, size: u.size };
}

export async function uploadsById(ids: string[]): Promise<Map<string, UploadDTO>> {
  if (ids.length === 0) return new Map();
  const rows = await db.select().from(uploadsTable).where(inArray(uploadsTable.id, ids));
  return new Map(rows.map((r) => [r.id, toUpload(r)]));
}

export function toPayout(p: Payout, teacher?: PersonMini | null): PayoutDTO {
  return {
    id: p.id,
    amountCents: p.amountCents,
    method: p.method as PayoutMethod,
    account: p.account,
    status: p.status,
    adminNote: p.adminNote,
    createdAt: p.createdAt.toISOString(),
    processedAt: iso(p.processedAt),
    teacher: teacher ?? null,
  };
}

export interface LectureViewOpts {
  /** Whose booking to attach: the viewer (default) or a parent's child. */
  studentId?: string;
}

/** Batched: one query per related table, whatever the number of lectures. */
export async function lectureDTOs(lectures: Lecture[], viewer: User | null, opts: LectureViewOpts = {}): Promise<LectureDTO[]> {
  if (lectures.length === 0) return [];
  const ids = lectures.map((l) => l.id);
  const teacherIds = [...new Set(lectures.map((l) => l.teacherId))];
  const studentId = opts.studentId ?? (viewer?.role === "student" ? viewer.id : undefined);

  const [teachers, seats, mine, recs, votes, myVotes, myAttendance] = await Promise.all([
    db
      .select({ id: usersTable.id, name: usersTable.name, avatarUrl: usersTable.avatarUrl, headline: teacherProfilesTable.headline, subject: teacherProfilesTable.subject })
      .from(usersTable)
      .leftJoin(teacherProfilesTable, eq(teacherProfilesTable.userId, usersTable.id))
      .where(inArray(usersTable.id, teacherIds)),
    db
      .select({ lectureId: bookingsTable.lectureId, n: count() })
      .from(bookingsTable)
      .where(and(inArray(bookingsTable.lectureId, ids), inArray(bookingsTable.status, ["confirmed", "pending_payment"])))
      .groupBy(bookingsTable.lectureId),
    studentId
      ? db
          .select({ lectureId: bookingsTable.lectureId, id: bookingsTable.id, status: bookingsTable.status })
          .from(bookingsTable)
          .where(and(eq(bookingsTable.studentId, studentId), inArray(bookingsTable.lectureId, ids)))
      : Promise.resolve([]),
    db.select().from(recordingsTable).where(inArray(recordingsTable.lectureId, ids)).orderBy(desc(recordingsTable.createdAt)),
    db
      .select({
        lectureId: lectureVotesTable.lectureId,
        likes: sql<number>`count(*) filter (where ${lectureVotesTable.value} > 0)`,
        dislikes: sql<number>`count(*) filter (where ${lectureVotesTable.value} < 0)`,
      })
      .from(lectureVotesTable)
      .where(inArray(lectureVotesTable.lectureId, ids))
      .groupBy(lectureVotesTable.lectureId),
    viewer?.role === "student"
      ? db
          .select({ lectureId: lectureVotesTable.lectureId, value: lectureVotesTable.value })
          .from(lectureVotesTable)
          .where(and(eq(lectureVotesTable.studentId, viewer.id), inArray(lectureVotesTable.lectureId, ids)))
      : Promise.resolve([]),
    viewer?.role === "student"
      ? db
          .select({ lectureId: attendanceTable.lectureId, live: attendanceTable.liveSeconds, replay: attendanceTable.replaySeconds })
          .from(attendanceTable)
          .where(and(eq(attendanceTable.studentId, viewer.id), inArray(attendanceTable.lectureId, ids)))
      : Promise.resolve([]),
  ]);

  const owned = lectures.filter((l) => viewer && (viewer.role === "admin" || viewer.id === l.teacherId)).map((l) => l.id);
  const [statRows, attendRows] = owned.length
    ? await Promise.all([
        db
          .select({ lectureId: bookingsTable.lectureId, n: count(), revenue: sum(bookingsTable.pricePaidCents) })
          .from(bookingsTable)
          .where(and(inArray(bookingsTable.lectureId, owned), eq(bookingsTable.status, "confirmed")))
          .groupBy(bookingsTable.lectureId),
        db
          .select({ lectureId: attendanceTable.lectureId, n: count() })
          .from(attendanceTable)
          .where(inArray(attendanceTable.lectureId, owned))
          .groupBy(attendanceTable.lectureId),
      ])
    : [[], []];

  const teacherById = new Map(teachers.map((t) => [t.id, t]));
  const seatsBy = new Map(seats.map((s) => [s.lectureId, Number(s.n)]));
  const mineBy = new Map(mine.map((m) => [m.lectureId, m]));
  const recBy = new Map<string, Recording>();
  for (const r of recs) {
    const cur = recBy.get(r.lectureId);
    // Prefer a ready recording over a newer one still processing.
    if (!cur || (cur.status !== "ready" && r.status === "ready")) recBy.set(r.lectureId, r);
  }
  const statBy = new Map(statRows.map((s) => [s.lectureId, s]));
  const attendBy = new Map(attendRows.map((a) => [a.lectureId, Number(a.n)]));
  const votesBy = new Map(votes.map((v) => [v.lectureId, v]));
  const myVoteBy = new Map(myVotes.map((v) => [v.lectureId, v.value]));
  const myAttBy = new Map(myAttendance.map((a) => [a.lectureId, a]));

  return lectures.map((l) => {
    const t = teacherById.get(l.teacherId);
    const booking = mineBy.get(l.id);
    const isOwner = owned.includes(l.id);
    const canWatch = isOwner || booking?.status === "confirmed";
    const rec = recBy.get(l.id);
    const st = statBy.get(l.id);
    const revenue = Number(st?.revenue ?? 0);
    return {
      id: l.id,
      code: l.code,
      title: l.title,
      subject: l.subject,
      grade: l.grade,
      description: l.description,
      coverUrl: l.coverUrl,
      startsAt: l.startsAt.toISOString(),
      durationMin: l.durationMin,
      priceCents: l.priceCents,
      capacity: l.capacity,
      status: l.status,
      listed: l.listed,
      liveStartedAt: iso(l.liveStartedAt),
      liveEndedAt: iso(l.liveEndedAt),
      teacher: { id: l.teacherId, name: t?.name ?? "", avatarUrl: t?.avatarUrl ?? null, headline: t?.headline ?? null, subject: t?.subject ?? null },
      seatsTaken: seatsBy.get(l.id) ?? 0,
      booking: booking ? { id: booking.id, status: booking.status } : null,
      recording: rec ? toRecording(rec, canWatch) : null,
      votes: {
        likes: Number(votesBy.get(l.id)?.likes ?? 0),
        dislikes: Number(votesBy.get(l.id)?.dislikes ?? 0),
        mine: (Math.sign(myVoteBy.get(l.id) ?? 0) as -1 | 0 | 1),
        canVote:
          booking?.status === "confirmed" &&
          Boolean(myAttBy.get(l.id) && (myAttBy.get(l.id)!.live >= VOTE_MIN_LIVE_SECONDS || myAttBy.get(l.id)!.replay >= VOTE_MIN_REPLAY_SECONDS)),
      },
      viewersNow: l.status === "live" ? viewerCount(l.id) : 0,
      stats: isOwner
        ? { bookings: Number(st?.n ?? 0), revenueCents: revenue, teacherCents: splitBooking(revenue, env.feeBps).teacherCents, attendees: attendBy.get(l.id) ?? 0 }
        : null,
    };
  });
}

export async function lectureDTO(l: Lecture, viewer: User | null, opts?: LectureViewOpts): Promise<LectureDTO> {
  const [dto] = await lectureDTOs([l], viewer, opts);
  return dto!;
}
