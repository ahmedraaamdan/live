/**
 * Discovery-feed ranking. Pure functions: signals in, score out, so the
 * weights can be tuned (and tested) without touching a query. The design,
 * with worked examples, is in docs/app/RANKING.md.
 *
 *   score = (0.45·approval + 0.25·retention + 0.30·popularity)
 *           × relevance × timing × dislikeGuard  +  newTeacherBoost
 *
 * - approval:   Wilson lower bound of the like ratio, with the teacher's past
 *               votes as a Bayesian prior. A handful of likes can't beat
 *               hundreds, and a new lecture starts from its teacher's record.
 * - retention:  how much of the class people actually watched (smoothed).
 *               Hard to fake, and the best single sign of a good class.
 * - popularity: watching now + attended + booked, on a log scale so the
 *               biggest classes don't take every slot.
 * - relevance:  the student's grade and the subjects / teachers they book.
 * - timing:     live now ranks as is; upcoming classes rise as they near.
 * - guard:      lots of votes and mostly dislikes → pushed well down, however
 *               many people came.
 * - boost:      a small, fading lift for a teacher's first lectures, so
 *               newcomers get a fair chance to be seen.
 */

export const WEIGHTS = {
  approval: 0.45,
  retention: 0.25,
  popularity: 0.3,
  /** Pseudo-votes the prior is worth. Higher = new lectures lean longer on the teacher's record. */
  priorStrength: 6,
  /** The platform-wide expectation before anyone has voted. */
  platformApproval: 0.8,
  platformRetention: 0.5,
  retentionSmoothing: 4,
  /** popularity hits 1.0 at this many weighted people. */
  popularitySaturation: 500,
  gradeMismatch: 0.55,
  subjectAffinity: 0.25,
  followedTeacher: 0.15,
  dislikeGuardMinVotes: 10,
  dislikeGuardRatio: 0.5,
  dislikeGuardFactor: 0.35,
  newTeacherLectures: 3,
  newTeacherBoost: 0.06,
};

export interface TeacherRecord {
  likes: number;
  dislikes: number;
  /** Average watched share of past lectures, 0..1, or null. */
  completion: number | null;
  /** Lectures already given. */
  lectures: number;
}

export interface RankSignals {
  live: boolean;
  startsAt: Date;
  likes: number;
  dislikes: number;
  viewersNow: number;
  attendees: number;
  bookings: number;
  /** Average watched share of this lecture so far, 0..1, or null. */
  completion: number | null;
  teacher: TeacherRecord;
  /** null when we don't know the viewer's grade (signed out, not a student). */
  gradeMatch: boolean | null;
  /** Share of the viewer's past bookings in this subject, 0..1. */
  subjectAffinity: number;
  followsTeacher: boolean;
}

/** Lower bound of the Wilson score interval (95%): "at least this good, probably". */
export function wilsonLower(positive: number, total: number, z = 1.96): number {
  if (total <= 0) return 0;
  const p = positive / total;
  const z2 = z * z;
  return (p + z2 / (2 * total) - z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total)) / (1 + z2 / total);
}

export interface RankResult {
  score: number;
  parts: { approval: number; retention: number; popularity: number; relevance: number; timing: number; guard: number; boost: number };
  reason: string | null;
}

export function rank(s: RankSignals, now = Date.now()): RankResult {
  const W = WEIGHTS;

  // The teacher's record, itself pulled toward the platform average.
  const tVotes = s.teacher.likes + s.teacher.dislikes;
  const teacherApproval = (s.teacher.likes + W.priorStrength * W.platformApproval) / (tVotes + W.priorStrength);
  const votes = s.likes + s.dislikes;
  const approval = wilsonLower(s.likes + W.priorStrength * teacherApproval, votes + W.priorStrength);

  const priorRetention = s.teacher.completion ?? W.platformRetention;
  const retention =
    s.completion == null
      ? priorRetention
      : (s.completion * s.attendees + priorRetention * W.retentionSmoothing) / (s.attendees + W.retentionSmoothing);

  const crowd = s.viewersNow * 1.0 + s.attendees * 0.6 + s.bookings * 0.4;
  const popularity = Math.min(1, Math.log1p(crowd) / Math.log1p(W.popularitySaturation));

  const relevance =
    (s.gradeMatch === false ? W.gradeMismatch : 1) * (1 + W.subjectAffinity * s.subjectAffinity) * (s.followsTeacher ? 1 + W.followedTeacher : 1);

  const hoursAway = Math.max(0, (s.startsAt.getTime() - now) / 3_600_000);
  const timing = s.live ? 1 : 0.75 + 0.25 * Math.exp(-hoursAway / 24);

  const guard = votes >= W.dislikeGuardMinVotes && s.dislikes / votes > W.dislikeGuardRatio ? W.dislikeGuardFactor : 1;
  const boost = s.teacher.lectures < W.newTeacherLectures ? W.newTeacherBoost * (1 - s.teacher.lectures / W.newTeacherLectures) : 0;

  const base = W.approval * approval + W.retention * retention + W.popularity * popularity;
  const score = base * relevance * timing * guard + boost;

  return { score, parts: { approval, retention, popularity, relevance, timing, guard, boost }, reason: reasonFor(s, { approval, retention, popularity, boost }) };
}

/** The one line under a feed card: why it's here. */
function reasonFor(s: RankSignals, p: { approval: number; retention: number; popularity: number; boost: number }): string | null {
  if (s.live && s.viewersNow >= 20) return `${s.viewersNow} بيتفرجوا دلوقتي`;
  if (s.followsTeacher) return "من مدرسينك";
  if (p.approval >= 0.85 && s.likes + s.teacher.likes >= 10) return "تقييمها عالي جدًا";
  if (p.retention >= 0.75 && s.attendees + s.teacher.lectures >= 3) return "الطلاب بيكمّلوها للآخر";
  if (p.popularity >= 0.5) return "عليها إقبال كبير";
  if (s.gradeMatch) return "لصفّك";
  if (p.boost > 0) return "مدرس جديد";
  return null;
}
