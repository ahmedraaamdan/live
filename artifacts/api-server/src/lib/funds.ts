/**
 * What happens to a finished lecture's earnings. After the hold they become
 * withdrawable only if the class really ran; otherwise, or if a student reports a
 * problem, they wait for an administrator, who releases them or refunds students.
 */
import { and, count, eq, gte, inArray, isNull } from "drizzle-orm";
import { attendanceTable, bookingsTable, db, lectureReportsTable, lecturesTable, walletEntriesTable, type Lecture, type User } from "@workspace/db";
import { FUNDS_MIN_ATTENDED_SECONDS, FUNDS_MIN_LIVE_SHARE, FUNDS_REVIEW_LABELS, type FundsReviewReason, type ReportReason } from "@workspace/live-core";
import { canReportLecture } from "./access";
import { recordAdminAction } from "./audit";
import { parentsOf, refundBooking, refundLecture } from "./bookings";
import { badRequest, conflict, notFound } from "./http";
import { releaseLectureFunds, type Tx } from "./ledger";
import { notify, notifyAdmins } from "./notify";

async function holdReason(tx: Tx, lecture: Lecture): Promise<FundsReviewReason | null> {
  const liveMs = lecture.liveStartedAt && lecture.liveEndedAt ? lecture.liveEndedAt.getTime() - lecture.liveStartedAt.getTime() : 0;
  if (liveMs < lecture.durationMin * 60_000 * FUNDS_MIN_LIVE_SHARE) return "short_live";
  const [watched] = await tx
    .select({ n: count() })
    .from(attendanceTable)
    .where(and(eq(attendanceTable.lectureId, lecture.id), gte(attendanceTable.liveSeconds, FUNDS_MIN_ATTENDED_SECONDS)));
  return Number(watched?.n) ? null : "no_attendance";
}

async function announceHold(lecture: Lecture, reason: FundsReviewReason) {
  await notify([lecture.teacherId], { kind: "funds", title: "فلوس الحصة تحت المراجعة", body: `${lecture.title}: ${FUNDS_REVIEW_LABELS[reason]}`, link: `/lectures/${lecture.id}` });
  await notifyAdmins({ kind: "funds", title: "حصة تحتاج إلى قرار في فلوسها", body: `${lecture.title}: ${FUNDS_REVIEW_LABELS[reason]}`, link: "/admin" });
}

/** Called once a lecture's hold has passed. Releases or holds in one step, so a crash cannot strand money. */
export async function settleLectureFunds(lectureId: string) {
  const outcome = await db.transaction(async (tx) => {
    const [lecture] = await tx.select().from(lecturesTable).where(eq(lecturesTable.id, lectureId)).for("update");
    if (!lecture || lecture.status !== "ended" || lecture.fundsReleasedAt || lecture.fundsReviewedAt || lecture.fundsReviewReason) return null;
    const [held] = await tx
      .select({ n: count() })
      .from(walletEntriesTable)
      .where(and(eq(walletEntriesTable.lectureId, lectureId), eq(walletEntriesTable.status, "pending"), inArray(walletEntriesTable.kind, ["sale", "commission"])));
    const now = new Date();
    // A free class, or one with nothing left to pay out, has nothing to decide or announce.
    if (!Number(held?.n)) {
      await tx.update(lecturesTable).set({ fundsReleasedAt: now }).where(eq(lecturesTable.id, lectureId));
      return null;
    }
    const reason = await holdReason(tx, lecture);
    if (reason) {
      await tx.update(lecturesTable).set({ fundsReviewReason: reason, updatedAt: now }).where(eq(lecturesTable.id, lectureId));
      return { lecture, reason };
    }
    await releaseLectureFunds(lectureId, tx);
    await tx.update(lecturesTable).set({ fundsReleasedAt: now }).where(eq(lecturesTable.id, lectureId));
    return { lecture, reason: null };
  });
  if (!outcome) return;
  if (outcome.reason) await announceHold(outcome.lecture, outcome.reason);
  else await notify([outcome.lecture.teacherId], { kind: "funds", title: "فلوس حصة بقت متاحة للسحب 💰", body: outcome.lecture.title, link: "/t/wallet" });
}

/** A student reports a problem during the hold; the earnings wait for a decision. */
export async function fileLectureReport(lectureId: string, student: User, reason: ReportReason, details: string) {
  const filed = await db.transaction(async (tx) => {
    const [lecture] = await tx.select().from(lecturesTable).where(eq(lecturesTable.id, lectureId)).for("update");
    if (!lecture) throw notFound();
    const booking = await tx.query.bookingsTable.findFirst({ where: and(eq(bookingsTable.lectureId, lectureId), eq(bookingsTable.studentId, student.id), eq(bookingsTable.status, "confirmed")) });
    if (!booking) throw badRequest("الإبلاغ متاح لمن حجز الحصة.");
    if (!canReportLecture(lecture)) throw badRequest("انتهت مهلة الإبلاغ عن هذه الحصة. يمكنك إرسال تذكرة للدعم.", "report_closed");
    const [row] = await tx.insert(lectureReportsTable).values({ lectureId, studentId: student.id, reason, details }).onConflictDoNothing().returning();
    if (!row) return null;
    const [flagged] = await tx
      .update(lecturesTable)
      .set({ fundsReviewReason: "reported", updatedAt: new Date() })
      .where(and(eq(lecturesTable.id, lectureId), isNull(lecturesTable.fundsReviewReason)))
      .returning();
    return flagged ?? null;
  });
  if (filed) await announceHold(filed, "reported");
}

/** An administrator's call on a held lecture: pay the teacher, or give students their money back. */
export async function decideLectureFunds(lectureId: string, actor: User, decision: "release" | "refund", note: string) {
  const lecture = await db.transaction(async (tx) => {
    const [current] = await tx.select().from(lecturesTable).where(eq(lecturesTable.id, lectureId)).for("update");
    if (!current) throw notFound();
    if (!current.fundsReviewReason || current.fundsReviewedAt || current.fundsReleasedAt) throw conflict("تم اتخاذ قرار في هذه الحصة بالفعل.", "already_decided");
    const now = new Date();
    if (decision === "release") await releaseLectureFunds(lectureId, tx);
    await tx
      .update(lecturesTable)
      .set({ fundsReviewedAt: now, fundsReviewedBy: actor.id, ...(decision === "release" ? { fundsReleasedAt: now } : {}), updatedAt: now })
      .where(eq(lecturesTable.id, lectureId));
    await tx
      .update(lectureReportsTable)
      .set({ status: decision === "release" ? "dismissed" : "refunded", resolvedAt: now, resolvedBy: actor.id })
      .where(and(eq(lectureReportsTable.lectureId, lectureId), eq(lectureReportsTable.status, "open")));
    await recordAdminAction(tx, actor.id, `funds.${decision}`, lectureId, note);
    return current;
  });
  if (decision === "release") {
    await notify([lecture.teacherId], { kind: "funds", title: "فلوس حصة بقت متاحة للسحب 💰", body: lecture.title, link: "/t/wallet" });
    return;
  }
  const studentIds = await refundLecture(lectureId, "قرار الإدارة بعد مراجعة الحصة", "administrator refund after review");
  const parents = await Promise.all([...new Set(studentIds)].map(parentsOf));
  const notice = { kind: "refund", title: "سنرد لك قيمة الحصة", body: `${lecture.title} — يمكنك متابعة حالة عملية الدفع من حسابك`, link: `/lectures/${lectureId}` };
  await notify(studentIds, notice);
  await notify(parents.flatMap((p) => p.ids), notice);
  await notify([lecture.teacherId], { kind: "funds", title: "قررت الإدارة رد قيمة الحصة للطلاب", body: note || lecture.title, link: `/lectures/${lectureId}` });
}

/** An administrator's call on one report. Once none are open, a held lecture goes back to the normal check. */
export async function resolveLectureReport(reportId: string, actor: User, decision: "refund" | "dismiss", note: string) {
  const report = await db.transaction(async (tx) => {
    const [current] = await tx.select().from(lectureReportsTable).where(eq(lectureReportsTable.id, reportId)).for("update");
    if (!current) throw notFound();
    if (current.status !== "open") throw conflict("تم اتخاذ قرار في هذا البلاغ بالفعل.", "already_decided");
    await tx.select({ id: lecturesTable.id }).from(lecturesTable).where(eq(lecturesTable.id, current.lectureId)).for("update");
    await tx.update(lectureReportsTable).set({ status: decision === "refund" ? "refunded" : "dismissed", resolvedAt: new Date(), resolvedBy: actor.id }).where(eq(lectureReportsTable.id, reportId));
    const [open] = await tx.select({ n: count() }).from(lectureReportsTable).where(and(eq(lectureReportsTable.lectureId, current.lectureId), eq(lectureReportsTable.status, "open")));
    if (!Number(open?.n)) await tx.update(lecturesTable).set({ fundsReviewReason: null, updatedAt: new Date() }).where(and(eq(lecturesTable.id, current.lectureId), eq(lecturesTable.fundsReviewReason, "reported")));
    await recordAdminAction(tx, actor.id, `report.${decision}`, reportId, note);
    return current;
  });
  if (decision === "refund") {
    const booking = await db.query.bookingsTable.findFirst({ where: and(eq(bookingsTable.lectureId, report.lectureId), eq(bookingsTable.studentId, report.studentId), eq(bookingsTable.status, "confirmed")) });
    if (booking) await refundBooking(booking.id, "قرار الإدارة بعد بلاغ الطالب", "administrator refund after report");
  }
  await notify([report.studentId], { kind: "report", title: decision === "refund" ? "قبلنا بلاغك وسنرد لك قيمة الحصة" : "راجعنا بلاغك عن الحصة", body: note, link: `/lectures/${report.lectureId}` });
}
