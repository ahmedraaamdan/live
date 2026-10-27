import { Router } from "express";
import { and, count, desc, eq, inArray, isNotNull } from "drizzle-orm";
import {
  assignmentsTable,
  bookingsTable,
  db,
  lecturesTable,
  submissionsTable,
  usersTable,
  type Assignment,
  type Submission,
  type User,
} from "@workspace/db";
import {
  assignmentInputSchema,
  gradeInputSchema,
  submissionInputSchema,
  type AssignmentDTO,
  type AssignmentDetailDTO,
  type SubmissionDTO,
} from "@workspace/live-core";
import { assertAccess, assertOwner, bookedStudentIds, getLecture, isParentOf } from "../lib/access";
import { requireRole, requireUser } from "../lib/auth";
import { parentsOf } from "../lib/bookings";
import { toMini, uploadsById } from "../lib/dto";
import { sendGraded, sendNewAssignment } from "../lib/emails";
import { badRequest, forbidden, notFound, parse, uuidParam } from "../lib/http";
import { notify } from "../lib/notify";

const router = Router();

async function submissionDTOs(subs: Submission[], withStudent: boolean): Promise<SubmissionDTO[]> {
  const uploads = await uploadsById(subs.flatMap((s) => s.attachmentIds));
  const students = withStudent && subs.length ? await db.select().from(usersTable).where(inArray(usersTable.id, subs.map((s) => s.studentId))) : [];
  const studentBy = new Map(students.map((s) => [s.id, s]));
  return subs.map((s) => ({
    id: s.id,
    assignmentId: s.assignmentId,
    body: s.body,
    attachments: s.attachmentIds.map((id) => uploads.get(id)).filter((u) => u !== undefined),
    submittedAt: s.submittedAt.toISOString(),
    score: s.score,
    feedback: s.feedback,
    gradedAt: s.gradedAt?.toISOString() ?? null,
    student: studentBy.has(s.studentId) ? toMini(studentBy.get(s.studentId)!) : null,
  }));
}

function base(a: Assignment, lectureTitle: string): Omit<AssignmentDTO, "counts" | "mySubmission"> {
  return {
    id: a.id,
    lectureId: a.lectureId,
    lectureTitle,
    title: a.title,
    instructions: a.instructions,
    dueAt: a.dueAt?.toISOString() ?? null,
    maxScore: a.maxScore,
    createdAt: a.createdAt.toISOString(),
  };
}

/** Assignments on every lecture a student has booked, with their own submission. */
export async function studentAssignments(student: Pick<User, "id">): Promise<AssignmentDTO[]> {
  const rows = await db
    .select({ a: assignmentsTable, title: lecturesTable.title })
    .from(assignmentsTable)
    .innerJoin(lecturesTable, eq(lecturesTable.id, assignmentsTable.lectureId))
    .innerJoin(bookingsTable, and(eq(bookingsTable.lectureId, lecturesTable.id), eq(bookingsTable.studentId, student.id), eq(bookingsTable.status, "confirmed")))
    .orderBy(desc(assignmentsTable.createdAt));
  if (rows.length === 0) return [];
  const subs = await db
    .select()
    .from(submissionsTable)
    .where(and(eq(submissionsTable.studentId, student.id), inArray(submissionsTable.assignmentId, rows.map((r) => r.a.id))));
  const subDTOs = await submissionDTOs(subs, false);
  const subBy = new Map(subDTOs.map((s) => [s.assignmentId, s]));
  return rows.map(({ a, title }) => ({ ...base(a, title), counts: null, mySubmission: subBy.get(a.id) ?? null }));
}

async function teacherAssignments(teacherId: string, lectureId?: string): Promise<AssignmentDTO[]> {
  const rows = await db
    .select({ a: assignmentsTable, title: lecturesTable.title })
    .from(assignmentsTable)
    .innerJoin(lecturesTable, eq(lecturesTable.id, assignmentsTable.lectureId))
    .where(and(eq(assignmentsTable.teacherId, teacherId), lectureId ? eq(assignmentsTable.lectureId, lectureId) : undefined))
    .orderBy(desc(assignmentsTable.createdAt));
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.a.id);
  const lectureIds = [...new Set(rows.map((r) => r.a.lectureId))];
  const [submitted, graded, seats] = await Promise.all([
    db.select({ id: submissionsTable.assignmentId, n: count() }).from(submissionsTable).where(inArray(submissionsTable.assignmentId, ids)).groupBy(submissionsTable.assignmentId),
    db
      .select({ id: submissionsTable.assignmentId, n: count() })
      .from(submissionsTable)
      .where(and(inArray(submissionsTable.assignmentId, ids), isNotNull(submissionsTable.gradedAt)))
      .groupBy(submissionsTable.assignmentId),
    db
      .select({ id: bookingsTable.lectureId, n: count() })
      .from(bookingsTable)
      .where(and(inArray(bookingsTable.lectureId, lectureIds), eq(bookingsTable.status, "confirmed")))
      .groupBy(bookingsTable.lectureId),
  ]);
  const m = (xs: Array<{ id: string; n: number }>) => new Map(xs.map((x) => [x.id, Number(x.n)]));
  const [sub, gr, st] = [m(submitted), m(graded), m(seats)];
  return rows.map(({ a, title }) => ({
    ...base(a, title),
    counts: { submitted: sub.get(a.id) ?? 0, graded: gr.get(a.id) ?? 0, students: st.get(a.lectureId) ?? 0 },
    mySubmission: null,
  }));
}

router.get("/assignments", async (req, res) => {
  const user = requireUser(req);
  const lectureId = typeof req.query.lectureId === "string" ? req.query.lectureId : undefined;
  if (user.role === "teacher") return void res.json(await teacherAssignments(user.id, lectureId));
  if (user.role === "student") {
    const all = await studentAssignments(user);
    return void res.json(lectureId ? all.filter((a) => a.lectureId === lectureId) : all);
  }
  throw forbidden();
});

router.post("/lectures/:id/assignments", async (req, res) => {
  const user = requireRole(req, "teacher");
  const lecture = await getLecture(uuidParam(req.params.id));
  assertOwner(user, lecture);
  const input = parse(assignmentInputSchema, req.body);
  const [a] = await db
    .insert(assignmentsTable)
    .values({
      lectureId: lecture.id,
      teacherId: user.id,
      title: input.title,
      instructions: input.instructions,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      maxScore: input.maxScore,
    })
    .returning();
  const ids = await bookedStudentIds(lecture.id);
  await notify(ids, { kind: "assignment", title: "واجب جديد 📝", body: a!.title, link: `/s/assignments/${a!.id}` });
  if (ids.length) {
    const students = await db.select().from(usersTable).where(inArray(usersTable.id, ids));
    void sendNewAssignment(students, lecture.title, a!);
  }
  const [dto] = await teacherAssignments(user.id, lecture.id).then((xs) => xs.filter((x) => x.id === a!.id));
  res.status(201).json(dto);
});

router.get("/assignments/:id", async (req, res) => {
  const user = requireUser(req);
  const id = uuidParam(req.params.id);
  const a = await db.query.assignmentsTable.findFirst({ where: eq(assignmentsTable.id, id) });
  if (!a) throw notFound("الواجب ده مش موجود");
  const lecture = await getLecture(a.lectureId);

  if (user.role === "teacher" || user.role === "admin") {
    assertOwner(user, lecture);
    const [dto] = (await teacherAssignments(lecture.teacherId, lecture.id)).filter((x) => x.id === id);
    const subs = await db.select().from(submissionsTable).where(eq(submissionsTable.assignmentId, id)).orderBy(desc(submissionsTable.submittedAt));
    const body: AssignmentDetailDTO = { ...dto!, submissions: await submissionDTOs(subs, true) };
    return void res.json(body);
  }

  // A student sees their own work; a parent sees a child's (?studentId=).
  let studentId = user.id;
  if (user.role === "parent") {
    studentId = String(req.query.studentId ?? "");
    if (!(await isParentOf(user.id, studentId))) throw forbidden();
  } else {
    await assertAccess(user, lecture);
  }
  const [mine] = await db
    .select()
    .from(submissionsTable)
    .where(and(eq(submissionsTable.assignmentId, id), eq(submissionsTable.studentId, studentId)));
  const [sub] = mine ? await submissionDTOs([mine], false) : [];
  const body: AssignmentDetailDTO = { ...base(a, lecture.title), counts: null, mySubmission: sub ?? null, submissions: [] };
  res.json(body);
});

router.post("/assignments/:id/submit", async (req, res) => {
  const user = requireRole(req, "student");
  const id = uuidParam(req.params.id);
  const a = await db.query.assignmentsTable.findFirst({ where: eq(assignmentsTable.id, id) });
  if (!a) throw notFound("الواجب ده مش موجود");
  await assertAccess(user, await getLecture(a.lectureId));
  const input = parse(submissionInputSchema, req.body);
  if (!input.body && input.attachmentIds.length === 0) throw badRequest("اكتب إجابتك أو ارفع صورة الحل");
  const existing = await db.query.submissionsTable.findFirst({
    where: and(eq(submissionsTable.assignmentId, id), eq(submissionsTable.studentId, user.id)),
  });
  if (existing?.gradedAt) throw badRequest("الواجب اتصحّح خلاص، مينفعش تعدّله");
  const [s] = await db
    .insert(submissionsTable)
    .values({ assignmentId: id, studentId: user.id, body: input.body, attachmentIds: input.attachmentIds })
    .onConflictDoUpdate({
      target: [submissionsTable.assignmentId, submissionsTable.studentId],
      set: { body: input.body, attachmentIds: input.attachmentIds, submittedAt: new Date() },
    })
    .returning();
  if (!existing) await notify([a.teacherId], { kind: "submission", title: `${user.name} سلّم الواجب`, body: a.title, link: `/t/assignments/${a.id}` });
  const [dto] = await submissionDTOs([s!], false);
  res.json(dto);
});

router.post("/submissions/:id/grade", async (req, res) => {
  const user = requireRole(req, "teacher", "admin");
  const id = uuidParam(req.params.id);
  const sub = await db.query.submissionsTable.findFirst({ where: eq(submissionsTable.id, id) });
  if (!sub) throw notFound();
  const a = await db.query.assignmentsTable.findFirst({ where: eq(assignmentsTable.id, sub.assignmentId) });
  assertOwner(user, await getLecture(a!.lectureId));
  const { score, feedback } = parse(gradeInputSchema, req.body);
  if (score > a!.maxScore) throw badRequest(`أقصى درجة ${a!.maxScore}`);
  const [graded] = await db.update(submissionsTable).set({ score, feedback, gradedAt: new Date() }).where(eq(submissionsTable.id, id)).returning();

  const student = await db.query.usersTable.findFirst({ where: eq(usersTable.id, sub.studentId) });
  const parents = await parentsOf(sub.studentId);
  await notify([sub.studentId], { kind: "graded", title: "واجبك اتصحّح ✅", body: `${a!.title}: ${score}/${a!.maxScore}`, link: `/s/assignments/${a!.id}` });
  await notify(parents.ids, { kind: "graded", title: `درجة جديدة لـ${student!.name}`, body: `${a!.title}: ${score}/${a!.maxScore}`, link: `/p/children/${sub.studentId}` });
  void sendGraded({ student: student!, parentEmails: parents.emails, assignmentTitle: a!.title, score, maxScore: a!.maxScore, feedback, assignmentId: a!.id });
  const [dto] = await submissionDTOs([graded!], true);
  res.json(dto);
});

export default router;
