import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { eq } from "drizzle-orm";
import type { AdminLecturePage, LectureMailProgress } from "@workspace/live-core";

test("admin class summaries and branded manual and automatic mail", async () => {
  assert.ok(!process.env.DATABASE_URL, "Only run against isolated PGlite");
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
  const tmp = path.join(root, "tmp");
  await mkdir(tmp, { recursive: true });
  const dir = await mkdtemp(path.join(tmp, "lecture-mail-test-"));
  const cwd = process.cwd();
  process.chdir(dir);
  Object.assign(process.env, { NODE_ENV: "test", PAYMENT_PROVIDER: "mock", SMTP_HOST: "", SMTP_USER: "", SMTP_PASS: "", LOG_LEVEL: "silent" });
  const database = await import("@workspace/db");
  await database.initDb({ migrationsFolder: path.join(root, "lib/db/drizzle"), pgliteDir: path.join(dir, "db") });
  const { db, usersTable, userSecurityTable, lecturesTable, bookingsTable, attendanceTable, lectureReminderDeliveriesTable } = database;
  const { createSession } = await import("./auth");
  const { sealSecret, newTotpSecret } = await import("./two-factor");
  const { sendDueLectureReminders } = await import("./lecture-reminders");
  const { default: app } = await import("../app");
  const [admin, teacher, confirmed, pending] = await db.insert(usersTable).values([
    { role: "admin", name: "Admin", email: "admin@example.test", passwordHash: "fixture" },
    { role: "teacher", name: "Teacher", email: "teacher@example.test", phone: "01012345678", passwordHash: "fixture" },
    { role: "student", name: "Confirmed", email: "confirmed@example.test", passwordHash: "fixture" },
    { role: "student", name: "Pending", email: "pending@example.test", passwordHash: "fixture" },
  ]).returning();
  await db.insert(userSecurityTable).values({ userId: admin!.id, totpEnabledAt: new Date(), totpSecretEnc: sealSecret(newTotpSecret()) });
  const [adminToken, studentToken] = await Promise.all([createSession(admin!.id), createSession(confirmed!.id)]);
  const common = { teacherId: teacher!.id, subject: "physics", grade: "g12", durationMin: 60, priceCents: 0 };
  const [upcoming, ended] = await db.insert(lecturesTable).values([
    { ...common, title: "Upcoming", code: "upcoming", status: "scheduled", startsAt: new Date(Date.now() + 8 * 60_000), reminderSentAt: new Date() },
    { ...common, title: "Ended", code: "ended", status: "ended", startsAt: new Date(Date.now() - 60 * 60_000) },
    { ...common, title: "Later", code: "later", status: "scheduled", startsAt: new Date(Date.now() + 4 * 60 * 60_000) },
  ]).returning();
  await db.insert(bookingsTable).values([
    { lectureId: upcoming!.id, studentId: confirmed!.id, status: "confirmed", pricePaidCents: 0 },
    { lectureId: upcoming!.id, studentId: pending!.id, status: "pending_payment", pricePaidCents: 0 },
  ]);
  await db.insert(attendanceTable).values({ lectureId: ended!.id, studentId: confirmed!.id, liveSeconds: 90 });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/admin/lectures`;
  const call = (route: string, body?: unknown, token = adminToken) => fetch(base + route, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const outbox = path.join(dir, ".data", "outbox");
  try {
    assert.equal((await call("", undefined, studentToken)).status, 403);
    const { rows } = await (await call("?filter=upcoming")).json() as AdminLecturePage;
    assert.deepEqual(rows.map((r) => r.title), ["Upcoming", "Later"]);
    assert.equal(rows[0]?.teacher.phone, "01012345678");
    assert.equal(rows[0]?.booked, 1);
    assert.equal(rows[0]?.pending, 1);
    const past = await (await call("?filter=ended")).json() as AdminLecturePage;
    assert.equal(past.rows[0]?.attended, 1);

    await Promise.all([sendDueLectureReminders(), sendDueLectureReminders()]);
    await sendDueLectureReminders();
    assert.equal((await readdir(outbox)).length, 2);
    const reminderRows = await db.select().from(lectureReminderDeliveriesTable);
    assert.deepEqual(new Set(reminderRows.map((r) => r.userId)), new Set([teacher!.id, confirmed!.id]));
    assert.ok(reminderRows.every((r) => r.sentAt));
    await db.update(lecturesTable).set({ startsAt: new Date(Date.now() + 9 * 60_000) }).where(eq(lecturesTable.id, upcoming!.id));
    await sendDueLectureReminders();
    assert.equal((await readdir(outbox)).length, 4);

    const endpoint = `/${upcoming!.id}/email`;
    const draft = { audience: "both", template: "announcement", subject: "Test notice", title: "Editable title", message: "<script>malicious</script>\nsecond line", requestId: randomUUID() };
    const previewResponse = await call(`${endpoint}/preview`, draft);
    assert.equal(previewResponse.status, 200);
    const { html } = await previewResponse.json() as { html: string };
    assert.match(html, /email-live\.png/);
    assert.match(html, /&lt;script&gt;malicious&lt;\/script&gt;<br>second line/);
    assert.equal((await readdir(outbox)).length, 4);
    assert.equal((await call(endpoint, { ...draft, subject: "Bad\nheader" })).status, 400);
    const requests = await Promise.all([call(endpoint, draft), call(endpoint, draft)]);
    assert.deepEqual(requests.map((r) => r.status), [202, 202]);
    let progress: LectureMailProgress | undefined;
    for (let attempt = 0; attempt < 30; attempt++) {
      progress = await (await call(`${endpoint}/${draft.requestId}`)).json() as LectureMailProgress;
      if (progress.done) break;
      await delay(50);
    }
    assert.deepEqual(progress, { total: 2, sent: 2, failed: 0, done: true });
    const delivered = await Promise.all((await readdir(outbox)).map((filename) => readFile(path.join(outbox, filename), "utf8")));
    assert.equal(delivered.length, 6);
    assert.ok(delivered.every((mail) => !mail.includes("pending@example.test")));
    assert.ok(delivered.filter((mail) => mail.includes("Test notice")).every((mail) => mail.includes("Editable title") && !mail.includes("<script>")));
  } finally {
    server.close();
    process.chdir(cwd);
  }
});
