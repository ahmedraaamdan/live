/**
 * Response shapes the API returns and the app renders. Timestamps are ISO
 * strings; money is integer piasters.
 */
import type { BoardOp } from "./board";
import type {
  BookingStatus,
  FundsReviewReason,
  LectureStatus,
  MessageKind,
  PaymentMethod,
  PaymentStatus,
  PayoutMethod,
  PayoutStatus,
  ReportReason,
  TicketCategory,
  TicketStatus,
  Role,
  UserStepKey,
  WalletEntryKind,
} from "./constants";

export interface UserDTO {
  id: string;
  role: Role;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface PersonMini {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface TeacherMini extends PersonMini {
  headline: string | null;
  subject: string | null;
  /** The viewing student follows this teacher. */
  followed?: boolean;
  /** The platform reviewed this teacher's identity. */
  verified?: boolean;
}

export interface MeDTO {
  isSuperAdmin?: boolean;
  /** An administrator who has not turned on two-factor yet: every admin tool stays closed until they do. */
  mfaSetupRequired?: boolean;
  impersonation?: { actorId: string; actorName: string } | null;
  user: UserDTO;
  teacher: { bio: string; headline: string; subject: string | null; experience?: string; socialLinks?: ProfileLink[]; certificates?: ProfileLink[] } | null;
  student: { grade: string | null; parentEmail: string | null; linkCode: string; parents: PersonMini[] } | null;
  unreadNotifications: number;
  unreadSupport?: number;
}

export interface AuthResult {
  token: string;
  me: MeDTO;
}

export interface RecordingDTO {
  id: string;
  status: "recording" | "processing" | "ready" | "failed";
  url: string | null;
  durationSec: number | null;
  createdAt: string;
}

export interface LectureDTO {
  coverUrl?: string | null;
  id: string;
  code: string;
  title: string;
  subject: string;
  grade: string;
  description: string;
  startsAt: string;
  durationMin: number;
  priceCents: number;
  capacity: number | null;
  status: LectureStatus;
  listed: boolean;
  liveStartedAt: string | null;
  liveEndedAt: string | null;
  teacher: TeacherMini;
  seatsTaken: number;
  /** The viewer kept this class for later. */
  saved?: boolean;
  /** The viewer's own booking, for a student. */
  booking: {
    id: string;
    status: BookingStatus;
    /** The student may still leave this class and get their money back. */
    canCancel?: boolean;
    /** The student may still report a problem with this finished class. */
    canReport?: boolean;
    reported?: boolean;
  } | null;
  recording: RecordingDTO | null;
  votes: LectureVotes;
  /** Students watching right now (live lectures). */
  viewersNow: number;
  /** Only for the lecture's teacher (and admins). */
  stats: { bookings: number; revenueCents: number; teacherCents: number; attendees: number; fundsReview?: FundsReviewReason | null } | null;
}

export interface FundReviewDTO {
  lecture: { id: string; title: string; startsAt: string; durationMin: number; liveMinutes: number; attendees: number };
  teacher: PersonMini;
  reason: FundsReviewReason;
  /** What students paid for this class and has not been refunded. */
  amountCents: number;
  reports: Array<{ id: string; reason: ReportReason; details: string; student: PersonMini; createdAt: string }>;
}

export interface LectureVotes {
  likes: number;
  dislikes: number;
  /** The viewer's own vote. */
  mine: -1 | 0 | 1;
  /** Whether the viewer has watched enough to vote. */
  canVote: boolean;
}

/** One card in the discovery feed, with the short reason it ranks where it does. */
export interface FeedItem {
  lecture: LectureDTO;
  reason: string | null;
  score: number;
}

export interface FeedDTO {
  live: FeedItem[];
  upcoming: FeedItem[];
  /** More classes match than this page shows. */
  hasMore?: boolean;
}

export interface BookingDTO {
  id: string;
  lectureId: string;
  status: BookingStatus;
  pricePaidCents: number;
  createdAt: string;
  confirmedAt: string | null;
  student: (PersonMini & { email: string; grade: string | null }) | null;
}

export interface PaymentDTO {
  refundPending?: boolean;
  voucher?: string | null;
  requiresReview?: boolean;
  id: string;
  status: PaymentStatus;
  amountCents: number;
  method: PaymentMethod | null;
  provider: string;
  bookingId: string;
  lectureId: string;
  lectureTitle: string;
  createdAt: string;
}

export interface BookResult {
  booking: BookingDTO;
  payment: PaymentDTO | null;
  /** Where to send the student to pay; null for a free lecture. */
  checkoutUrl: string | null;
}

export interface MessageDTO {
  id: string;
  lectureId: string;
  kind: MessageKind;
  body: string;
  parentId: string | null;
  answered: boolean;
  pinned: boolean;
  createdAt: string;
  author: PersonMini & { role: Role };
}

export interface AttendanceDTO {
  student: PersonMini;
  liveSeconds: number;
  replaySeconds: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
}

export interface UploadDTO {
  id: string;
  url: string;
  filename: string;
  mime: string;
  size: number;
}

export interface QuizQuestionDTO {
  id: string;
  prompt: string;
  options: string[];
  points: number;
  /** Answer key is returned only to the owner, never to students. */
  correctIndex?: number;
}

export interface SubmissionDTO {
  answers: Record<string, number>;
  gradingMethod: "manual" | "automatic";
  id: string;
  assignmentId: string;
  body: string;
  attachments: UploadDTO[];
  submittedAt: string;
  score: number | null;
  feedback: string | null;
  gradedAt: string | null;
  student: PersonMini | null;
}

export interface AssignmentDTO {
  questions: QuizQuestionDTO[];
  id: string;
  lectureId: string;
  lectureTitle: string;
  title: string;
  instructions: string;
  dueAt: string | null;
  maxScore: number;
  createdAt: string;
  /** For the teacher. */
  counts: { submitted: number; graded: number; students: number } | null;
  /** For a student (or a parent looking at a child). */
  mySubmission: SubmissionDTO | null;
}

export interface AssignmentDetailDTO extends AssignmentDTO {
  submissions: SubmissionDTO[];
}

export interface WalletEntryDTO {
  id: string;
  kind: WalletEntryKind;
  amountCents: number;
  status: "pending" | "available" | "void";
  memo: string;
  lectureTitle: string | null;
  createdAt: string;
}

export interface PayoutDTO {
  id: string;
  amountCents: number;
  method: PayoutMethod;
  account: string;
  status: PayoutStatus;
  adminNote: string | null;
  createdAt: string;
  processedAt: string | null;
  teacher: PersonMini | null;
}

export interface WalletDTO {
  availableCents: number;
  pendingCents: number;
  lifetimeCents: number;
  paidOutCents: number;
  requestedCents: number;
  feeBps: number;
  entries: WalletEntryDTO[];
  payouts: PayoutDTO[];
}

export interface ChildStats {
  lecturesBooked: number;
  lecturesPast: number;
  lecturesAttended: number;
  /** 0..1, or null before any lecture has happened. */
  attendanceRate: number | null;
  minutesWatched: number;
  assignmentsTotal: number;
  assignmentsSubmitted: number;
  /** 0..100 across graded work, or null. */
  avgScorePct: number | null;
}

export interface ChildSummaryDTO {
  student: PersonMini & { grade: string | null };
  stats: ChildStats;
  next: LectureDTO | null;
}

export interface ChildDetailDTO extends ChildSummaryDTO {
  lectures: Array<{ lecture: LectureDTO; attendedSeconds: number }>;
  assignments: AssignmentDTO[];
  payments: PaymentDTO[];
}

export interface TeacherDashboardDTO {
  stats: {
    monthEarningsCents: number;
    availableCents: number;
    pendingCents: number;
    upcomingCount: number;
    studentsCount: number;
    monthBookings: number;
    toGrade: number;
  };
  liveNow: LectureDTO | null;
  upcoming: LectureDTO[];
}

export interface StudentHomeDTO {
  liveNow: LectureDTO[];
  upcoming: LectureDTO[];
  pendingAssignments: AssignmentDTO[];
  recent: LectureDTO[];
}

export interface AdminOverviewDTO {
  gmvCents: number;
  platformCents: number;
  teacherPayableCents: number;
  paidOutCents: number;
  counts: { teachers: number; students: number; parents: number; lectures: number; bookings: number };
  recentPayments: Array<PaymentDTO & { payer: PersonMini; teacher: PersonMini }>;
  pendingPayouts: PayoutDTO[];
  pendingReviews: AdminOverviewDTO["recentPayments"];
}

export interface AdminUserDTO extends UserDTO {
  lectures: number;
  bookings: number;
  suspended: boolean;
  /** Last time they used the app themselves. */
  lastSeenAt: string | null;
  /** Where they last signed in from, for example "أندرويد · من جوه فيسبوك". */
  device: string | null;
  /** The teacher's subject or the student's grade. */
  detail: string | null;
  /** Null for anyone who isn't a teacher. */
  verification: TeacherVerificationDTO["status"] | null;
  /** The furthest step they reached. */
  step: { key: UserStepKey; at: string };
  /** Ran a paid class recently, for enough paying students. */
  active: boolean;
  /** Money the platform holds for a teacher, available or pending. */
  balanceCents: number;
}

export interface AdminUserDetailDTO {
  user: AdminUserDTO;
  timeline: Array<{ key: UserStepKey; at: string }>;
  sessions: Array<{ device: string; at: string; support: boolean }>;
  lectures: Array<{ id: string; title: string; status: LectureStatus; startsAt: string; priceCents: number; bookings: number }>;
  bookings: Array<{ lectureId: string; title: string; status: BookingStatus; pricePaidCents: number; createdAt: string }>;
  security: { google: string | null; facebook: string | null; mfaEnabled: boolean } | null;
}

export type AdminUserBulkOutcome = "suspended" | "restored" | "deleted" | "erased" | "skipped";
export interface AdminUsersBulkResult {
  results: Array<{ id: string; name: string; outcome: AdminUserBulkOutcome; reason?: string }>;
}

export interface NotificationDTO {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface LiveTokenDTO {
  /** False when LiveKit isn't configured on the server; the app shows a notice. */
  configured: boolean;
  url: string | null;
  token: string | null;
  role: "host" | "viewer";
}

export type LectureEvent =
  | { type: "message"; message: MessageDTO }
  | { type: "message_update"; message: MessageDTO }
  | { type: "status"; status: LectureStatus; liveStartedAt: string | null; liveEndedAt: string | null }
  | { type: "viewers"; count: number }
  | { type: "recording"; recording: RecordingDTO }
  | { type: "votes"; likes: number; dislikes: number }
  | { type: "board"; ops: BoardOp[] };

export interface ApiErrorBody {
  error: string;
  code?: string;
}

export interface PublicConfigDTO {
  paymentProvider: "mock" | "paymob" | "easykash";
  liveConfigured: boolean;
  paymentConfigured: boolean;
  recordingConfigured: boolean;
  liveParticipantLimit: number | null;
  liveRoomLimit: number | null;
  feeBps: number;
  appUrl: string;
}

export interface ProfileLink { label: string; url: string; kind?: "image" | "document" | "link" }
export interface TeacherProfileDTO {
  teacher: TeacherMini & { verified: boolean; bio: string; experience: string; socialLinks: ProfileLink[]; certificates: ProfileLink[] };
  rating: { likes: number; dislikes: number; total: number; positivePercent: number | null; raters: number };
  stats: { completedLessons: number; students: number; followers: number };
}
export interface TeacherLecturesDTO { items: LectureDTO[]; nextOffset: number | null }
export interface HomeworkTemplateDTO {
  id: string; title: string; instructions: string; questions: Array<{ id: string; prompt: string; options: string[]; correctIndex: number; points: number }>;
  maxScore: number; createdAt: string; updatedAt: string;
}

export interface HomeworkTemplateSummaryDTO { id: string; title: string; questionCount: number; maxScore: number; updatedAt: string }

export type LoginResult = AuthResult | { requiresMfa: true; challenge: string };
export interface VerificationDocumentDTO { id: string; filename: string; mime: string; size: number }
export interface AccountSecurityDTO { google: { email: string } | null; facebook: { name: string; email: string | null } | null; mfaEnabled: boolean; recoveryCodesRemaining: number; googleConfigured: boolean; facebookConfigured: boolean; canManageSecurity: boolean }
export interface TeacherVerificationDTO {
  status: "not_submitted" | "pending" | "approved" | "rejected" | "needs_changes";
  security: AccountSecurityDTO;
  details: { fullName: string; phone: string; subject: string; governorate: string; qualification: string; experienceYears: number; documentType: "national_id" | "syndicate_card"; membershipNumber: string; pageUrl: string; frontDocumentId: string; backDocumentId: string } | null;
  note: string; submittedAt: string | null; reviewedAt: string | null;
}
export interface VerificationQueueItem { teacher: PersonMini & { email: string }; status: TeacherVerificationDTO["status"]; fullName: string; subject: string; submittedAt: string }
export interface VerificationAdminDetail extends TeacherVerificationDTO { teacher: PersonMini & { email: string }; history: Array<{ action: string; note: string; createdAt: string }> }

export interface VerificationQueueDTO { items: VerificationQueueItem[]; nextOffset: number | null; counts: { pending: number; approved: number; rejected: number; needs_changes: number } }

export interface TicketMessageDTO {
  id: string;
  body: string;
  fromAdmin: boolean;
  author: PersonMini;
  createdAt: string;
}

export interface TicketDTO {
  id: string;
  category: TicketCategory;
  subject: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  /** Who opened it, shown to administrators. */
  user: (PersonMini & { role: Role; email: string }) | null;
}

export interface TicketDetailDTO extends TicketDTO {
  messages: TicketMessageDTO[];
}
