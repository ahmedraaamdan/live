/** The administrators' view of accounts: who they are, and how far each one got. */
import { and, count, desc, eq, inArray, isNull, min, sql } from "drizzle-orm";
import { attendanceTable, bookingsTable, db, lecturesTable, parentLinksTable, sessionsTable, studentProfilesTable, teacherProfilesTable, teacherVerificationsTable, usersTable, walletEntriesTable, type User } from "@workspace/db";
import { ACTIVE_TEACHER_DAYS, ACTIVE_TEACHER_MIN_STUDENTS, ROLE_LABELS, USER_STEP_LABELS, gradeLabel, subjectLabel, type AdminUserDTO, type Role, type UserStepKey } from "@workspace/live-core";
import { toUser } from "./dto";
import type { XlsxSheet } from "./xlsx";

export const ADMIN_USERS_LIMIT = 5000;

/** A readable device from a browser's user agent; in-app browsers matter because Google sign-in fails there. */
export function deviceLabel(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;
  const device = /iphone|ipad/i.test(userAgent) ? "آيفون" : /android/i.test(userAgent) ? "أندرويد" : /windows/i.test(userAgent) ? "ويندوز" : /macintosh/i.test(userAgent) ? "ماك" : "جهاز آخر";
  const app = /FBAN|FBAV|FB_IAB|FBIOS/i.test(userAgent) ? "فيسبوك" : /instagram/i.test(userAgent) ? "إنستجرام" : /whatsapp/i.test(userAgent) ? "واتساب" : /tiktok|musical_ly/i.test(userAgent) ? "تيك توك" : /; wv\)/i.test(userAgent) ? "تطبيق" : null;
  return app ? `${device} · من جوه ${app}` : device;
}

interface Facts {
  firstLecture?: Date | null;
  firstLive?: Date | null;
  verification?: { status: string; submittedAt: Date; reviewedAt: Date | null } | null;
  firstPaidBooking?: Date | null;
  firstPaidClass?: Date | null;
  firstBooking?: Date | null;
  firstAttendance?: Date | null;
  linkedChildAt?: Date | null;
}

/** Every step this account reached, oldest first. The last one is how far it got. */
export function userTimeline(user: Pick<User, "role" | "createdAt">, facts: Facts): Array<{ key: UserStepKey; at: string }> {
  const steps: Array<[UserStepKey, Date | null | undefined]> = [[user.role === "admin" ? "none" : "signed_up", user.createdAt]];
  if (user.role === "teacher") {
    const v = facts.verification;
    steps.push(["lecture_created", facts.firstLecture], ["went_live", facts.firstLive]);
    if (v) steps.push(["verification_sent", v.submittedAt]);
    if (v?.status === "needs_changes") steps.push(["verification_changes", v.reviewedAt ?? v.submittedAt]);
    if (v?.status === "rejected") steps.push(["verification_rejected", v.reviewedAt ?? v.submittedAt]);
    if (v?.status === "approved") steps.push(["verified", v.reviewedAt ?? v.submittedAt]);
    steps.push(["paid_booking", facts.firstPaidBooking], ["paid_class", facts.firstPaidClass]);
  }
  if (user.role === "student") steps.push(["booked", facts.firstBooking], ["attended", facts.firstAttendance]);
  if (user.role === "parent") steps.push(["linked_child", facts.linkedChildAt]);
  return steps.filter((s): s is [UserStepKey, Date] => Boolean(s[1])).map(([key, at]) => ({ key, at: at.toISOString() }));
}

export async function loadAdminUsers(filter: { ids?: string[]; role?: Role } = {}): Promise<{ rows: AdminUserDTO[]; facts: Map<string, Facts> }> {
  const users = await db
    .select()
    .from(usersTable)
    .where(and(isNull(usersTable.deletedAt), filter.role ? eq(usersTable.role, filter.role) : undefined, filter.ids ? inArray(usersTable.id, filter.ids) : undefined))
    .orderBy(desc(usersTable.createdAt))
    .limit(ADMIN_USERS_LIMIT);
  if (users.length === 0) return { rows: [], facts: new Map() };
  const ids = users.map((u) => u.id);
  const activeSince = new Date(Date.now() - ACTIVE_TEACHER_DAYS * 86_400_000);
  const paidBooking = and(eq(bookingsTable.status, "confirmed"), sql`${bookingsTable.pricePaidCents} > 0`);
  const [lectures, paid, active, bookings, attendance, links, verifications, balances, sessions, teachers, students] = await Promise.all([
    db
      .select({ id: lecturesTable.teacherId, n: sql<number>`count(*) filter (where ${lecturesTable.status} <> 'cancelled')`, first: sql<Date | null>`min(${lecturesTable.createdAt}) filter (where ${lecturesTable.status} <> 'cancelled')`, live: min(lecturesTable.liveStartedAt) })
      .from(lecturesTable)
      .where(inArray(lecturesTable.teacherId, ids))
      .groupBy(lecturesTable.teacherId),
    db
      .select({ id: lecturesTable.teacherId, booking: min(bookingsTable.confirmedAt), held: sql<Date | null>`min(${lecturesTable.liveEndedAt}) filter (where ${lecturesTable.status} = 'ended')` })
      .from(bookingsTable)
      .innerJoin(lecturesTable, eq(lecturesTable.id, bookingsTable.lectureId))
      .where(and(inArray(lecturesTable.teacherId, ids), paidBooking))
      .groupBy(lecturesTable.teacherId),
    db
      .selectDistinct({ id: lecturesTable.teacherId })
      .from(bookingsTable)
      .innerJoin(lecturesTable, eq(lecturesTable.id, bookingsTable.lectureId))
      .where(and(inArray(lecturesTable.teacherId, ids), paidBooking, eq(lecturesTable.status, "ended"), sql`${lecturesTable.liveEndedAt} > ${activeSince}`))
      .groupBy(lecturesTable.id, lecturesTable.teacherId)
      .having(sql`count(*) >= ${ACTIVE_TEACHER_MIN_STUDENTS}`),
    db
      .select({ id: bookingsTable.studentId, n: count(), first: min(bookingsTable.confirmedAt) })
      .from(bookingsTable)
      .where(and(inArray(bookingsTable.studentId, ids), eq(bookingsTable.status, "confirmed")))
      .groupBy(bookingsTable.studentId),
    db.select({ id: attendanceTable.studentId, first: min(attendanceTable.firstSeenAt) }).from(attendanceTable).where(inArray(attendanceTable.studentId, ids)).groupBy(attendanceTable.studentId),
    db.select({ id: parentLinksTable.parentId, first: min(parentLinksTable.createdAt) }).from(parentLinksTable).where(inArray(parentLinksTable.parentId, ids)).groupBy(parentLinksTable.parentId),
    db
      .select({ id: teacherVerificationsTable.teacherId, status: teacherVerificationsTable.status, submittedAt: teacherVerificationsTable.submittedAt, reviewedAt: teacherVerificationsTable.reviewedAt, phone: teacherVerificationsTable.phone })
      .from(teacherVerificationsTable)
      .where(inArray(teacherVerificationsTable.teacherId, ids)),
    db
      .select({ id: walletEntriesTable.teacherId, total: sql<number>`coalesce(sum(${walletEntriesTable.amountCents}), 0)` })
      .from(walletEntriesTable)
      .where(and(eq(walletEntriesTable.owner, "teacher"), inArray(walletEntriesTable.teacherId, ids), sql`${walletEntriesTable.status} <> 'void'`))
      .groupBy(walletEntriesTable.teacherId),
    db
      .select({ id: sessionsTable.userId, userAgent: sessionsTable.userAgent, at: sessionsTable.createdAt })
      .from(sessionsTable)
      .where(and(inArray(sessionsTable.userId, ids), isNull(sessionsTable.actorTokenHash)))
      .orderBy(desc(sessionsTable.createdAt)),
    db.select({ id: teacherProfilesTable.userId, subject: teacherProfilesTable.subject }).from(teacherProfilesTable).where(inArray(teacherProfilesTable.userId, ids)),
    db.select({ id: studentProfilesTable.userId, grade: studentProfilesTable.grade }).from(studentProfilesTable).where(inArray(studentProfilesTable.userId, ids)),
  ]);

  const lectureBy = new Map(lectures.map((x) => [x.id, x]));
  const paidBy = new Map(paid.map((x) => [x.id, x]));
  const activeSet = new Set(active.map((x) => x.id));
  const bookingBy = new Map(bookings.map((x) => [x.id, x]));
  const attendanceBy = new Map(attendance.map((x) => [x.id, x.first]));
  const linkBy = new Map(links.map((x) => [x.id, x.first]));
  const verificationBy = new Map(verifications.map((x) => [x.id, x]));
  const balanceBy = new Map(balances.map((x) => [x.id, Number(x.total)]));
  const deviceBy = new Map<string, string | null>();
  for (const s of sessions) if (!deviceBy.has(s.id)) deviceBy.set(s.id, deviceLabel(s.userAgent));
  const subjectBy = new Map(teachers.map((x) => [x.id, x.subject]));
  const gradeBy = new Map(students.map((x) => [x.id, x.grade]));
  // A raw sql`min()` comes back as text from the driver.
  const when = (value: Date | string | null | undefined) => (value ? new Date(value) : null);

  const factsBy = new Map<string, Facts>();
  const rows = users.map((u): AdminUserDTO => {
    const lecture = lectureBy.get(u.id);
    const pay = paidBy.get(u.id);
    const verification = verificationBy.get(u.id);
    const facts: Facts = {
      firstLecture: when(lecture?.first),
      firstLive: when(lecture?.live),
      verification: verification ?? null,
      firstPaidBooking: when(pay?.booking),
      firstPaidClass: when(pay?.held),
      firstBooking: when(bookingBy.get(u.id)?.first),
      firstAttendance: when(attendanceBy.get(u.id)),
      linkedChildAt: when(linkBy.get(u.id)),
    };
    factsBy.set(u.id, facts);
    const timeline = userTimeline(u, facts);
    // Steps can happen in any order (a trial class can follow verification), so rank decides, not date.
    const step = timeline[timeline.length - 1]!;
    const subject = subjectBy.get(u.id);
    const grade = gradeBy.get(u.id);
    return {
      ...toUser(u),
      phone: u.phone ?? verification?.phone ?? null,
      lectures: Number(lecture?.n ?? 0),
      bookings: Number(bookingBy.get(u.id)?.n ?? 0),
      suspended: u.suspended,
      lastSeenAt: u.lastSeenAt?.toISOString() ?? null,
      device: deviceBy.get(u.id) ?? null,
      detail: subject ? subjectLabel(subject) : grade ? gradeLabel(grade) : null,
      verification: u.role === "teacher" ? ((verification?.status ?? "not_submitted") as AdminUserDTO["verification"]) : null,
      step,
      active: activeSet.has(u.id),
      balanceCents: balanceBy.get(u.id) ?? 0,
    };
  });
  return { rows, facts: factsBy };
}

const VERIFICATION_LABELS: Record<NonNullable<AdminUserDTO["verification"]>, string> = { not_submitted: "لم يُرسل", pending: "قيد المراجعة", approved: "موثّق", rejected: "مرفوض", needs_changes: "يحتاج تعديل" };

export function usersSheet(rows: AdminUserDTO[]): XlsxSheet {
  return {
    name: "المستخدمين",
    columns: [
      { header: "الاسم", width: 26 },
      { header: "النوع", width: 12 },
      { header: "الموبايل", width: 16 },
      { header: "الإيميل", width: 32 },
      { header: "آخر خطوة", width: 20 },
      { header: "تاريخ آخر خطوة", width: 18 },
      { header: "التوثيق", width: 14 },
      { header: "مدرس نشط", width: 11 },
      { header: "المادة أو الصف", width: 18 },
      { header: "التسجيل", width: 18 },
      { header: "آخر دخول", width: 18 },
      { header: "الجهاز", width: 24 },
      { header: "الحصص", width: 9 },
      { header: "الحجوزات", width: 10 },
      { header: "الرصيد (جنيه)", width: 13 },
      { header: "الحالة", width: 10 },
    ],
    rows: rows.map((u) => [
      u.name,
      ROLE_LABELS[u.role],
      u.phone,
      u.email,
      USER_STEP_LABELS[u.step.key],
      new Date(u.step.at),
      u.verification ? VERIFICATION_LABELS[u.verification] : null,
      u.role === "teacher" ? (u.active ? "نعم" : "لا") : null,
      u.detail,
      new Date(u.createdAt),
      u.lastSeenAt ? new Date(u.lastSeenAt) : null,
      u.device,
      u.lectures,
      u.bookings,
      u.balanceCents / 100,
      u.suspended ? "موقوف" : "نشط",
    ]),
  };
}
