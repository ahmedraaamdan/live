/** The accounts sheet, the Excel export, removing accounts, and the trial-class path for new teachers. */
import test from "node:test";
import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Reads one file back out of a ZIP, walking the central directory the way Excel does. */
function unzip(file: Buffer, name: string): string {
  const end = file.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let at = file.readUInt32LE(end + 16);
  for (let i = 0; i < file.readUInt16LE(end + 8); i++) {
    const size = file.readUInt32LE(at + 20), nameLength = file.readUInt16LE(at + 28), extra = file.readUInt16LE(at + 30), comment = file.readUInt16LE(at + 32), offset = file.readUInt32LE(at + 42);
    if (file.toString("utf8", at + 46, at + 46 + nameLength) === name) {
      const start = offset + 30 + file.readUInt16LE(offset + 26) + file.readUInt16LE(offset + 28);
      return inflateRawSync(file.subarray(start, start + size)).toString("utf8");
    }
    at += 46 + nameLength + extra + comment;
  }
  throw new Error(`${name} is not in the file`);
}

test("admin accounts sheet, export, removal and teacher trial classes", async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../tmp");
  await mkdir(root, { recursive: true });
  const dir = await mkdtemp(path.join(root, "admin-users-test-"));
  Object.assign(process.env, { NODE_ENV: "test", PAYMENT_PROVIDER: "mock", SUPER_ADMIN_EMAILS: "owner@audit.gahez", ADMIN_EMAILS: "", SMTP_HOST: "", SMTP_USER: "", SMTP_PASS: "", LIVEKIT_URL: "", LOG_LEVEL: "silent", UPLOAD_DIR: path.join(dir, "uploads") });
  const database = await import("@workspace/db");
  await database.initDb({ migrationsFolder: path.resolve(root, "../lib/db/drizzle"), pgliteDir: dir });
  const { db, usersTable, userSecurityTable, teacherVerificationsTable, verificationDocumentsTable, lecturesTable, bookingsTable, walletEntriesTable, payoutsTable, teacherProfilesTable, sessionsTable, adminActionsTable, notificationsTable } = database;
  const { eq } = await import("drizzle-orm");
  const { hashPassword, createSession } = await import("./auth");
  const { sealSecret, newTotpSecret } = await import("./two-factor");
  const { deviceLabel } = await import("./admin-users");
  const { default: app } = await import("../app");

  const passwordHash = await hashPassword("audit-password");
  const person = (role: "admin" | "teacher" | "student" | "parent", key: string, name: string, phone: string | null = null) => ({ role, name, email: `${key}@audit.gahez`, phone, passwordHash });
  const [owner, helper, fresh, tried, paidTeacher, richTeacher, student, freeStudent] = await db
    .insert(usersTable)
    .values([person("admin", "owner", "Owner"), person("admin", "helper", "Helper"), person("teacher", "fresh", "=Fresh & <Teacher>", "01011111111"), person("teacher", "tried", "Tried Teacher"), person("teacher", "paid", "Paid Teacher", "01022222222"), person("teacher", "rich", "Rich Teacher"), person("student", "student", "Paying Student"), person("student", "free", "Free Student")])
    .returning();
  await db.insert(teacherProfilesTable).values([fresh!, tried!, paidTeacher!, richTeacher!].map((t) => ({ userId: t.id, subject: "physics" })));
  await db.insert(userSecurityTable).values([owner!, helper!].map((u) => ({ userId: u.id, totpSecretEnc: sealSecret(newTotpSecret()), totpEnabledAt: new Date() })));
  const [ownerToken, helperToken, freshToken, triedToken, paidToken, studentToken] = await Promise.all([owner!, helper!, fresh!, tried!, paidTeacher!, student!].map((u) => createSession(u.id, "Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit Chrome FBAN/FB4A")));

  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
  const call = async (route: string, token?: string, body?: unknown, method?: string) => {
    const response = await fetch(base + route, { method: method ?? (body === undefined ? "GET" : "POST"), headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await response.text();
    let data: any = text;
    try { data = JSON.parse(text); } catch { /* not JSON */ }
    return { status: response.status, data };
  };
  let checks = 0;
  const check = (name: string, value: unknown) => { assert.ok(value, name); checks++; };
  const classAt = (priceCents: number, listed: boolean, extra: object = {}) => ({ title: "حصة", subject: "physics", grade: "g12", startsAt: new Date(Date.now() + 2 * 86400000 + Math.random() * 1e8).toISOString(), durationMin: 60, priceCents, listed, ...extra });
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2IX8AAAAASUVORK5CYII=", "base64");
  const upload = async (token: string) => (await fetch(base + "/teacher/verification/documents", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "image/png", "X-Filename": "id.png" }, body: png })).json() as Promise<{ id: string }>;

  try {
    // A new teacher can try the platform at once, inside the trial limits.
    const trial = await call("/lectures", freshToken, classAt(0, false));
    check("a new teacher can open a free class shared by link", trial.status === 201);
    check("trial classes seat a limited number of students", trial.data.capacity === 15);
    check("a large trial class is cut to the limit", (await call("/lectures", freshToken, classAt(0, false, { capacity: 500 }))).data.capacity === 15);
    check("a new teacher cannot charge before review", (await call("/lectures", freshToken, classAt(10000, false))).status === 403);
    check("a new teacher cannot appear on the home feed before review", (await call("/lectures", freshToken, classAt(0, true))).status === 403);
    check("a third open trial class is allowed", (await call("/lectures", freshToken, classAt(0, false))).status === 201);
    check("a fourth open trial class is refused", (await call("/lectures", freshToken, classAt(0, false))).status === 400);
    check("a trial class cannot be turned paid before review", (await call(`/lectures/${trial.data.id}`, freshToken, { ...classAt(10000, false), publish: true }, "PATCH")).status === 403);
    const trialPage = await call(`/l/${trial.data.code}`);
    check("a trial class page says its teacher isn't verified yet", trialPage.status === 200 && trialPage.data.teacher.verified === false);

    // Verification needs identity, not an authenticator app or a linked account.
    const front = await upload(triedToken!), back = await upload(triedToken!);
    check("documents upload without two-factor or a linked account", Boolean(front.id && back.id));
    const form = { fullName: "أحمد محمد رمضان", phone: "01033333333", subject: "فيزياء", governorate: "القاهرة", documentType: "national_id", pageUrl: "facebook.com/mr.ahmed", frontDocumentId: front.id, backDocumentId: back.id };
    const submitted = await call("/teacher/verification/submit", triedToken, form);
    check("a teacher can submit with an ID card and no syndicate number", submitted.status === 200 && submitted.data.status === "pending");
    check("a page link gets its https", submitted.data.details.pageUrl === "https://facebook.com/mr.ahmed");
    check("a bad page link is refused", (await call("/teacher/verification/submit", paidToken, { ...form, pageUrl: "not a link" })).status === 400);
    check("the owner hears about the request in the app", (await db.select().from(notificationsTable).where(eq(notificationsTable.userId, owner!.id))).some((n) => n.kind === "verification"));
    const approved = await call(`/admin/teacher-verifications/${tried!.id}/review`, ownerToken, { action: "approve", submittedAt: submitted.data.submittedAt });
    check("the owner can approve a teacher with no two-factor", approved.status === 200 && approved.data.status === "approved");
    check("a verified teacher can charge and appear on the feed", (await call("/lectures", triedToken, classAt(10000, true))).status === 201);

    // Money stays behind two-factor.
    await db.insert(walletEntriesTable).values({ owner: "teacher", teacherId: tried!.id, kind: "sale", amountCents: 50000, status: "available", memo: "fixture" });
    const payout = { amountCents: 20000, method: "instapay", account: "01033333333" };
    check("a teacher without review cannot withdraw", (await call("/wallet/payouts", freshToken, payout)).status === 403);
    check("a verified teacher still needs two-factor to withdraw", (await call("/wallet/payouts", triedToken, payout)).status === 403);
    await db.insert(userSecurityTable).values({ userId: tried!.id, totpSecretEnc: sealSecret(newTotpSecret()), totpEnabledAt: new Date() });
    check("two-factor opens withdrawing", (await call("/wallet/payouts", triedToken, payout)).status === 201);

    // The sheet.
    await call("/me", paidToken);
    const list = await call("/admin/users", ownerToken);
    check("the sheet lists every account", list.status === 200 && list.data.length === 8);
    const row = (id: string) => list.data.find((u: any) => u.id === id);
    check("phone, device and last seen reach the sheet", row(paidTeacher!.id).phone === "01022222222" && row(paidTeacher!.id).device === "أندرويد · من جوه فيسبوك");
    check("a teacher who only made a trial class shows that step", row(fresh!.id).step.key === "lecture_created" && row(fresh!.id).verification === "not_submitted");
    check("a verified teacher shows verified", row(tried!.id).step.key === "verified");
    check("a teacher's verification phone fills a missing one", row(tried!.id).phone === "01033333333");
    check("a teacher with no activity shows signed up", row(richTeacher!.id).step.key === "signed_up");
    check("the sheet is for administrators", (await call("/admin/users", studentToken)).status === 403);
    const detail = await call(`/admin/users/${tried!.id}`, ownerToken);
    check("a person's detail shows their steps in order", detail.status === 200 && detail.data.timeline.map((s: any) => s.key).join() === "signed_up,lecture_created,verification_sent,verified");
    check("device labels read in-app browsers", deviceLabel("Mozilla/5.0 (iPhone) Instagram 300") === "آيفون · من جوه إنستجرام" && deviceLabel("Mozilla/5.0 (Windows NT 10.0)") === "ويندوز");

    // Export.
    const file = await fetch(`${base}/admin/users/export`, { method: "POST", headers: { Authorization: `Bearer ${ownerToken}`, "Content-Type": "application/json" }, body: "{}" });
    const bytes = Buffer.from(await file.arrayBuffer());
    check("export is an Excel file", file.status === 200 && file.headers.get("content-type")?.includes("spreadsheetml") && bytes.subarray(0, 2).toString() === "PK");
    const sheet = unzip(bytes, "xl/worksheets/sheet1.xml");
    check("the workbook has its required parts", unzip(bytes, "[Content_Types].xml").includes("worksheet+xml") && unzip(bytes, "xl/workbook.xml").includes("المستخدمين") && unzip(bytes, "xl/styles.xml").includes("yyyy"));
    check("phone numbers stay text with their leading zero", sheet.includes("<t xml:space=\"preserve\">01022222222</t>"));
    check("names can't become formulas or break the file", sheet.includes("=Fresh &amp; &lt;Teacher&gt;") && sheet.includes('t="inlineStr"') && !sheet.includes("<f>"));
    check("every account plus a header is in the file", (sheet.match(/<row /g) ?? []).length === 9);
    check("the sheet reads right to left with a frozen header", sheet.includes('rightToLeft="1"') && sheet.includes('state="frozen"'));
    const picked = Buffer.from(await (await fetch(`${base}/admin/users/export`, { method: "POST", headers: { Authorization: `Bearer ${ownerToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ ids: [fresh!.id, tried!.id] }) })).arrayBuffer());
    check("export can be just the selected people", (unzip(picked, "xl/worksheets/sheet1.xml").match(/<row /g) ?? []).length === 3);
    check("only the owner can export", (await call("/admin/users/export", helperToken, {})).status === 403);
    check("the export is on record", (await db.select().from(adminActionsTable).where(eq(adminActionsTable.action, "user.export"))).length === 2);

    // Bulk suspend and restore.
    const bulkSuspend = await call("/admin/users/bulk", helperToken, { action: "suspend", ids: [freeStudent!.id, owner!.id] });
    check("bulk suspend reports each account, and the owner stays out of reach", bulkSuspend.data.results.find((r: any) => r.id === freeStudent!.id).outcome === "suspended" && bulkSuspend.data.results.find((r: any) => r.id === owner!.id).outcome === "skipped");
    check("bulk restore works", (await call("/admin/users/bulk", helperToken, { action: "restore", ids: [freeStudent!.id] })).data.results[0].outcome === "restored");

    // Removing accounts.
    const remove = (ids: string[], token = ownerToken, confirm: string | undefined = "احذف") => call("/admin/users/bulk", token, { action: "delete", ids, confirm });
    check("only the owner can delete", (await remove([freeStudent!.id], helperToken)).status === 403);
    check("deleting needs the confirmation word", (await remove([freeStudent!.id], ownerToken, "ok")).status === 400);
    const self = await remove([owner!.id]);
    check("the owner cannot delete themselves", self.data.results[0].outcome === "skipped");

    // Money owed and paid seats stop a removal.
    const [paidLecture] = await db.insert(lecturesTable).values({ teacherId: paidTeacher!.id, code: "PAID01", title: "حصة مدفوعة", subject: "physics", grade: "g12", startsAt: new Date(Date.now() + 5 * 86400000), durationMin: 60, priceCents: 10000, listed: true, status: "scheduled" }).returning();
    await db.insert(bookingsTable).values({ lectureId: paidLecture!.id, studentId: student!.id, status: "confirmed", pricePaidCents: 10000, confirmedAt: new Date() });
    const teacherStopped = await remove([paidTeacher!.id]);
    check("a teacher with a paid class coming is not removed", teacherStopped.data.results[0].outcome === "skipped" && teacherStopped.data.results[0].reason.includes("حجوزات مدفوعة"));
    const studentStopped = await remove([student!.id]);
    check("a student with a paid seat coming is not removed", studentStopped.data.results[0].outcome === "skipped" && studentStopped.data.results[0].reason.includes("حجز مدفوع"));
    await db.insert(walletEntriesTable).values({ owner: "teacher", teacherId: richTeacher!.id, kind: "sale", amountCents: 7000, status: "available", memo: "fixture" });
    const richStopped = await remove([richTeacher!.id]);
    check("a teacher who is owed money is not removed", richStopped.data.results[0].outcome === "skipped" && richStopped.data.results[0].reason.includes("رصيد"));

    // No history: gone completely, and the trial classes with them.
    const gone = await remove([fresh!.id]);
    check("an account with no history is deleted outright", gone.data.results[0].outcome === "deleted");
    check("its row is gone", !(await db.query.usersTable.findFirst({ where: eq(usersTable.id, fresh!.id) })));
    check("its unbooked classes are gone", (await db.select().from(lecturesTable).where(eq(lecturesTable.teacherId, fresh!.id))).length === 0);
    check("its email can sign up again", (await call("/auth/signup", undefined, { role: "teacher", name: "Fresh Again", email: fresh!.email, phone: "01011111111", password: "audit-password-2", subject: "physics" })).status === 201);

    // History: erased, and records keep their shape.
    const [freeClass] = await db.insert(lecturesTable).values({ teacherId: paidTeacher!.id, code: "FREE01", title: "حصة مجانية", subject: "physics", grade: "g12", startsAt: new Date(Date.now() - 86400000), durationMin: 60, priceCents: 0, listed: true, status: "ended" }).returning();
    await db.insert(bookingsTable).values({ lectureId: freeClass!.id, studentId: freeStudent!.id, status: "confirmed", pricePaidCents: 0, confirmedAt: new Date() });
    const freeSession = await createSession(freeStudent!.id);
    const erased = await remove([freeStudent!.id]);
    check("an account with history is erased", erased.data.results[0].outcome === "erased");
    const ghost = await db.query.usersTable.findFirst({ where: eq(usersTable.id, freeStudent!.id) });
    check("its personal details are gone", ghost?.name === "حساب محذوف" && !ghost.phone && ghost.email.endsWith("@deleted.invalid") && ghost.deletedAt && ghost.suspended);
    check("its booking history stays", (await db.select().from(bookingsTable).where(eq(bookingsTable.studentId, freeStudent!.id))).length === 1);
    check("its sessions are closed", (await db.select().from(sessionsTable).where(eq(sessionsTable.userId, freeStudent!.id))).length === 0 && (await call("/me", freeSession)).status === 401);
    check("its email is free again", (await call("/auth/signup", undefined, { role: "student", name: "Free Again", email: freeStudent!.email, phone: "01044444444", password: "audit-password-3", grade: "g12" })).status === 201);
    check("erased accounts leave the sheet", !(await call("/admin/users", ownerToken)).data.some((u: any) => u.id === freeStudent!.id));
    check("erased accounts leave account switching", !(await call("/auth/switch/users", ownerToken)).data.some((u: any) => u.id === freeStudent!.id));

    // A verified teacher with documents: the documents never outlive the account.
    const documents = await db.select().from(verificationDocumentsTable).where(eq(verificationDocumentsTable.ownerId, tried!.id));
    check("the fixture has documents", documents.length === 2);
    await db.insert(walletEntriesTable).values({ owner: "teacher", teacherId: tried!.id, kind: "adjustment", amountCents: -30000, status: "available", memo: "settle" });
    const open = await remove([tried!.id]);
    check("an open withdrawal stops a removal", open.data.results[0].outcome === "skipped" && open.data.results[0].reason.includes("طلب سحب"));
    const [request] = await db.select().from(payoutsTable).where(eq(payoutsTable.teacherId, tried!.id));
    await call(`/admin/payouts/${request!.id}`, ownerToken, { status: "paid" });
    const triedGone = await remove([tried!.id]);
    check("a settled teacher with money history is erased", triedGone.data.results[0].outcome === "erased");
    check("identity documents are removed with the account", (await db.select().from(verificationDocumentsTable).where(eq(verificationDocumentsTable.ownerId, tried!.id))).length === 0 && (await db.select().from(teacherVerificationsTable).where(eq(teacherVerificationsTable.teacherId, tried!.id))).length === 0);
    check("the ledger keeps the erased teacher's money rows", (await db.select().from(walletEntriesTable).where(eq(walletEntriesTable.teacherId, tried!.id))).length >= 2);
    check("removals are on record", (await db.select().from(adminActionsTable).where(eq(adminActionsTable.action, "user.erase"))).length === 2 && (await db.select().from(adminActionsTable).where(eq(adminActionsTable.action, "user.delete"))).length === 1);
    console.log(`${checks} accounts sheet, export, removal and trial checks passed`);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (database.pool) await database.pool.end();
    else await (db as any).$client.close();
    await rm(dir, { recursive: true, force: true });
  }
});
