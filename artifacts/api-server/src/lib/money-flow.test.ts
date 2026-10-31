import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

test("no-shows, earnings review, reports, cancellations, payouts, tickets and discovery", async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../tmp");
  await mkdir(root, { recursive: true });
  const dir = await mkdtemp(path.join(root, "money-flow-test-"));
  Object.assign(process.env, { NODE_ENV: "test", PAYMENT_PROVIDER: "mock", ADMIN_EMAILS: "", SUPER_ADMIN_EMAILS: "owner@audit.gahez", SMTP_HOST: "", SMTP_USER: "", SMTP_PASS: "", LIVEKIT_URL: "", LOG_LEVEL: "silent", UPLOAD_DIR: path.join(dir, "uploads"), PAYOUT_HOLD_HOURS: "24", SCHEDULER: "off" });
  const database = await import("@workspace/db");
  const { initDb, usersTable, teacherProfilesTable, studentProfilesTable, parentLinksTable, userSecurityTable, verificationDocumentsTable, teacherVerificationsTable, lecturesTable, walletEntriesTable, bookingsTable, paymentsTable, notificationsTable, attendanceTable, payoutsTable, adminActionsTable, lectureReportsTable } = database;
  const { and, eq } = await import("drizzle-orm");
  await initDb({ migrationsFolder: path.resolve(root, "../lib/db/drizzle"), pgliteDir: dir });
  const { db } = database;
  const { createSession, hashPassword } = await import("./auth");
  const { newTotpSecret, sealSecret } = await import("./two-factor");
  const { cancelNoShows, releaseFunds } = await import("./scheduler");
  const { confirmPayment } = await import("./bookings");
  const { default: app } = await import("../app");
  const suffix = randomUUID().slice(0, 8);
  const passwordHash = await hashPassword("money-flow-password");
  const person = (role: "teacher" | "student" | "parent" | "admin", name: string, email = `${name}-${suffix}@audit.gahez`) => ({ role, name, email, passwordHash });
  const [teacher, unverified, student, classmate, third, parent, owner] = await db.insert(usersTable).values([person("teacher", "teacher"), person("teacher", "unverified"), person("student", "student"), person("student", "classmate"), person("student", "third"), person("parent", "parent"), person("admin", "owner", "owner@audit.gahez")]).returning();
  await db.insert(studentProfilesTable).values([student!, classmate!, third!].map((s, i) => ({ userId: s.id, linkCode: `C${i}${suffix}` })));
  await db.insert(parentLinksTable).values({ parentId: parent!.id, studentId: student!.id });
  await db.insert(teacherProfilesTable).values({ userId: teacher!.id });
  await db.insert(userSecurityTable).values([{ userId: teacher!.id, googleSubject: "g-fixture", googleEmail: teacher!.email, totpSecretEnc: sealSecret(newTotpSecret()), totpEnabledAt: new Date() }, { userId: owner!.id, totpSecretEnc: sealSecret(newTotpSecret()), totpEnabledAt: new Date() }]);
  const docs = await db.insert(verificationDocumentsTable).values([0, 1].map((n) => ({ ownerId: teacher!.id, filename: `f${n}.png`, mime: "image/png", size: 1, storageKey: "fixture" }))).returning();
  await db.insert(teacherVerificationsTable).values({ teacherId: teacher!.id, status: "approved", fullName: "Teacher", phone: "01012345678", subject: "physics", governorate: "القاهرة", qualification: "بكالوريوس", experienceYears: 3, membershipNumber: "fixture", frontDocumentId: docs[0]!.id, backDocumentId: docs[1]!.id });
  const [teacherToken, unverifiedToken, studentToken, classmateToken, thirdToken, parentToken, ownerToken] = await Promise.all([teacher!, unverified!, student!, classmate!, third!, parent!, owner!].map((u) => createSession(u.id)));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
  let checks = 0;
  const check = (name: string, result: unknown) => { assert.ok(result, name); checks++; };
  const call = async (route: string, token?: string, body?: unknown, method?: string) => {
    const response = await fetch(base + route, { method: method ?? (body === undefined ? "GET" : "POST"), headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json().catch(() => null) as any };
  };
  const inHours = (h: number) => new Date(Date.now() + h * 3_600_000);
  const lectureBody = (over: object = {}) => ({ title: "حصة مراجعة", subject: "physics", grade: "s3", startsAt: inHours(48).toISOString(), durationMin: 60, priceCents: 10000, capacity: 20, ...over });
  const create = async (over: object = {}) => (await call("/lectures", teacherToken, lectureBody(over))).data;
  const book = async (token: string, id: string) => {
    const booked = await call(`/lectures/${id}/book`, token, {});
    if (booked.data?.payment) await call(`/payments/mock/${booked.data.payment.id}/complete`, token, { method: "card", outcome: "success" });
    return booked;
  };
  const shift = (id: string, set: Record<string, unknown>) => db.update(lecturesTable).set(set).where(eq(lecturesTable.id, id));
  const lectureRow = async (id: string) => (await db.select().from(lecturesTable).where(eq(lecturesTable.id, id)))[0]!;
  const teacherEntries = async (id: string) => (await db.select().from(walletEntriesTable).where(and(eq(walletEntriesTable.lectureId, id), eq(walletEntriesTable.owner, "teacher")))).map((e) => e.status);
  const bells = async (userId: string, kind: string) => (await db.select().from(notificationsTable).where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.kind, kind)))).length;
  const finish = async (id: string, startedAgoMin: number, ranMin: number, watchedBy?: { id: string }) => {
    const liveEndedAt = new Date(Date.now() - 25 * 3_600_000);
    await shift(id, { status: "ended", liveStartedAt: new Date(liveEndedAt.getTime() - ranMin * 60_000), liveEndedAt, startsAt: new Date(liveEndedAt.getTime() - startedAgoMin * 60_000) });
    if (watchedBy) await db.insert(attendanceTable).values({ lectureId: id, studentId: watchedBy.id, liveSeconds: 1200 });
  };

  try {
    // Prices
    check("a piaster price is refused", (await call("/lectures", teacherToken, lectureBody({ priceCents: 1 }))).status === 400);
    check("just under the floor is refused", (await call("/lectures", teacherToken, lectureBody({ priceCents: 4999 }))).status === 400);
    check("the floor is accepted", (await call("/lectures", teacherToken, lectureBody({ priceCents: 5000 }))).status === 201);
    check("free stays free", (await call("/lectures", teacherToken, lectureBody({ priceCents: 0 }))).status === 201);

    // A teacher who never starts
    const absent = await create();
    await book(studentToken, absent.id);
    await shift(absent.id, { startsAt: new Date(Date.now() - 29 * 60_000) });
    await cancelNoShows();
    check("the grace period is respected", (await lectureRow(absent.id)).status === "scheduled");
    check("the teacher can still start inside it", (await call(`/lectures/${absent.id}/live/start`, teacherToken, {})).status === 200);
    await call(`/lectures/${absent.id}/live/end`, teacherToken, {});
    const missed = await create();
    await book(studentToken, missed.id);
    await shift(missed.id, { startsAt: new Date(Date.now() - 31 * 60_000) });
    check("a late start is refused", (await call(`/lectures/${missed.id}/live/start`, teacherToken, {})).data?.code === "start_window_closed");
    const beforeBells = await bells(student!.id, "cancelled");
    await cancelNoShows();
    check("a class nobody started is cancelled", (await lectureRow(missed.id)).status === "cancelled");
    check("its earnings are voided", (await teacherEntries(missed.id)).every((s) => s === "void"));
    const missedBooking = (await db.select().from(bookingsTable).where(eq(bookingsTable.lectureId, missed.id)))[0]!;
    check("the student's money is refunded", missedBooking.status === "refunded");
    check("the student is told", (await bells(student!.id, "cancelled")) === beforeBells + 1);
    check("the parent is told", (await bells(parent!.id, "cancelled")) >= 1);
    check("the teacher is told", (await bells(teacher!.id, "cancelled")) >= 1);
    check("administrators are told", (await bells(owner!.id, "cancelled")) >= 1);
    await cancelNoShows();
    check("running again repeats nothing", (await bells(student!.id, "cancelled")) === beforeBells + 1);

    // Stranded by a crash between marking and refunding
    const stranded = await create();
    await book(classmateToken, stranded.id);
    await shift(stranded.id, { status: "cancelled", updatedAt: new Date(Date.now() - 10 * 60_000) });
    await cancelNoShows();
    check("a half-finished cancellation is completed", (await db.select().from(bookingsTable).where(eq(bookingsTable.lectureId, stranded.id)))[0]!.status === "refunded");

    // Earnings after the hold
    const good = await create();
    await book(studentToken, good.id);
    await finish(good.id, 65, 60, student);
    const hollow = await create();
    await book(studentToken, hollow.id);
    await finish(hollow.id, 1, 1, student);
    const empty = await create();
    await book(studentToken, empty.id);
    await finish(empty.id, 65, 60);
    const free = await create({ priceCents: 0 });
    await book(studentToken, free.id);
    await finish(free.id, 65, 60);
    const fundsBefore = await bells(teacher!.id, "funds");
    await releaseFunds();
    check("a real class pays out", (await teacherEntries(good.id)).every((s) => s === "available") && Boolean((await lectureRow(good.id)).fundsReleasedAt));
    check("a class that barely ran waits", (await teacherEntries(hollow.id)).every((s) => s === "pending") && (await lectureRow(hollow.id)).fundsReviewReason === "short_live");
    check("a class nobody watched waits", (await lectureRow(empty.id)).fundsReviewReason === "no_attendance");
    check("a free class needs no review", !(await lectureRow(free.id)).fundsReviewReason && Boolean((await lectureRow(free.id)).fundsReleasedAt));
    check("the teacher hears about each result once", (await bells(teacher!.id, "funds")) === fundsBefore + 3);
    await releaseFunds();
    check("running again repeats nothing", (await bells(teacher!.id, "funds")) === fundsBefore + 3);
    check("review state reaches the teacher", (await call(`/lectures/${hollow.id}`, teacherToken)).data.stats.fundsReview === "short_live");

    // Administrator decisions
    const queue = await call("/admin/fund-reviews", ownerToken);
    check("the review queue lists waiting classes", queue.status === 200 && queue.data.length === 2);
    const hollowItem = queue.data.find((r: any) => r.lecture.id === hollow.id);
    check("the queue shows the facts", hollowItem.lecture.liveMinutes === 1 && hollowItem.lecture.attendees === 1 && hollowItem.amountCents === 10000);
    check("only administrators see it", (await call("/admin/fund-reviews", teacherToken)).status === 403);
    check("releasing pays the teacher", (await call(`/admin/lectures/${empty.id}/funds`, ownerToken, { decision: "release", note: "راجعنا التسجيل" })).status === 200 && (await teacherEntries(empty.id)).every((s) => s === "available"));
    check("a decision cannot repeat", (await call(`/admin/lectures/${empty.id}/funds`, ownerToken, { decision: "refund" })).status === 409);
    check("refunding gives the money back", (await call(`/admin/lectures/${hollow.id}/funds`, ownerToken, { decision: "refund", note: "لم تُعقد" })).status === 200);
    check("refunded earnings are voided", (await teacherEntries(hollow.id)).every((s) => s === "void"));
    check("refunded bookings are marked", (await db.select().from(bookingsTable).where(eq(bookingsTable.lectureId, hollow.id)))[0]!.status === "refunded");
    check("refunded payments are marked", (await db.select().from(paymentsTable).where(eq(paymentsTable.status, "refunded"))).length >= 2);
    check("each decision is on record", (await db.select().from(adminActionsTable).where(eq(adminActionsTable.targetId, hollow.id))).some((a) => a.actorId === owner!.id && a.action === "funds.refund"));

    // Student reports
    const reported = await create();
    await book(studentToken, reported.id);
    await book(classmateToken, reported.id);
    const endedAt = new Date(Date.now() - 60 * 60_000);
    await shift(reported.id, { status: "ended", liveStartedAt: new Date(endedAt.getTime() - 60 * 60_000), liveEndedAt: endedAt, startsAt: new Date(endedAt.getTime() - 60 * 60_000) });
    await db.insert(attendanceTable).values({ lectureId: reported.id, studentId: student!.id, liveSeconds: 1200 });
    const view = await call(`/lectures/${reported.id}`, studentToken);
    check("the hold window offers reporting", view.data.booking.canReport === true);
    check("someone else cannot report", (await call(`/lectures/${reported.id}/report`, thirdToken, { reason: "not_held" })).status === 400);
    check("a teacher cannot report", (await call(`/lectures/${reported.id}/report`, teacherToken, { reason: "not_held" })).status === 403);
    const filed = await call(`/lectures/${reported.id}/report`, studentToken, { reason: "technical", details: "الصوت كان مقطوع" });
    check("a student can report", filed.status === 201 && filed.data.booking.reported === true && filed.data.booking.canReport === false);
    check("reporting twice stays one report", (await call(`/lectures/${reported.id}/report`, studentToken, { reason: "other" })).status === 201 && (await db.select().from(lectureReportsTable).where(eq(lectureReportsTable.lectureId, reported.id))).length === 1);
    check("a second student can report", (await call(`/lectures/${reported.id}/report`, classmateToken, { reason: "ended_early" })).status === 201);
    await shift(reported.id, { liveStartedAt: new Date(Date.now() - 26 * 3_600_000), liveEndedAt: new Date(Date.now() - 25 * 3_600_000) });
    await releaseFunds();
    check("a report holds the earnings past the hold", (await teacherEntries(reported.id)).every((s) => s === "pending"));
    check("the window closes after the hold", (await call(`/lectures/${good.id}/report`, studentToken, { reason: "other" })).data?.code === "report_closed");
    const reports = (await call("/admin/fund-reviews", ownerToken)).data.find((r: any) => r.lecture.id === reported.id).reports;
    check("reports reach the queue", reports.length === 2);
    const first = reports.find((r: any) => r.student.id === student!.id), second = reports.find((r: any) => r.student.id === classmate!.id);
    check("one report can refund one student", (await call(`/admin/reports/${first.id}`, ownerToken, { decision: "refund", note: "ثبتت المشكلة" })).status === 200);
    const mine = await db.select().from(bookingsTable).where(and(eq(bookingsTable.lectureId, reported.id), eq(bookingsTable.studentId, student!.id)));
    check("only that student is refunded", mine[0]!.status === "refunded");
    check("the other booking stands", (await db.select().from(bookingsTable).where(and(eq(bookingsTable.lectureId, reported.id), eq(bookingsTable.studentId, classmate!.id))))[0]!.status === "confirmed");
    check("a report cannot be decided twice", (await call(`/admin/reports/${first.id}`, ownerToken, { decision: "dismiss" })).status === 409);
    check("one open report keeps the hold", (await lectureRow(reported.id)).fundsReviewReason === "reported");
    await call(`/admin/reports/${second.id}`, ownerToken, { decision: "dismiss", note: "لا توجد مشكلة" });
    check("the last report clears the hold", !(await lectureRow(reported.id)).fundsReviewReason);
    await releaseFunds();
    const shares = await teacherEntries(reported.id);
    check("the remaining earnings then pay out", shares.filter((s) => s === "available").length === 1 && shares.filter((s) => s === "void").length === 1);

    // A student leaving a class
    const leaving = await create({ startsAt: inHours(30).toISOString() });
    await book(thirdToken, leaving.id);
    check("cancelling is offered in time", (await call(`/lectures/${leaving.id}`, thirdToken)).data.booking.canCancel === true);
    const left2 = await call(`/lectures/${leaving.id}/booking/cancel`, thirdToken, {});
    check("a student can leave in time", left2.status === 200 && left2.data.booking.status === "refunded" && left2.data.seatsTaken === 0);
    check("leaving voids the teacher's share", (await teacherEntries(leaving.id)).every((s) => s === "void"));
    check("the teacher hears about it", (await bells(teacher!.id, "cancelled")) >= 2);
    check("leaving twice is refused", (await call(`/lectures/${leaving.id}/booking/cancel`, thirdToken, {})).status === 400);
    check("a student can book again", (await book(thirdToken, leaving.id)).status === 201 && (await call(`/lectures/${leaving.id}`, thirdToken)).data.booking.status === "confirmed");
    const closing = await create({ startsAt: inHours(30).toISOString() });
    await book(thirdToken, closing.id);
    await shift(closing.id, { startsAt: inHours(23) });
    check("cancelling closes before the class", (await call(`/lectures/${closing.id}`, thirdToken)).data.booking.canCancel === false && (await call(`/lectures/${closing.id}/booking/cancel`, thirdToken, {})).data?.code === "cancel_closed");
    const freeClass = await create({ priceCents: 0, startsAt: inHours(2).toISOString() });
    await book(thirdToken, freeClass.id);
    check("a free class can be left until it starts", (await call(`/lectures/${freeClass.id}/booking/cancel`, thirdToken, {})).status === 200);

    // Teachers changing a class students paid for
    const edited = await create({ startsAt: inHours(30).toISOString() });
    await book(studentToken, edited.id);
    const edit = (over: object) => call(`/lectures/${edited.id}`, teacherToken, lectureBody({ startsAt: inHours(30).toISOString(), ...over }), "PATCH");
    check("a paid class cannot move to the past", (await edit({ startsAt: inHours(-5).toISOString() })).status === 400);
    check("a paid class cannot go back to draft", (await edit({ startsAt: (await lectureRow(edited.id)).startsAt.toISOString(), publish: false })).status === 400);
    await book(classmateToken, edited.id);
    check("seats cannot drop below bookings", (await edit({ startsAt: (await lectureRow(edited.id)).startsAt.toISOString(), capacity: 1 })).status === 400);
    check("seats can match bookings", (await edit({ startsAt: (await lectureRow(edited.id)).startsAt.toISOString(), capacity: 2 })).status === 200);
    const moveBells = await bells(student!.id, "rescheduled"), parentBells = await bells(parent!.id, "rescheduled");
    const later = inHours(10).toISOString();
    check("a paid class can move forward", (await edit({ startsAt: later })).status === 200);
    check("students hear about the move", (await bells(student!.id, "rescheduled")) === moveBells + 1);
    check("parents hear about the move", (await bells(parent!.id, "rescheduled")) === parentBells + 1);
    check("a moved class can still be left inside the window", (await call(`/lectures/${edited.id}`, studentToken)).data.booking.canCancel === true);
    const quiet = await create();
    check("a class with no bookings can go back to draft", (await call(`/lectures/${quiet.id}`, teacherToken, lectureBody({ publish: false }), "PATCH")).status === 200);

    // A slow payment after the class ended
    const latePay = await create();
    const pending = await call(`/lectures/${latePay.id}/book`, thirdToken, {});
    await shift(latePay.id, { status: "ended", liveEndedAt: new Date(), liveStartedAt: new Date() });
    await confirmPayment(pending.data.payment.id, { txnId: "late", method: "card", raw: {} });
    check("it does not create a seat", (await db.select().from(bookingsTable).where(eq(bookingsTable.id, pending.data.booking.id)))[0]!.status === "cancelled");
    check("it is given back", (await db.select().from(paymentsTable).where(eq(paymentsTable.id, pending.data.payment.id)))[0]!.status === "refunded");

    // Payouts
    const wallet = await call("/wallet", teacherToken);
    check("the wallet holds released money", wallet.data.availableCents > 10000);
    check("an unverified teacher cannot withdraw", (await call("/wallet/payouts", unverifiedToken, { amountCents: 10000, method: "instapay", account: "01000000000" })).status === 403);
    await call("/wallet/payouts", teacherToken, { amountCents: 10000, method: "instapay", account: "01000000000" });
    const payout = (await db.select().from(payoutsTable).where(eq(payoutsTable.teacherId, teacher!.id)))[0]!;
    const decisions = await Promise.all([call(`/admin/payouts/${payout.id}`, ownerToken, { status: "paid" }), call(`/admin/payouts/${payout.id}`, ownerToken, { status: "rejected" })]);
    check("two decisions cannot both win", decisions.filter((d) => d.status === 200).length === 1 && decisions.filter((d) => d.status === 400).length === 1);
    const finalPayout = (await db.select().from(payoutsTable).where(eq(payoutsTable.id, payout.id)))[0]!;
    const debit = (await db.select().from(walletEntriesTable).where(eq(walletEntriesTable.payoutId, payout.id)))[0]!;
    check("the money matches the decision", (finalPayout.status === "paid") === (debit.status === "available"));
    check("the decision is on record", (await db.select().from(adminActionsTable).where(eq(adminActionsTable.targetId, payout.id))).some((a) => a.actorId === owner!.id));

    // Suspensions
    const hidden = await create({ startsAt: inHours(72).toISOString(), title: "حصة موقوفة" });
    const inFeed = async () => { const f = (await call("/feed")).data; return [...f.live, ...f.upcoming].some((x: any) => x.lecture.id === hidden.id); };
    check("a listed class shows in the feed", await inFeed());
    check("an administrator cannot suspend themselves", (await call(`/admin/users/${owner!.id}/suspend`, ownerToken, { suspended: true })).status === 400);
    check("a teacher can be suspended", (await call(`/admin/users/${teacher!.id}/suspend`, ownerToken, { suspended: true })).status === 200);
    check("the listing shows it", (await call("/admin/users?role=teacher", ownerToken)).data.find((u: any) => u.id === teacher!.id).suspended === true);
    check("a suspended teacher's classes leave the feed", !(await inFeed()));
    check("they cannot be booked", (await call(`/lectures/${hidden.id}/book`, classmateToken, {})).status === 400);
    check("suspension is on record", (await db.select().from(adminActionsTable).where(eq(adminActionsTable.targetId, teacher!.id))).some((a) => a.action === "user.suspend"));
    await call(`/admin/users/${teacher!.id}/suspend`, ownerToken, { suspended: false });
    check("restoring brings them back", await inFeed());

    // Following, saving, search and filters
    const anotherTeacher = (await db.insert(usersTable).values(person("teacher", "another")).returning())[0]!;
    await db.insert(lecturesTable).values({ teacherId: anotherTeacher.id, code: `A${suffix}`.toUpperCase().slice(0, 7), title: "الكيمياء العضوية", subject: "chemistry", grade: "s2", startsAt: inHours(40), durationMin: 60, priceCents: 0, status: "scheduled", listed: true });
    const feed = async (query = "") => (await call(`/feed${query}`, thirdToken)).data;
    const titles = (f: any) => f.upcoming.map((x: any) => x.lecture.title);
    check("search finds a title", titles(await feed(`?q=${encodeURIComponent("العضوية")}`)).every((t: string) => t === "الكيمياء العضوية") && titles(await feed(`?q=${encodeURIComponent("العضوية")}`)).length === 1);
    check("search finds a teacher", (await feed("?q=another")).upcoming.every((x: any) => x.lecture.teacher.id === anotherTeacher.id) && (await feed("?q=another")).upcoming.length === 1);
    check("search treats wildcards literally", (await feed(`?q=${encodeURIComponent("%")}`)).upcoming.length === 0);
    check("subject filter works", (await feed("?subject=chemistry")).upcoming.length === 1);
    check("grade filter works", (await feed("?grade=s2")).upcoming.length === 1);
    check("price filter works", (await feed("?price=free")).upcoming.every((x: any) => x.lecture.priceCents === 0) && (await feed("?price=paid")).upcoming.every((x: any) => x.lecture.priceCents > 0));
    check("the page size is honoured", (await feed("?limit=2")).upcoming.length === 2 && (await feed("?limit=2")).hasMore === true);
    check("nothing followed yet", (await feed("?following=1")).upcoming.length === 0);
    check("a student can follow a teacher", (await call(`/teachers/${anotherTeacher.id}/follow`, thirdToken, {})).data.followed === true);
    check("only teachers can be followed", (await call(`/teachers/${student!.id}/follow`, thirdToken, {})).status === 404);
    check("a teacher cannot follow", (await call(`/teachers/${anotherTeacher.id}/follow`, teacherToken, {})).status === 403);
    const followedFeed = await feed();
    check("a followed teacher comes first", followedFeed.upcoming[0].lecture.teacher.id === anotherTeacher.id && followedFeed.upcoming[0].reason === "مدرس تتابعه" && followedFeed.upcoming[0].lecture.teacher.followed === true);
    check("the following filter works", (await feed("?following=1")).upcoming.length === 1);
    const profile = await call(`/teachers/${anotherTeacher.id}`, thirdToken);
    check("the profile shows the follow", profile.data.teacher.followed === true && profile.data.stats.followers === 1);
    check("a student can unfollow", (await call(`/teachers/${anotherTeacher.id}/follow`, thirdToken, undefined, "DELETE")).data.followed === false);
    check("a student can save a class", (await call(`/lectures/${hidden.id}/save`, thirdToken, {})).data.saved === true && (await call(`/lectures/${hidden.id}`, thirdToken)).data.saved === true);
    check("saved classes are listed", (await call("/me/saved", thirdToken)).data.some((l: any) => l.id === hidden.id));
    check("saved classes stay private", (await call("/me/saved", classmateToken)).data.length === 0);
    check("a student can unsave", (await call(`/lectures/${hidden.id}/save`, thirdToken, undefined, "DELETE")).status === 200 && (await call("/me/saved", thirdToken)).data.length === 0);

    // Support tickets
    const opened = await call("/tickets", thirdToken, { category: "payment", subject: "دفعت ولم يظهر الحجز", body: "دفعت أمس ولم تظهر الحصة في حسابي." });
    check("a student can open a ticket", opened.status === 201 && opened.data.status === "open");
    const fromTeacher = await call("/tickets", teacherToken, { category: "account", subject: "تغيير رقم الهاتف", body: "أريد تعديل رقم هاتفي من فضلكم." });
    check("a teacher can open a ticket", fromTeacher.status === 201);
    check("a parent can open a ticket", (await call("/tickets", parentToken, { category: "other", subject: "سؤال عام", body: "كيف أتابع درجات ابني؟" })).status === 201);
    check("a ticket needs real content", (await call("/tickets", thirdToken, { category: "other", subject: "س", body: "" })).status === 400);
    check("users list only their tickets", (await call("/tickets", thirdToken)).data.length === 1);
    check("others cannot read a ticket", (await call(`/tickets/${opened.data.id}`, classmateToken)).status === 404);
    check("the owner can read it", (await call(`/tickets/${opened.data.id}`, thirdToken)).data.messages.length === 1);
    const inbox = await call("/admin/tickets", ownerToken);
    check("administrators see all tickets, with who sent them", inbox.data.length === 3 && inbox.data.find((t: any) => t.id === opened.data.id).user.id === third!.id);
    check("others cannot see the inbox", (await call("/admin/tickets", thirdToken)).status === 403);
    check("administrators are told about new tickets", (await bells(owner!.id, "ticket")) === 3);
    const answered = await call(`/tickets/${opened.data.id}/messages`, ownerToken, { body: "راجعنا العملية وتم تأكيد الحجز." });
    check("an administrator can answer", answered.status === 201 && answered.data.status === "answered");
    check("the sender is told", (await bells(third!.id, "ticket")) === 1);
    const thread = await call(`/tickets/${opened.data.id}`, thirdToken);
    check("users see 'support', not an administrator's account", thread.data.messages[1].author.name === "فريق الدعم" && thread.data.messages[1].fromAdmin === true && thread.data.messages[1].author.id !== owner!.id);
    check("a reply reopens the ticket", (await call(`/tickets/${opened.data.id}/messages`, thirdToken, { body: "شكرًا، لكن عندي سؤال آخر." })).data.status === "open");
    check("a ticket can be closed", (await call(`/tickets/${opened.data.id}/close`, thirdToken, {})).data.status === "closed");
    check("a closed ticket takes no replies", (await call(`/tickets/${opened.data.id}/messages`, thirdToken, { body: "مرحبًا" })).data?.code === "ticket_closed");
    let openedCount = 0;
    for (let i = 0; i < 6; i++) if ((await call("/tickets", classmateToken, { category: "other", subject: `تذكرة رقم ${i}`, body: "نص التذكرة هنا." })).status === 201) openedCount += 1;
    check("tickets are budgeted", openedCount === 5);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  console.log(`${checks} money-flow checks passed`);
});
