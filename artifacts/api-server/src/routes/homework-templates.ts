import { Router } from "express";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { db, homeworkTemplatesTable, usersTable } from "@workspace/db";
import { homeworkTemplateInputSchema, type HomeworkTemplateDTO } from "@workspace/live-core";
import { requireRole } from "../lib/auth";
import { badRequest, notFound, parse, uuidParam } from "../lib/http";
const router = Router();
const dto = (t: typeof homeworkTemplatesTable.$inferSelect): HomeworkTemplateDTO => ({ id: t.id, title: t.title, instructions: t.instructions, questions: t.questions, maxScore: t.maxScore, createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString() });
router.get("/homework-templates", async (req, res) => {
  const user = requireRole(req, "teacher");
  const rows = await db.select({ id: homeworkTemplatesTable.id, title: homeworkTemplatesTable.title, maxScore: homeworkTemplatesTable.maxScore, questionCount: sql<number>`jsonb_array_length(${homeworkTemplatesTable.questions})`, updatedAt: homeworkTemplatesTable.updatedAt }).from(homeworkTemplatesTable).where(eq(homeworkTemplatesTable.teacherId, user.id)).orderBy(desc(homeworkTemplatesTable.updatedAt));
  res.json(rows.map(t => ({ ...t, questionCount: Number(t.questionCount), updatedAt: t.updatedAt.toISOString() })));
});
router.get("/homework-templates/:id", async (req, res) => {
  const user = requireRole(req, "teacher");
  const row = await db.query.homeworkTemplatesTable.findFirst({ where: and(eq(homeworkTemplatesTable.id, uuidParam(req.params.id)), eq(homeworkTemplatesTable.teacherId, user.id)) });
  if (!row) throw notFound("القالب غير متاح");
  res.json(dto(row));
});
router.post("/homework-templates", async (req, res) => {
  const user = requireRole(req, "teacher");
  const input = parse(homeworkTemplateInputSchema, req.body);
  const row = await db.transaction(async tx => {
    await tx.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, user.id)).for("update");
    const [total] = await tx.select({ n: count() }).from(homeworkTemplatesTable).where(eq(homeworkTemplatesTable.teacherId, user.id));
    if (Number(total?.n) >= 100) throw badRequest("لديك 100 قالب. احذف قالبًا قديمًا قبل إضافة آخر.");
    const [created] = await tx.insert(homeworkTemplatesTable).values({ teacherId: user.id, ...input }).returning();
    return created!;
  });
  res.status(201).json(dto(row));
});
router.patch("/homework-templates/:id", async (req, res) => {
  const user = requireRole(req, "teacher");
  const input = parse(homeworkTemplateInputSchema, req.body);
  const [row] = await db.update(homeworkTemplatesTable).set({ ...input, updatedAt: new Date() }).where(and(eq(homeworkTemplatesTable.id, uuidParam(req.params.id)), eq(homeworkTemplatesTable.teacherId, user.id))).returning();
  if (!row) throw notFound("القالب غير متاح");
  res.json(dto(row));
});
router.delete("/homework-templates/:id", async (req, res) => {
  const user = requireRole(req, "teacher");
  const [row] = await db.delete(homeworkTemplatesTable).where(and(eq(homeworkTemplatesTable.id, uuidParam(req.params.id)), eq(homeworkTemplatesTable.teacherId, user.id))).returning({ id: homeworkTemplatesTable.id });
  if (!row) throw notFound("القالب غير متاح");
  res.json({ ok: true });
});
export default router;
