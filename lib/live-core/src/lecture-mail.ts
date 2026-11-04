import { z } from "zod/v4";

export const lectureMailAudienceSchema = z.enum(["teacher", "students", "both"]);
export const lectureMailTemplateSchema = z.enum(["reminder", "followup", "announcement"]);
export const lectureMailDraftSchema = z.object({
  audience: lectureMailAudienceSchema,
  template: lectureMailTemplateSchema,
  subject: z.string().trim().min(1, "اكتب عنوان الإيميل").max(250).regex(/^[^\r\n]+$/, "اكتب العنوان في سطر واحد"),
  title: z.string().trim().min(1, "اكتب عنوان الرسالة").max(200),
  message: z.string().trim().min(1, "اكتب نص الرسالة").max(4000),
});

export type LectureMailDraft = z.infer<typeof lectureMailDraftSchema>;
export const queueLectureMailSchema = lectureMailDraftSchema.extend({ requestId: z.uuid() });

export interface LectureMailProgress {
  total: number;
  sent: number;
  failed: number;
  done: boolean;
}

export const adminLectureFilterSchema = z.enum(["upcoming", "ended", "other"]);
export type AdminLectureFilter = z.infer<typeof adminLectureFilterSchema>;

export interface AdminLectureRow {
  id: string;
  title: string;
  curriculum: string;
  subject: string;
  grade: string;
  startsAt: string;
  durationMin: number;
  priceCents: number;
  currency: string;
  capacity: number | null;
  status: "draft" | "scheduled" | "live" | "ended" | "cancelled";
  teacher: { id: string; name: string; email: string; phone: string | null; suspended: boolean };
  booked: number;
  pending: number;
  attended: number;
  remindersSent: number;
}

export interface AdminLecturePage {
  rows: AdminLectureRow[];
  hasMore: boolean;
}

export function lectureMailCopy(template: LectureMailDraft["template"], lectureTitle: string): Pick<LectureMailDraft, "title" | "subject" | "message"> {
  const copy = {
    reminder: { title: "الحصة قربت تبدأ", message: "ميعاد الحصة قرب. افتح صفحة الحصة عشان تراجع التفاصيل وتكون جاهز في الميعاد." },
    followup: { title: "متابعة بعد الحصة", message: "شكرًا على وقتك! افتح صفحة الحصة عشان تراجع التفاصيل والمواد المتاحة." },
    announcement: { title: "رسالة بخصوص الحصة", message: "بنشارك معاك تحديث بخصوص الحصة. تقدر تراجع التفاصيل من صفحة الحصة." },
  }[template];
  return { ...copy, subject: `${copy.title} — ${lectureTitle.replace(/[\r\n]/g, " ").slice(0, 200)}` };
}
