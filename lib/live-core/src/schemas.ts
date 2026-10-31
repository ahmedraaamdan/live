/**
 * Request bodies, validated by the API and reused by the app's forms so both
 * sides agree on what "valid" means. Error messages are user-facing Arabic.
 */
import { z } from "zod/v4";
import { MESSAGE_KINDS, MIN_PAID_PRICE_CENTS, MIN_PAYOUT_CENTS, PAYMENT_METHODS, PAYOUT_METHODS, REPORT_REASON_LABELS, SIGNUP_ROLES, TICKET_CATEGORY_LABELS, type ReportReason, type TicketCategory } from "./constants";

const email = z.email({ message: "اكتب إيميل صحيح" }).transform((v) => v.trim().toLowerCase());
const password = z.string().min(8, { message: "الباسورد لازم يكون 8 حروف على الأقل" }).max(200);
const name = z.string().trim().min(2, { message: "اكتب الاسم" }).max(80);
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ]{8,16}$/, { message: "اكتب رقم موبايل صحيح" })
  .optional()
  .or(z.literal("").transform(() => undefined));

export const signupSchema = z.object({
  role: z.enum(SIGNUP_ROLES),
  name,
  email,
  phone,
  password,
  grade: z.string().max(20).optional(),
  subject: z.string().max(40).optional(),
  parentEmail: email.optional().or(z.literal("").transform(() => undefined)),
  /** A child's link code, when a parent signs up from an invitation. */
  childCode: z.string().trim().max(20).optional(),
});
export type SignupInput = z.input<typeof signupSchema>;

export const loginSchema = z.object({ email, password: z.string().min(1, { message: "اكتب الباسورد" }) });
export type LoginInput = z.input<typeof loginSchema>;

export const forgotSchema = z.object({ email });
export const resetSchema = z.object({ token: z.string().min(10), password });

const publicUrl = z.url({ message: "أدخل رابطًا كاملًا يبدأ بـ https://" }).max(1000).refine(value => /^https?:\/\//i.test(value), { message: "الرابط يجب أن يبدأ بـ https://" });
export const profileLinkSchema = z.object({ label: z.string().trim().min(2, { message: "أدخل اسم الرابط أو الشهادة" }).max(100), url: publicUrl, kind: z.enum(["image", "document", "link"]).optional() });
export const profileUpdateSchema = z.object({
  name: name.optional(),
  phone,
  avatarUrl: publicUrl.or(z.literal("")).optional(),
  experience: z.string().trim().max(3000).optional(),
  socialLinks: z.array(profileLinkSchema).max(8).optional(),
  certificates: z.array(profileLinkSchema).max(12).optional(),
  bio: z.string().max(600).optional(),
  headline: z.string().max(120).optional(),
  subject: z.string().max(40).optional(),
  grade: z.string().max(20).optional(),
  parentEmail: email.optional().or(z.literal("").transform(() => undefined)),
});
export type ProfileUpdateInput = z.input<typeof profileUpdateSchema>;

export const lectureInputSchema = z.object({
  title: z.string().trim().min(3, { message: "اكتب عنوان الحصة" }).max(120),
  subject: z.string().min(1, { message: "اختار المادة" }).max(40),
  grade: z.string().min(1, { message: "اختار الصف" }).max(20),
  description: z.string().trim().max(2000).optional().default(""),
  coverUrl: publicUrl.nullable().optional(),
  /** ISO timestamp. */
  startsAt: z.iso.datetime({ offset: true, message: "اختار ميعاد صحيح" }),
  durationMin: z.coerce.number().int().min(15, { message: "أقل مدة 15 دقيقة" }).max(300, { message: "أقصى مدة 5 ساعات" }),
  priceCents: z.coerce.number().int().min(0).max(100_000_00).refine(value => value === 0 || value >= MIN_PAID_PRICE_CENTS, { message: `أقل سعر للحصة المدفوعة ${MIN_PAID_PRICE_CENTS / 100} ج.م` }),
  capacity: z.coerce.number().int().min(1).max(10_000).nullable().optional(),
  publish: z.boolean().optional().default(true),
  /** Show it in the discovery feed, not only to people with the link. */
  listed: z.boolean().optional().default(true),
});
export type LectureInput = z.input<typeof lectureInputSchema>;

export const messageInputSchema = z.object({
  kind: z.enum(MESSAGE_KINDS).default("question"),
  body: z.string().trim().min(1, { message: "اكتب سؤالك" }).max(1000),
  parentId: z.string().uuid().optional(),
});
export type MessageInput = z.input<typeof messageInputSchema>;

export const messagePatchSchema = z.object({
  answered: z.boolean().optional(),
  pinned: z.boolean().optional(),
});

export const heartbeatSchema = z.object({ mode: z.enum(["live", "replay"]).default("live") });

export const quizQuestionSchema = z.object({
  id: z.string().uuid(),
  prompt: z.string().trim().min(3, { message: "اكتب نص السؤال (3 أحرف على الأقل)" }).max(1000),
  options: z.array(z.string().trim().min(1, { message: "أكمل جميع خيارات السؤال" }).max(400)).min(2).max(6),
  correctIndex: z.number().int().min(0),
  points: z.number().int({ message: "درجة السؤال يجب أن تكون عددًا صحيحًا" }).min(1, { message: "أقل درجة للسؤال هي 1" }).max(100, { message: "أقصى درجة للسؤال هي 100" }),
}).superRefine((q, ctx) => {
  if (q.correctIndex >= q.options.length) ctx.addIssue({ code: 'custom', message: 'اختر الإجابة الصحيحة', path: ['correctIndex'] });
  if (new Set(q.options.map(o => o.toLowerCase())).size !== q.options.length) ctx.addIssue({ code: 'custom', message: 'يجب أن تكون الخيارات مختلفة', path: ['options'] });
});
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;

export const assignmentInputSchema = z.object({
  title: z.string().trim().min(3, { message: "اكتب عنوان الواجب" }).max(120),
  instructions: z.string().trim().max(4000).optional().default(""),
  dueAt: z.iso.datetime({ offset: true }).nullable().optional(),
  maxScore: z.coerce.number().int().min(1).max(1000).default(10),
  questions: z.array(quizQuestionSchema).max(30).optional().default([]),
}).superRefine((a, ctx) => {
  if (new Set(a.questions.map(q => q.id)).size !== a.questions.length) ctx.addIssue({ code: 'custom', message: 'الأسئلة مكررة', path: ['questions'] });
  if (a.questions.length && a.questions.reduce((n, q) => n + q.points, 0) !== a.maxScore) ctx.addIssue({ code: 'custom', message: 'الدرجة النهائية يجب أن تساوي مجموع درجات الأسئلة', path: ['maxScore'] });
});
export type AssignmentInput = z.input<typeof assignmentInputSchema>;
/** Templates deliberately carry no lecture-specific deadline. */
export const homeworkTemplateInputSchema = assignmentInputSchema.transform(({ dueAt: _deadline, ...template }) => template);

export const submissionInputSchema = z.object({
  body: z.string().trim().max(8000).optional().default(""),
  attachmentIds: z.array(z.string().uuid()).max(10).optional().default([]),
  answers: z.record(z.string().uuid(), z.number().int().min(0).max(5)).optional().default({}),
});
export type SubmissionInput = z.input<typeof submissionInputSchema>;

export const gradeInputSchema = z.object({
  score: z.coerce.number().int().min(0),
  feedback: z.string().trim().max(2000).optional().default(""),
});

export const payoutRequestSchema = z.object({
  amountCents: z.coerce.number().int().min(MIN_PAYOUT_CENTS, { message: "أقل سحب 100 ج.م" }),
  method: z.enum(PAYOUT_METHODS),
  account: z.string().trim().min(4, { message: "اكتب بيانات الحساب" }).max(200),
});
export type PayoutRequestInput = z.input<typeof payoutRequestSchema>;

export const payoutDecisionSchema = z.object({
  status: z.enum(["paid", "rejected"]),
  note: z.string().trim().max(500).optional().default(""),
});

/** The checkout needs a phone number; the booking step can collect a missing one. */
export const bookingInputSchema = z.object({ phone });

export const lectureReportSchema = z.object({
  reason: z.enum(Object.keys(REPORT_REASON_LABELS) as [ReportReason, ...ReportReason[]], { message: "اختر سبب البلاغ" }),
  details: z.string().trim().max(1000).optional().default(""),
});

export const fundsDecisionSchema = z.object({
  decision: z.enum(["release", "refund"]),
  note: z.string().trim().max(500).optional().default(""),
});

export const reportDecisionSchema = z.object({
  decision: z.enum(["refund", "dismiss"]),
  note: z.string().trim().max(500).optional().default(""),
});

export const linkChildSchema = z.object({ code: z.string().trim().min(4).max(20) });
export const parentInviteSchema = z.object({ email });

export const mockPaySchema = z.object({
  method: z.enum(PAYMENT_METHODS).default("card"),
  outcome: z.enum(["success", "failure"]).default("success"),
});

export const recordingInputSchema = z.object({
  url: z.url({ message: "حط لينك صحيح" }).max(1000).refine(value => /^https:\/\//i.test(value), { message: "رابط التسجيل يجب أن يبدأ بـ https://" }),
});

export const voteSchema = z.object({ value: z.union([z.literal(1), z.literal(-1), z.literal(0)]) });

/** Board ops are validated loosely (shape is the app's business) but bounded in size. */
export const boardOpsSchema = z.object({
  ops: z.array(z.object({ op: z.string().max(10) }).passthrough()).min(1).max(200),
});

export const teacherVerificationInputSchema = z.object({
  fullName: z.string().trim().min(6, { message: "أدخل اسمك الكامل" }).max(150),
  phone: z.string().trim().min(10, { message: "أدخل رقم هاتف صحيحًا" }).max(25),
  subject: z.string().trim().min(2, { message: "أدخل تخصصك" }).max(80),
  governorate: z.string().trim().min(2, { message: "أدخل المحافظة" }).max(80),
  qualification: z.string().trim().min(5, { message: "أدخل المؤهل والجهة المانحة" }).max(300),
  experienceYears: z.coerce.number().int().min(0).max(70),
  membershipNumber: z.string().trim().min(2, { message: "أدخل رقم عضوية النقابة" }).max(60),
  frontDocumentId: z.uuid({ message: "ارفع الوجه الأمامي للكارنيه" }),
  backDocumentId: z.uuid({ message: "ارفع الوجه الخلفي للكارنيه" }),
}).refine(value => value.frontDocumentId !== value.backDocumentId, { message: "ارفع صورتين مختلفتين لوجهي الكارنيه" });
export type TeacherVerificationInput = z.infer<typeof teacherVerificationInputSchema>;
export const verificationReviewSchema = z.object({ submittedAt: z.iso.datetime({ offset: true }), action: z.enum(["approve", "reject", "changes"]), note: z.string().trim().max(2000).default("") }).refine(value => value.action === "approve" || value.note.length >= 5, { message: "اكتب سبب الرفض أو التعديل المطلوب" });

export const ticketInputSchema = z.object({
  category: z.enum(Object.keys(TICKET_CATEGORY_LABELS) as [TicketCategory, ...TicketCategory[]], { message: "اختر نوع المشكلة" }),
  subject: z.string().trim().min(3, { message: "اكتب عنوانًا مختصرًا" }).max(120),
  body: z.string().trim().min(5, { message: "اشرح المشكلة في جملة على الأقل" }).max(4000),
});

export const ticketReplySchema = z.object({
  body: z.string().trim().min(1, { message: "اكتب ردك" }).max(4000),
});
