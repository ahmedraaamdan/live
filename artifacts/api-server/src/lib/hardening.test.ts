import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

test("script URLs, request budgets, upload gate, admin two-factor and room clashes", async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../tmp");
  await mkdir(root, { recursive: true });
  const dir = await mkdtemp(path.join(root, "hardening-test-"));
  const appDist = path.join(dir, "app");
  await mkdir(appDist, { recursive: true });
  await writeFile(path.join(appDist, "index.html"), "<!doctype html><title>app</title>");
  Object.assign(process.env, { NODE_ENV: "test", PAYMENT_PROVIDER: "mock", ADMIN_EMAILS: "", SUPER_ADMIN_EMAILS: "boss@audit.gahez", SMTP_HOST: "", SMTP_USER: "", SMTP_PASS: "", LIVEKIT_URL: "", LOG_LEVEL: "silent", UPLOAD_DIR: path.join(dir, "uploads"), APP_DIST: appDist, LIVE_MAX_ROOMS: "1", LIVE_MAX_PARTICIPANTS: "26" });
  const database = await import("@workspace/db");
  const { initDb, usersTable, teacherProfilesTable, studentProfilesTable, userSecurityTable, verificationDocumentsTable, teacherVerificationsTable, passwordResetsTable, recordingsTable, uploadsTable, sessionsTable } = database;
  const { eq } = await import("drizzle-orm");
  await initDb({ migrationsFolder: path.resolve(root, "../lib/db/drizzle"), pgliteDir: dir });
  const { db } = database;
  const { createSession, hashPassword } = await import("./auth");
  const { sealSecret, newTotpSecret, totp } = await import("./two-factor");
  const { default: app } = await import("../app");
  const suffix = randomUUID().slice(0, 8);
  const password = "hardening-password";
  const passwordHash = await hashPassword(password);
  const [teacher, rival, student, classmate, parent, admin, boss] = await db.insert(usersTable).values([
    { role: "teacher" as const, name: "Teacher", email: `teacher-${suffix}@audit.gahez`, passwordHash },
    { role: "teacher" as const, name: "Rival", email: `rival-${suffix}@audit.gahez`, passwordHash },
    { role: "student" as const, name: "Student", email: `student-${suffix}@audit.gahez`, passwordHash },
    { role: "student" as const, name: "Classmate", email: `classmate-${suffix}@audit.gahez`, passwordHash },
    { role: "parent" as const, name: "Parent", email: `parent-${suffix}@audit.gahez`, passwordHash },
    { role: "admin" as const, name: "Admin", email: `admin-${suffix}@audit.gahez`, passwordHash },
    { role: "admin" as const, name: "Boss", email: "boss@audit.gahez", passwordHash },
  ]).returning();
  await db.insert(studentProfilesTable).values([{ userId: student!.id, linkCode: `A${suffix}` }, { userId: classmate!.id, linkCode: `B${suffix}` }]);
  for (const person of [teacher!, rival!]) {
    await db.insert(teacherProfilesTable).values({ userId: person.id });
    await db.insert(userSecurityTable).values({ userId: person.id, googleSubject: `g-${person.id}`, googleEmail: person.email, totpSecretEnc: sealSecret(newTotpSecret()), totpEnabledAt: new Date() });
    const docs = await db.insert(verificationDocumentsTable).values([0, 1].map((n) => ({ ownerId: person.id, filename: `f${n}.png`, mime: "image/png", size: 1, storageKey: "fixture" }))).returning();
    await db.insert(teacherVerificationsTable).values({ teacherId: person.id, status: "approved", fullName: person.name, phone: "01012345678", subject: "physics", governorate: "القاهرة", qualification: "بكالوريوس", experienceYears: 3, membershipNumber: "fixture", frontDocumentId: docs[0]!.id, backDocumentId: docs[1]!.id });
  }
  const [teacherToken, rivalToken, studentToken, classmateToken, parentToken, adminToken, bossToken] = await Promise.all([teacher!, rival!, student!, classmate!, parent!, admin!, boss!].map((u) => createSession(u.id)));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const base = `${origin}/api`;
  let checks = 0;
  const check = (name: string, result: unknown) => { assert.ok(result, name); checks++; };
  const call = async (route: string, token?: string, body?: unknown, method?: string) => {
    const response = await fetch(base + route, { method: method ?? (body === undefined ? "GET" : "POST"), headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json().catch(() => null) as any, headers: response.headers };
  };
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2IX8AAAAASUVORK5CYII=", "base64");
  const upload = (token?: string, body: Buffer = png) => fetch(`${base}/uploads`, { method: "POST", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "image/png" }, body });
  const inHours = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();
  const lecture = (over: object = {}) => ({ title: "حصة مراجعة", subject: "physics", grade: "s3", startsAt: inHours(48), durationMin: 60, priceCents: 0, capacity: 20, ...over });

  try {
    // Headers
    const page = await fetch(`${origin}/some-page`), json = await call("/healthz");
    check("pages carry a strict script policy", page.headers.get("content-security-policy")?.includes("script-src 'self'"));
    check("pages cannot be framed", page.headers.get("content-security-policy")?.includes("frame-ancestors 'none'") && page.headers.get("x-frame-options") === "DENY");
    check("framework banner is hidden", !json.headers.get("x-powered-by"));
    check("API responses skip the page policy", !json.headers.get("content-security-policy"));

    // Recording links
    const first = await call("/lectures", teacherToken, lecture());
    check("a verified teacher can publish", first.status === 201);
    for (const url of ["javascript:alert(1)", "data:text/html,x", "http://example.com/x.mp4"]) check(`recording link ${url} rejected`, (await call(`/lectures/${first.data.id}/recording`, teacherToken, { url })).status === 400);
    await call(`/lectures/${first.data.id}/book`, studentToken, {});
    await db.insert(recordingsTable).values({ lectureId: first.data.id, provider: "manual", status: "ready", url: "javascript:alert(1)", readyAt: new Date() });
    check("an older script link never reaches a student", (await call(`/lectures/${first.data.id}`, studentToken)).data.recording?.url === null);
    check("an https recording is accepted", (await call(`/lectures/${first.data.id}/recording`, teacherToken, { url: "https://example.com/x.mp4" })).status === 201);

    // Login budget
    const attempt = (secret: string, email = student!.email) => call("/auth/login", undefined, { email, password: secret });
    for (let i = 0; i < 4; i++) check("a wrong password is refused", (await attempt("wrong-password")).status === 401);
    check("the right password still works", (await attempt(password)).status === 200);
    for (let i = 0; i < 10; i++) check("ten more wrong attempts are answered normally", (await attempt("wrong-password")).status === 401);
    const blocked = await attempt("wrong-password");
    check("attempt eleven is refused", blocked.status === 429 && blocked.data.code === "rate_limited" && Number(blocked.headers.get("retry-after")) > 0);
    check("the right password also waits", (await attempt(password)).status === 429);
    check("another account is unaffected", (await attempt(password, classmate!.email)).status === 200);

    // Email budgets
    const forgotten = await Promise.all(Array.from({ length: 6 }, () => call("/auth/forgot", undefined, { email: classmate!.email })));
    const resets = await db.select().from(passwordResetsTable).where(eq(passwordResetsTable.userId, classmate!.id));
    check("password reset always answers alike", forgotten.every((r) => r.status === 200));
    check("password reset stops filling an inbox", resets.length === 3);
    for (let i = 0; i < 5; i++) check("parent invites are allowed", (await call("/me/parent-invite", studentToken, { email: `stranger${i}@example.com` })).status === 200);
    check("parent invites are budgeted", (await call("/me/parent-invite", studentToken, { email: "stranger@example.com" })).status === 429);
    for (let i = 0; i < 10; i++) check("a wrong link code is refused", (await call("/parent/children", parentToken, { code: `ZZZZ${i}` })).status === 404);
    check("link code guessing is budgeted", (await call("/parent/children", parentToken, { code: "ZZZZZ" })).status === 429);

    // Uploads
    check("anonymous upload is refused before its body is read", (await upload(undefined, Buffer.alloc(13 * 1024 * 1024))).status === 401);
    check("a signed-in upload works", (await upload(classmateToken)).status === 201);
    await db.insert(uploadsTable).values({ ownerId: classmate!.id, filename: "big.pdf", mime: "application/pdf", size: 301 * 1024 * 1024, storageKey: "fixture" });
    check("the daily space budget holds", (await upload(classmateToken)).status === 429);
    await db.insert(uploadsTable).values({ ownerId: rival!.id, filename: "old.pdf", mime: "application/pdf", size: 1100 * 1024 * 1024, storageKey: "fixture", createdAt: new Date(Date.now() - 30 * 86_400_000) });
    check("the total space budget holds", (await upload(rivalToken)).status === 429);
    let accepted = 0;
    for (let i = 0; i < 61; i++) if ((await upload(teacherToken)).status === 201) accepted += 1;
    check("uploads are budgeted per hour", accepted === 60);

    // Class messages
    let sent = 0;
    for (let i = 0; i < 31; i++) if ((await call(`/lectures/${first.data.id}/messages`, studentToken, { body: `سؤال ${i}` })).status === 201) sent += 1;
    check("class messages are budgeted", sent === 30);

    // Administrator two-factor
    const locked = await call("/admin/overview", adminToken);
    check("admin tools stay closed until two-factor is on", locked.status === 403 && locked.data.code === "mfa_required");
    check("users cannot be read either", (await call("/admin/users", adminToken)).data.code === "mfa_required");
    check("account switching is closed too", (await call("/auth/switch/users", bossToken)).data.code === "mfa_required");
    const lockedMe = await call("/me", adminToken);
    check("the app is told to ask for setup", lockedMe.status === 200 && lockedMe.data.mfaSetupRequired === true);
    check("non-administrators are not asked", (await call("/me", teacherToken)).data.mfaSetupRequired === false);
    check("the security page opens", (await call("/me/security", adminToken)).status === 200);
    const secondSession = await createSession(admin!.id);
    const setup = await call("/me/security/mfa/setup", adminToken, { password });
    check("an administrator can start setup", setup.status === 200 && Boolean(setup.data.secret));
    const confirmed = await call("/me/security/mfa/confirm", adminToken, { code: totp(setup.data.secret, Math.floor(Date.now() / 30_000)) });
    check("an administrator can finish setup", confirmed.status === 200 && confirmed.data.recoveryCodes.length === 10);
    check("admin tools open afterwards", (await call("/admin/overview", adminToken)).status === 200);
    check("the app stops asking", (await call("/me", adminToken)).data.mfaSetupRequired === false);
    check("other sessions must sign in again", (await call("/me", secondSession)).status === 401);
    const relogin = await call("/auth/login", undefined, { email: admin!.email, password });
    check("the next sign-in asks for a code", relogin.status === 200 && relogin.data.requiresMfa === true);
    await db.insert(userSecurityTable).values({ userId: boss!.id, totpSecretEnc: sealSecret(newTotpSecret()), totpEnabledAt: new Date() });
    const switched = await call(`/auth/switch/${student!.id}/start`, bossToken, {});
    check("switching works with two-factor", switched.status === 200);
    await db.update(userSecurityTable).set({ totpEnabledAt: null }).where(eq(userSecurityTable.userId, boss!.id));
    check("a switched session closes when its owner loses two-factor", (await call("/lectures", switched.data.token)).data?.code === "mfa_required");
    check("and can still leave", (await call("/auth/switch/stop", switched.data.token, {})).status === 200);
    check("sessions table stays consistent", (await db.select().from(sessionsTable).where(eq(sessionsTable.userId, admin!.id))).length === 1);

    // One room
    const slot = inHours(96);
    const taken = await call("/lectures", teacherToken, lecture({ startsAt: slot, priceCents: 10000 }));
    check("the first class takes the hour", taken.status === 201);
    const clash = await call("/lectures", rivalToken, lecture({ startsAt: slot, priceCents: 10000 }));
    check("a second teacher cannot publish that hour", clash.status === 409 && clash.data.code === "slot_taken");
    check("overlap by a few minutes is refused", (await call("/lectures", rivalToken, lecture({ startsAt: new Date(new Date(slot).getTime() + 50 * 60_000).toISOString() }))).status === 409);
    check("the turnover gap is respected", (await call("/lectures", rivalToken, lecture({ startsAt: new Date(new Date(slot).getTime() + 70 * 60_000).toISOString() }))).status === 409);
    const later = await call("/lectures", rivalToken, lecture({ startsAt: new Date(new Date(slot).getTime() + 90 * 60_000).toISOString() }));
    check("the next free time works", later.status === 201);
    const draft = await call("/lectures", rivalToken, lecture({ startsAt: slot, publish: false }));
    check("a draft holds no room", draft.status === 201 && draft.data.status === "draft");
    check("publishing into a taken hour is refused", (await call(`/lectures/${draft.data.id}`, rivalToken, lecture({ startsAt: slot }), "PATCH")).status === 409);
    check("moving a class into a taken hour is refused", (await call(`/lectures/${later.data.id}`, rivalToken, lecture({ startsAt: slot }), "PATCH")).status === 409);
    check("editing a class in place still works", (await call(`/lectures/${taken.data.id}`, teacherToken, lecture({ title: "عنوان جديد", startsAt: slot, priceCents: 10000 }), "PATCH")).status === 200);
    const racing = await Promise.all([call("/lectures", teacherToken, lecture({ startsAt: inHours(200) })), call("/lectures", rivalToken, lecture({ startsAt: inHours(200) }))]);
    check("two teachers racing for an hour get one room", racing.filter((r) => r.status === 201).length === 1 && racing.filter((r) => r.status === 409).length === 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  console.log(`${checks} hardening checks passed`);
});
