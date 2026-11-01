import express, { Router } from "express";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, count, desc, eq, gte, inArray } from "drizzle-orm";
import { db, verificationDocumentsTable, teacherVerificationsTable, usersTable, verificationReviewsTable } from "@workspace/db";
import { teacherVerificationInputSchema, verificationReviewSchema, type VerificationAdminDetail } from "@workspace/live-core";
import { isSuperAdmin, requireRole, requireUser } from "../lib/auth";
import { sendVerificationRequest } from "../lib/emails";
import { requireOwner, verificationDTO } from "../lib/teacher-verification";
import { badRequest, conflict, notFound, parse, uuidParam } from "../lib/http";
import { env } from "../lib/env";
import { saveFile } from "../lib/storage";
import { openPrivateDocument, sealPrivateDocument } from "../lib/two-factor";
import { notify } from "../lib/notify";
const router = Router();
router.get("/teacher/verification", async (req, res) => { const user = requireRole(req, "teacher"); res.json(await verificationDTO(user.id, !req.impersonation)); });
router.post("/teacher/verification/documents", (req,_res,next)=>{requireRole(req,"teacher");next();}, express.raw({ type: () => true, limit: "8mb" }), async (req, res) => {
  const user = requireRole(req, "teacher");
  const mime = String(req.headers["content-type"] ?? "").split(";")[0]!.trim();
  const data = req.body as Buffer;
  if (!Buffer.isBuffer(data) || !data.length) throw badRequest("اختر صورة واضحة للكارنيه");
  const valid = mime === "image/jpeg" ? data[0] === 255 && data[1] === 216 && data[2] === 255 : mime === "image/png" ? data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : mime === "image/webp" ? data.toString("ascii",0,4) === "RIFF" && data.toString("ascii",8,12) === "WEBP" : false;
  if (!valid) throw badRequest("ارفع صورة JPEG أو PNG أو WebP صحيحة");
  const [today] = await db.select({ n: count() }).from(verificationDocumentsTable).where(and(eq(verificationDocumentsTable.ownerId, user.id), gte(verificationDocumentsTable.createdAt, new Date(Date.now() - 86400000))));
  if (Number(today?.n) >= 20) throw badRequest("وصلت إلى الحد اليومي لرفع صور التوثيق. حاول غدًا.");
  let filename: string; try { filename = decodeURIComponent(String(req.headers["x-filename"] ?? "membership-card.jpg")).slice(0,120); } catch { throw badRequest("اسم الملف غير صالح"); }
  const id = randomUUID(), storageKey = await saveFile(id, sealPrivateDocument(data, id));
  await db.insert(verificationDocumentsTable).values({ id, ownerId: user.id, filename, mime, size: data.length, storageKey });
  res.status(201).json({ id, filename, mime, size: data.length });
});
router.get("/teacher/verification/documents/:id", async (req, res) => {
  const user = requireUser(req), id = uuidParam(req.params.id);
  const row = await db.query.verificationDocumentsTable.findFirst({ where: eq(verificationDocumentsTable.id,id) });
  if (!row || (row.ownerId !== user.id && (req.impersonation || !isSuperAdmin(user)))) throw notFound("الملف غير متاح");
  const data = openPrivateDocument(await readFile(path.join(env.uploadDir,row.storageKey)), row.id);
  res.set({ "Content-Type": row.mime, "Content-Length": String(data.length), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(row.filename)}` }).send(data);
});
router.post("/teacher/verification/submit", async (req,res) => {
  const user = requireRole(req,"teacher"), input = parse(teacherVerificationInputSchema,req.body);
  await db.transaction(async tx => {
    const docs = await tx.select().from(verificationDocumentsTable).where(and(eq(verificationDocumentsTable.ownerId,user.id),inArray(verificationDocumentsTable.id,[input.frontDocumentId,input.backDocumentId])));
    if(docs.length!==2) throw badRequest("ارفع صورتي الكارنيه من حسابك");
    const current = await tx.query.teacherVerificationsTable.findFirst({where:eq(teacherVerificationsTable.teacherId,user.id)});
    if(current?.status==="pending") throw conflict("طلبك قيد المراجعة بالفعل");
    const submittedAt = new Date();
    await tx.insert(teacherVerificationsTable).values({teacherId:user.id,...input,status:"pending",submittedAt}).onConflictDoUpdate({target:teacherVerificationsTable.teacherId,set:{...input,status:"pending",submittedAt,reviewedAt:null,reviewerId:null,note:""}});
    await tx.insert(verificationReviewsTable).values({teacherId:user.id,actorId:user.id,action:"submitted"});
  });
  const admins = await db.select().from(usersTable).where(and(eq(usersTable.role,"admin"),eq(usersTable.suspended,false)));
  const owners=admins.filter(isSuperAdmin);
  await notify(owners.map(u=>u.id),{kind:"verification",title:"طلب توثيق مدرس جديد",body:user.name,link:`/admin/teacher-verifications/${user.id}`});
  void sendVerificationRequest(owners,user);
  res.json(await verificationDTO(user.id,!req.impersonation));
});
router.get("/admin/teacher-verifications",async(req,res)=>{
  requireOwner(req);
  const status=String(req.query.status??"all"),offset=Number(req.query.offset??0);
  if(!["all","pending","approved","rejected","needs_changes"].includes(status)||!Number.isSafeInteger(offset)||offset<0||offset>100000)throw badRequest("مرشح الطلبات غير صالح");
  const totals=await db.select({status:teacherVerificationsTable.status,n:count()}).from(teacherVerificationsTable).groupBy(teacherVerificationsTable.status);
  const counts={pending:0,approved:0,rejected:0,needs_changes:0};for(const row of totals)counts[row.status]=Number(row.n);
  const rows=await db.select({teacherId:teacherVerificationsTable.teacherId,status:teacherVerificationsTable.status,fullName:teacherVerificationsTable.fullName,subject:teacherVerificationsTable.subject,submittedAt:teacherVerificationsTable.submittedAt,name:usersTable.name,email:usersTable.email,avatarUrl:usersTable.avatarUrl}).from(teacherVerificationsTable).innerJoin(usersTable,eq(usersTable.id,teacherVerificationsTable.teacherId)).where(status==="all"?undefined:eq(teacherVerificationsTable.status,status as "pending"|"approved"|"rejected"|"needs_changes")).orderBy(desc(teacherVerificationsTable.submittedAt)).limit(31).offset(offset);
  res.json({counts,nextOffset:rows.length>30?offset+30:null,items:rows.slice(0,30).map(row=>({teacher:{id:row.teacherId,name:row.name,email:row.email,avatarUrl:row.avatarUrl},status:row.status,fullName:row.fullName,subject:row.subject,submittedAt:row.submittedAt.toISOString()}))});
});
router.get("/admin/teacher-verifications/:id",async(req,res)=>{
  requireOwner(req); const id=uuidParam(req.params.id),teacher=await db.query.usersTable.findFirst({where:and(eq(usersTable.id,id),eq(usersTable.role,"teacher"))});
  if(!teacher)throw notFound();
  const state=await verificationDTO(id),history=await db.select().from(verificationReviewsTable).where(eq(verificationReviewsTable.teacherId,id)).orderBy(desc(verificationReviewsTable.createdAt)).limit(50);
  const body: VerificationAdminDetail={...state,teacher:{id,name:teacher.name,email:teacher.email,avatarUrl:teacher.avatarUrl},history:history.map(row=>({action:row.action,note:row.note,createdAt:row.createdAt.toISOString()}))};res.json(body);
});
router.post("/admin/teacher-verifications/:id/review",async(req,res)=>{
  const owner=requireOwner(req),id=uuidParam(req.params.id),input=parse(verificationReviewSchema,req.body);
  const status=input.action==="approve"?"approved":input.action==="reject"?"rejected":"needs_changes";
  await db.transaction(async tx=>{
    const [request]=await tx.select().from(teacherVerificationsTable).where(eq(teacherVerificationsTable.teacherId,id)).for("update");
    if(!request||request.status!=="pending")throw conflict("الطلب ليس قيد المراجعة الآن");
    if(request.submittedAt.toISOString()!==input.submittedAt)throw conflict("تغيّر الطلب. حدّث الصفحة وراجعه من جديد.");
    const user=await tx.query.usersTable.findFirst({where:eq(usersTable.id,id)});if(input.action==="approve"&&(!user||user.suspended||user.role!=="teacher"))throw badRequest("حساب المدرس غير متاح للموافقة");
    await tx.update(teacherVerificationsTable).set({status,note:input.note,reviewedAt:new Date(),reviewerId:owner.id}).where(eq(teacherVerificationsTable.teacherId,id));
    await tx.insert(verificationReviewsTable).values({teacherId:id,actorId:owner.id,action:status,note:input.note});
  });
  await notify([id],{kind:"verification",title:status==="approved"?"تم توثيق حسابك":status==="rejected"?"لم يُقبل طلب التوثيق":"طلب التوثيق يحتاج إلى تعديل",body:input.note||"تقدر دلوقتي تعمل حصص مدفوعة وتظهر في الرئيسية.",link:"/t/verification"});
  res.json(await verificationDTO(id));
});
export default router;
