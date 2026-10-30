import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

test("teacher portfolios, cover ownership, reusable homework and attendance-gated ratings", async () => {
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    if (url.hostname !== "gahez-audit-db-20261030" || url.pathname !== "/audit_teacher_tools" || url.username !== "audit" || process.env.TEACHER_TOOLS_TEST_DATABASE !== "isolated") throw new Error("Refusing teacher-tools tests outside isolated audit database");
  }
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../tmp");
  await mkdir(root, { recursive: true });
  const dir = await mkdtemp(path.join(root, "teacher-tools-test-"));
  Object.assign(process.env, { NODE_ENV: "test", PAYMENT_PROVIDER: "mock", ADMIN_EMAILS: "", SUPER_ADMIN_EMAILS: "", SMTP_HOST: "", SMTP_USER: "", SMTP_PASS: "", LIVEKIT_URL: "", LOG_LEVEL: "silent", UPLOAD_DIR: path.join(dir, "uploads") });
  const database = await import("@workspace/db");
  const { initDb, usersTable, teacherProfilesTable, lecturesTable, bookingsTable, attendanceTable, userSecurityTable, verificationDocumentsTable, teacherVerificationsTable } = database;
  const { eq } = await import("drizzle-orm");
  await initDb({ migrationsFolder: path.resolve(root, "../lib/db/drizzle"), pgliteDir: dir });
  const { db } = database;
  const { createSession } = await import("./auth");
  const { default: app } = await import("../app");
  const suffix = randomUUID().slice(0, 8);
  const [teacher, other, student, second, hidden] = await db.insert(usersTable).values([
    { role: "teacher" as const, name: "Teacher A", email: `teacher-${suffix}@audit.gahez`, phone: "private-phone", passwordHash: "unused" },
    { role: "teacher" as const, name: "Teacher B", email: `other-${suffix}@audit.gahez`, passwordHash: "unused" },
    { role: "student" as const, name: "Student A", email: `student-${suffix}@audit.gahez`, passwordHash: "unused" },
    { role: "student" as const, name: "Student B", email: `second-${suffix}@audit.gahez`, passwordHash: "unused" },
    { role: "teacher" as const, name: "Suspended", email: `hidden-${suffix}@audit.gahez`, passwordHash: "unused", suspended: true },
  ]).returning();
  await db.insert(teacherProfilesTable).values([{ userId: teacher!.id }, { userId: other!.id }]);
  const [teacherToken, otherToken, studentToken, secondToken] = await Promise.all([teacher!, other!, student!, second!].map(u => createSession(u.id)));
  const server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
  let checks = 0;
  const check = (name: string, result: unknown) => { assert.ok(result, name); checks++; };
  const call = async (route: string, token?: string, body?: unknown, method?: string) => {
    const response = await fetch(base + route, { method: method ?? (body === undefined ? "GET" : "POST"), headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json() as any };
  };
  const patch = (token: string, body: unknown) => call("/me", token, body, "PATCH");
  const upload = async (token: string, pdf = false) => { const response = await fetch(base + "/uploads", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": pdf ? "application/pdf" : "image/png", "X-Filename": pdf ? "certificate.pdf" : "avatar.png" }, body: pdf ? Buffer.from("%PDF-1.4\n%%EOF") : Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2IX8AAAAASUVORK5CYII=", "base64") }); return await response.json() as any; };
  try {
    const mine = await upload(teacherToken!), foreign = await upload(studentToken!), document = await upload(teacherToken!, true);
    check("teacher cannot publish another user's photo", (await patch(teacherToken!, { avatarUrl: foreign.url })).status === 400);
    check("encoded upload IDs cannot bypass ownership", (await patch(teacherToken!, { avatarUrl: foreign.url.replace(foreign.id, '%'+foreign.id.charCodeAt(0).toString(16)+foreign.id.slice(1)) })).status === 400);
    check("avatar must be an image", (await patch(teacherToken!, { avatarUrl: document.url })).status === 400);
    check("active-content URLs rejected", (await patch(teacherToken!, { socialLinks: [{ label: "Bad", url: "javascript:alert(1)" }] })).status === 400);
    check("malformed upload URL is a validation error", (await patch(teacherToken!, { avatarUrl: mine.url.replace(mine.id, '%') })).status === 400);
    const saved = await patch(teacherToken!, { name: "أحمد رمضان", avatarUrl: mine.url, bio: "مدرس الفيزياء", experience: "خبرة في تبسيط المسائل", headline: "نفهم الفيزياء خطوة بخطوة", socialLinks: [{ label: "قناتي", url: "https://example.com/teacher" }], certificates: [{ label: "شهادة العلوم", url: mine.url, kind: "image" }, { label: "شهادة الخبرة", url: document.url, kind: "document" }] });
    check("teacher can save photo, experience, links and certificates", saved.status === 200 && saved.data.teacher.certificates.length === 2 && saved.data.teacher.experience.length > 0);
    check("student can save own photo", (await patch(studentToken!, { avatarUrl: foreign.url })).status === 200);
    const publicProfile = await call(`/teachers/${teacher!.id}`);
    check("profile is public and carries explicit public links", publicProfile.status === 200 && publicProfile.data.teacher.name === "أحمد رمضان" && publicProfile.data.teacher.certificates[0].kind === "image");
    const publicJson = JSON.stringify(publicProfile.data);
    check("private email, phone and user authority are absent", !publicJson.includes(teacher!.email) && !publicJson.includes("private-phone") && !publicJson.includes("password") && !publicJson.includes("isSuperAdmin"));
    check("unrated teacher has null percentage", publicProfile.data.rating.total === 0 && publicProfile.data.rating.positivePercent === null);
    check("student is not a public teacher", (await call(`/teachers/${student!.id}`)).status === 404);
    check("suspended teacher is not public", (await call(`/teachers/${hidden!.id}`)).status === 404);
    const input = { title: "الكهربية", subject: "physics", grade: "g12", description: "شرح مبسط", startsAt: new Date(Date.now() + 86400000).toISOString(), durationMin: 90, priceCents: 0, publish: true, listed: true, coverUrl: mine.url };
    check("unverified teacher cannot create lectures", (await call("/lectures", teacherToken!, input)).status === 403);
    // Explicit approved fixture in this isolated DB; there is no approval bypass in the HTTP API.
    const { sealSecret, newTotpSecret } = await import("./two-factor");
    await db.insert(userSecurityTable).values({ totpSecretEnc: sealSecret(newTotpSecret()), userId: teacher!.id, googleSubject: `fixture-${suffix}`, googleEmail: teacher!.email, totpEnabledAt: new Date() });
    const docs = await db.insert(verificationDocumentsTable).values([0,1].map(n => ({ ownerId: teacher!.id, filename: `fixture-${n}.png`, mime: "image/png", size: 1, storageKey: "isolated-fixture-only" }))).returning();
    await db.insert(teacherVerificationsTable).values({ teacherId: teacher!.id, status: "approved", fullName: teacher!.name, phone: "01012345678", subject: "physics", governorate: "القاهرة", qualification: "بكالوريوس العلوم", experienceYears: 3, membershipNumber: "fixture", frontDocumentId: docs[0]!.id, backDocumentId: docs[1]!.id });
    check("foreign cover rejected", (await call("/lectures", teacherToken!, { ...input, coverUrl: foreign.url })).status === 400);
    const created = await call("/lectures", teacherToken!, input);
    check("cover saved and returned on public lesson", created.status === 201 && (await call(`/l/${created.data.code}`)).data.coverUrl === mine.url);
    const lectureId = created.data.id;
    await db.update(lecturesTable).set({ status: "live", startsAt: new Date(Date.now() - 5 * 60000), liveStartedAt: new Date(Date.now() - 5 * 60000) }).where(eq(lecturesTable.id, lectureId));
    await db.insert(bookingsTable).values([student!, second!].map(u => ({ lectureId, studentId: u.id, status: "confirmed" as const, pricePaidCents: 0 })));
    await db.insert(attendanceTable).values([{ lectureId, studentId: student!.id, liveSeconds: 179, lastSeenAt: new Date(Date.now() - 30000) }, { lectureId, studentId: second!.id, liveSeconds: 180 }]);
    check("rating locked before sufficient attendance", !(await call(`/lectures/${lectureId}`, studentToken!)).data.votes.canVote);
    check("early vote rejected on server", (await call(`/lectures/${lectureId}/vote`, studentToken!, { value: 1 })).status >= 400);
    check("heartbeat accepted for booked viewer", (await call(`/lectures/${lectureId}/heartbeat`, studentToken!, { mode: "live" })).status === 200);
    check("fresh lecture query unlocks after credited attendance", (await call(`/lectures/${lectureId}`, studentToken!)).data.votes.canVote === true);
    check("like and dislike accepted after attendance", (await call(`/lectures/${lectureId}/vote`, studentToken!, { value: 1 })).status === 200 && (await call(`/lectures/${lectureId}/vote`, secondToken!, { value: -1 })).status === 200);
    let rating = (await call(`/teachers/${teacher!.id}`)).data.rating;
    check("profile aggregates actual ratings with denominator", rating.likes === 1 && rating.dislikes === 1 && rating.total === 2 && rating.raters === 2 && rating.positivePercent === 50);
    await call(`/lectures/${lectureId}/vote`, studentToken!, { value: -1 });
    rating = (await call(`/teachers/${teacher!.id}`)).data.rating;
    check("changing a vote replaces it, does not duplicate it", rating.likes === 0 && rating.dislikes === 2 && rating.total === 2 && rating.positivePercent === 0);
    await db.insert(lecturesTable).values(Array.from({ length: 13 }, (_, index) => ({ teacherId: teacher!.id, code: `${suffix}${index}`, title: `حصة ${index}`, subject: "physics", grade: "g12", startsAt: new Date(Date.now() + (index + 1) * 86400000), durationMin: 90, priceCents: 0, status: "scheduled" as const })));
    await db.insert(lecturesTable).values([{ teacherId: teacher!.id, code: `private${suffix}`, title: "Private lesson", subject: "physics", grade: "g12", startsAt: new Date(Date.now() + 86400000), durationMin: 90, priceCents: 0, listed: false }, { teacherId: teacher!.id, code: `draft${suffix}`, title: "Draft lesson", subject: "physics", grade: "g12", startsAt: new Date(Date.now() + 86400000), durationMin: 90, priceCents: 0, status: "draft" }, { teacherId: other!.id, code: `other${suffix}`, title: "Other teacher lesson", subject: "physics", grade: "g12", startsAt: new Date(Date.now() + 86400000), durationMin: 90, priceCents: 0 }]);
    const firstPage = await call(`/teachers/${teacher!.id}/lectures`);
    const nextPage = await call(`/teachers/${teacher!.id}/lectures?offset=${firstPage.data.nextOffset}`);
    check("public lectures paginate without leaking draft or link-only lessons", firstPage.status === 200 && firstPage.data.items.length === 12 && nextPage.data.items.length === 2 && !JSON.stringify([...firstPage.data.items, ...nextPage.data.items]).includes("Private lesson") && !JSON.stringify(firstPage.data).includes("Draft lesson"));
    const from = new Date(Date.now() - 86400000).toISOString(), to = new Date(Date.now() + 7 * 86400000).toISOString();
    const calendar = await call(`/teacher/calendar?from=${from}&to=${to}`, teacherToken!);
    check("calendar includes own drafts and private lessons only", calendar.status === 200 && calendar.data.some((l: any) => l.title === "Draft lesson") && !calendar.data.some((l: any) => l.teacher.id !== teacher!.id));
    check("student cannot read teacher calendar", (await call(`/teacher/calendar?from=${from}&to=${to}`, studentToken!)).status === 403);
    check("calendar rejects excessive date ranges", (await call(`/teacher/calendar?from=${from}&to=${new Date(Date.now() + 60 * 86400000).toISOString()}`, teacherToken!)).status === 400);
    const templateBody = { title: "قالب قانون أوم", instructions: "اختر الإجابة", maxScore: 2, questions: [{ id: randomUUID(), prompt: "ما وحدة المقاومة؟", options: ["أوم", "فولت"], correctIndex: 0, points: 2 }], dueAt: new Date(Date.now() + 86400000).toISOString() };
    const template = await call("/homework-templates", teacherToken!, templateBody);
    check("quiz template saved without a reusable stale deadline", template.status === 201 && !Object.hasOwn(template.data, "dueAt") && template.data.questions[0].correctIndex === 0);
    const templateId = template.data.id;
    check("library summary omits question answer keys", !(await call("/homework-templates", teacherToken!)).data[0].questions);
    check("another teacher cannot read or alter template", (await call(`/homework-templates/${templateId}`, otherToken!)).status === 404 && (await call(`/homework-templates/${templateId}`, otherToken!, templateBody, "PATCH")).status === 404 && (await call(`/homework-templates/${templateId}`, otherToken!, undefined, "DELETE")).status === 404);
    check("student cannot list or read teacher answer keys", (await call("/homework-templates", studentToken!)).status === 403 && (await call(`/homework-templates/${templateId}`, studentToken!)).status === 403);
    const assignment = await call(`/lectures/${lectureId}/assignments`, teacherToken!, templateBody);
    check("template content can publish a normal assignment", assignment.status === 201);
    const studentAssignment = await call(`/assignments/${assignment.data.id}`, studentToken!);
    check("student assignment hides correct answers", studentAssignment.status === 200 && !JSON.stringify(studentAssignment.data).includes("correctIndex"));
    check("template update succeeds", (await call(`/homework-templates/${templateId}`, teacherToken!, { ...templateBody, instructions: "Updated template" }, "PATCH")).status === 200);
    check("published assignment is independent of later template edits", (await call(`/assignments/${assignment.data.id}`, teacherToken!)).data.instructions === templateBody.instructions);
    check("template deletion does not delete published assignment", (await call(`/homework-templates/${templateId}`, teacherToken!, undefined, "DELETE")).status === 200 && (await call(`/assignments/${assignment.data.id}`, teacherToken!)).status === 200);
    console.log(`${checks} teacher-tools and live-rating checks passed`);
  } finally {
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
    if (database.pool) await database.pool.end(); else await (db as any).$client.close();
    await rm(dir, { recursive: true, force: true });
  }
});
