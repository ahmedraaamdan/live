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
export const PAYMENT_METHODS = ["card", "wallet", "apple_pay", "google_pay"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
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
