/**
 * Request bodies, validated by the API and reused by the app's forms so both
 * sides agree on what "valid" means. Error messages are user-facing Arabic.
 */
import { z } from "zod/v4";
import { MESSAGE_KINDS, MIN_PAYOUT_CENTS, PAYMENT_METHODS, PAYOUT_METHODS, SIGNUP_ROLES } from "./constants";

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

export const profileUpdateSchema = z.object({
  name: name.optional(),
  phone,
  avatarUrl: z.string().max(500).optional(),
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
  /** ISO timestamp. */
  startsAt: z.iso.datetime({ offset: true, message: "اختار ميعاد صحيح" }),
  durationMin: z.coerce.number().int().min(15, { message: "أقل مدة 15 دقيقة" }).max(300, { message: "أقصى مدة 5 ساعات" }),
  priceCents: z.coerce.number().int().min(0).max(100_000_00),
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

export const assignmentInputSchema = z.object({
  title: z.string().trim().min(3, { message: "اكتب عنوان الواجب" }).max(120),
  instructions: z.string().trim().max(4000).optional().default(""),
  dueAt: z.iso.datetime({ offset: true }).nullable().optional(),
  maxScore: z.coerce.number().int().min(1).max(1000).default(10),
});
export type AssignmentInput = z.input<typeof assignmentInputSchema>;

export const submissionInputSchema = z.object({
  body: z.string().trim().max(8000).optional().default(""),
  attachmentIds: z.array(z.string().uuid()).max(10).optional().default([]),
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

export const linkChildSchema = z.object({ code: z.string().trim().min(4).max(20) });
export const parentInviteSchema = z.object({ email });

export const mockPaySchema = z.object({
  method: z.enum(PAYMENT_METHODS).default("card"),
  outcome: z.enum(["success", "failure"]).default("success"),
});

export const recordingInputSchema = z.object({
  url: z.url({ message: "حط لينك صحيح" }).max(1000),
});

export const voteSchema = z.object({ value: z.union([z.literal(1), z.literal(-1), z.literal(0)]) });

/** Board ops are validated loosely (shape is the app's business) but bounded in size. */
export const boardOpsSchema = z.object({
  ops: z.array(z.object({ op: z.string().max(10) }).passthrough()).min(1).max(200),
});
