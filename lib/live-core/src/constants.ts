/**
 * Domain constants shared by the API and the app. Labels are the Arabic
 * copy the app shows; keys are what the API stores.
 */

export const ROLES = ["student", "teacher", "parent", "admin"] as const;
export type Role = (typeof ROLES)[number];

/** Roles a person can pick at sign-up. Admins are named by ADMIN_EMAILS. */
export const SIGNUP_ROLES = ["student", "teacher", "parent"] as const;
export type SignupRole = (typeof SIGNUP_ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  student: "طالب",
  teacher: "مدرس",
  parent: "ولي أمر",
  admin: "إدارة",
};

export const SUBJECTS = [
  { key: "arabic", label: "لغة عربية" },
  { key: "english", label: "لغة إنجليزية" },
  { key: "french", label: "لغة فرنسية" },
  { key: "german", label: "لغة ألمانية" },
  { key: "math", label: "رياضيات" },
  { key: "physics", label: "فيزياء" },
  { key: "chemistry", label: "كيمياء" },
  { key: "biology", label: "أحياء" },
  { key: "science", label: "علوم" },
  { key: "history", label: "تاريخ" },
  { key: "geography", label: "جغرافيا" },
  { key: "philosophy", label: "فلسفة ومنطق" },
  { key: "psychology", label: "علم نفس واجتماع" },
  { key: "religion", label: "تربية دينية" },
  { key: "computer", label: "حاسب آلي وبرمجة" },
  { key: "other", label: "مادة أخرى" },
] as const;
export type SubjectKey = (typeof SUBJECTS)[number]["key"];

export const GRADES = [
  { key: "p4", label: "رابعة ابتدائي" },
  { key: "p5", label: "خامسة ابتدائي" },
  { key: "p6", label: "سادسة ابتدائي" },
  { key: "m1", label: "أولى إعدادي" },
  { key: "m2", label: "تانية إعدادي" },
  { key: "m3", label: "تالتة إعدادي" },
  { key: "s1", label: "أولى ثانوي" },
  { key: "s2", label: "تانية ثانوي" },
  { key: "s3", label: "تالتة ثانوي" },
  { key: "uni", label: "جامعة" },
  { key: "other", label: "أخرى" },
] as const;
export type GradeKey = (typeof GRADES)[number]["key"];

export function subjectLabel(key: string | null | undefined): string {
  return SUBJECTS.find((s) => s.key === key)?.label ?? key ?? "";
}

export function gradeLabel(key: string | null | undefined): string {
  return GRADES.find((g) => g.key === key)?.label ?? key ?? "";
}

export const LECTURE_STATUSES = ["draft", "scheduled", "live", "ended", "cancelled"] as const;
export type LectureStatus = (typeof LECTURE_STATUSES)[number];

export const LECTURE_STATUS_LABELS: Record<LectureStatus, string> = {
  draft: "مسودة",
  scheduled: "مجدولة",
  live: "مباشر الآن",
  ended: "انتهت",
  cancelled: "اتلغت",
};

export const BOOKING_STATUSES = ["pending_payment", "confirmed", "cancelled", "refunded"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const PAYMENT_STATUSES = ["pending", "succeeded", "failed", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** How a student paid, as reported by the gateway. */
export const PAYMENT_METHODS = ["card", "wallet", "apple_pay", "google_pay", "cash"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "فوري / أمان",
  card: "كارت بنكي",
  wallet: "محفظة موبايل",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
};

export const PAYOUT_METHODS = ["instapay", "vodafone_cash", "bank"] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

export const PAYOUT_METHOD_LABELS: Record<PayoutMethod, string> = {
  instapay: "InstaPay",
  vodafone_cash: "فودافون كاش / محفظة",
  bank: "تحويل بنكي",
};

export const PAYOUT_STATUSES = ["requested", "paid", "rejected"] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export const WALLET_ENTRY_KINDS = ["sale", "commission", "payout", "refund", "adjustment"] as const;
export type WalletEntryKind = (typeof WALLET_ENTRY_KINDS)[number];

export const MESSAGE_KINDS = ["question", "comment", "answer"] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

/** Smallest payout a teacher can request, in piasters (EGP 100). */
export const MIN_PAYOUT_CENTS = 100_00;

/** Cheapest paid class, in piasters: below this the gateway's fee eats the platform's share. */
export const MIN_PAID_PRICE_CENTS = 50_00;

/** Before review a teacher can run free classes shared by link only: this many open at once... */
export const TRIAL_MAX_OPEN_LECTURES = 3;
/** ...for this many students each. */
export const TRIAL_MAX_STUDENTS = 15;
/** A free class shared by link only needs no reviewed identity; anything paid or public does. */
export const isTrialLecture = (lecture: { priceCents: number; listed: boolean }) => lecture.priceCents === 0 && !lecture.listed;

export const VERIFICATION_DOCUMENT_LABELS = { national_id: "البطاقة الشخصية", syndicate_card: "كارنيه النقابة" } as const;
export type VerificationDocumentType = keyof typeof VERIFICATION_DOCUMENT_LABELS;

/** How far an account has come, furthest step last within each role. */
export const USER_STEP_LABELS = {
  signed_up: "سجّل بس",
  lecture_created: "أنشأ حصة",
  went_live: "بدأ بث",
  verification_changes: "التوثيق محتاج تعديل",
  verification_rejected: "التوثيق مرفوض",
  verification_sent: "بعت التوثيق",
  verified: "موثّق",
  paid_booking: "أول حجز مدفوع",
  paid_class: "عمل حصة مدفوعة",
  booked: "حجز حصة",
  attended: "حضر حصة",
  linked_child: "ربط ابنه",
  none: "لا ينطبق",
} as const;
export type UserStepKey = keyof typeof USER_STEP_LABELS;

/** An active teacher ran a paid class this recently, for at least this many paying students. */
export const ACTIVE_TEACHER_DAYS = 30;
export const ACTIVE_TEACHER_MIN_STUDENTS = 5;

/** Typed by the owner to confirm erasing accounts. */
export const DELETE_CONFIRM_WORD = "احذف";

/** A student can leave a paid class for a full refund until this long before it starts. */
export const STUDENT_CANCEL_HOURS = 24;

/** A class nobody started this long after its start time is cancelled and refunded. */
export const NO_SHOW_GRACE_MINUTES = 30;

/** Earnings wait for an administrator unless the class ran this share of its length... */
export const FUNDS_MIN_LIVE_SHARE = 0.5;
/** ...and at least one student watched for this long. */
export const FUNDS_MIN_ATTENDED_SECONDS = 300;

export const FUNDS_REVIEW_LABELS = {
  short_live: "البث كان أقل من نصف مدة الحصة",
  no_attendance: "لم يحضر أي طالب 5 دقائق",
  reported: "طالب أبلغ عن مشكلة في الحصة",
} as const;
export type FundsReviewReason = keyof typeof FUNDS_REVIEW_LABELS;

export const REPORT_REASON_LABELS = {
  not_held: "الحصة لم تُعقد",
  ended_early: "انتهت قبل موعدها بكثير",
  technical: "مشكلة في الصوت أو الصورة أو الدخول",
  other: "سبب آخر",
} as const;
export type ReportReason = keyof typeof REPORT_REASON_LABELS;

/** How often a watching student's app reports attendance. */
export const HEARTBEAT_SECONDS = 30;

/** A teacher can open the live room this many minutes before the start time. */
export const LIVE_OPEN_MINUTES_BEFORE = 30;

/**
 * A like or dislike only counts from someone who actually watched: this
 * much of the live class, or of the recording. Stops drive-by voting.
 */
export const VOTE_MIN_LIVE_SECONDS = 180;
export const VOTE_MIN_REPLAY_SECONDS = 300;

export const TICKET_CATEGORY_LABELS = {
  account: "حسابي",
  payment: "الدفع والاسترداد",
  lecture: "حصة أو مدرس",
  technical: "مشكلة تقنية",
  other: "شيء آخر",
} as const;
export type TicketCategory = keyof typeof TICKET_CATEGORY_LABELS;

export const TICKET_STATUS_LABELS = {
  open: "بانتظار الرد",
  answered: "تم الرد",
  closed: "مغلقة",
} as const;
export type TicketStatus = keyof typeof TICKET_STATUS_LABELS;
