/**
 * Every email the app sends, written in the brand's Egyptian Arabic voice
 * and rendered with the shared GAHEZ template.
 */
import type { Lecture, User } from "@workspace/db";
import { lectureMailCopy, subjectLabel, type LectureMailDraft } from "@workspace/live-core";
import { esc, renderEmail } from "./email-template.mjs";
import { env } from "./env";
import { fmtDateTime, fmtDuration, fmtMoney } from "./format";
import { sendMail } from "./mailer";

const link = (p: string) => `${env.appUrl}${p}`;

function lectureRows(lecture: Lecture, teacherName: string): Array<[string, string]> {
  return [
    ["الحصة", esc(lecture.title)],
    ["المادة", esc(subjectLabel(lecture.subject))],
    ["المدرس", esc(teacherName)],
    ["الميعاد", esc(fmtDateTime(lecture.startsAt))],
    ["المدة", esc(fmtDuration(lecture.durationMin))],
  ];
}

export async function sendWelcome(user: User) {
  const byRole = {
    teacher: {
      intro: `أهلاً ${esc(user.name)}، حسابك كمدرس على <strong>Gahez Live</strong> جاهز. اعمل أول حصة، ابعت اللينك لطلابك، والفلوس بتنزل في محفظتك أول ما يحجزوا.`,
      cta: { label: "اعمل أول حصة", url: link("/t/lectures/new") },
    },
    student: {
      intro: `أهلاً ${esc(user.name)}، حسابك على <strong>Gahez Live</strong> جاهز. أول ما مدرسك يبعتلك لينك الحصة، افتحه واحجز مكانك في ثواني.`,
      cta: { label: "افتح التطبيق", url: link("/s") },
    },
    parent: {
      intro: `أهلاً ${esc(user.name)}، حسابك كولي أمر على <strong>Gahez Live</strong> جاهز. اربط حساب ابنك أو بنتك بالكود اللي في حسابهم، وتابع الحضور والواجبات أول بأول.`,
      cta: { label: "اربط حساب ابنك", url: link("/p") },
    },
    admin: { intro: `أهلاً ${esc(user.name)}، حساب الإدارة جاهز.`, cta: { label: "لوحة الإدارة", url: link("/admin") } },
  }[user.role];
  const mail = renderEmail({
    product: "live",
    robot: "hero",
    preheader: "حسابك على Gahez Live جاهز.",
    title: "أهلاً بيك في Gahez Live 👋",
    intro: byRole.intro,
    cta: byRole.cta,
    note: "وصلك الإيميل ده لأنك عملت حساب على Gahez Live.",
  });
  await sendMail({ to: user.email, subject: "أهلاً بيك في Gahez Live", ...mail });
}

export async function sendBookingConfirmed(opts: {
  student: User;
  lecture: Lecture;
  teacherName: string;
  amountCents: number;
  parentEmails: string[];
  childCode: string;
}) {
  const { student, lecture, teacherName, amountCents } = opts;
  const rows = [...lectureRows(lecture, teacherName), ["المبلغ", amountCents ? esc(fmtMoney(amountCents)) : "مجانية"] as [string, string]];

  const toStudent = renderEmail({
    product: "live",
    robot: "dance",
    preheader: `مكانك في "${lecture.title}" محجوز.`,
    title: "حجزك اتأكد! 🎉",
    intro: `أهلاً ${esc(student.name)}، مكانك في الحصة محجوز. هنبعتلك إيميل قبل الميعاد بعشر دقايق، وأول ما المدرس يبدأ البث هيوصلك إشعار.`,
    rows,
    cta: { label: "افتح الحصة", url: link(`/lectures/${lecture.id}`) },
    note: "وصلك الإيميل ده لأنك حجزت حصة على Gahez Live.",
  });
  await sendMail({ to: student.email, subject: `حجزك اتأكد: ${lecture.title}`, ...toStudent });

  if (opts.parentEmails.length) {
    const toParent = renderEmail({
      product: "live",
      robot: "desk",
      preheader: `${student.name} حجز حصة جديدة على Gahez Live.`,
      title: `حصة جديدة لـ${esc(student.name)}`,
      intro: `اتحجزت حصة جديدة على حساب <strong>${esc(student.name)}</strong>. دي تفاصيلها، وتقدر تتابع الحضور والواجبات من حسابك كولي أمر.`,
      rows,
      cta: { label: "تابع من حساب ولي الأمر", url: link(`/join/parent?code=${encodeURIComponent(opts.childCode)}`) },
      note: `وصلك الإيميل ده لأن ${esc(student.name)} سجّل إيميلك كولي أمر على Gahez Live.`,
    });
    await sendMail({ to: opts.parentEmails, subject: `حصة جديدة لـ${student.name}: ${lecture.title}`, ...toParent });
  }
}

export async function sendParentInvite(opts: { student: User; email: string; code: string }) {
  const mail = renderEmail({
    product: "live",
    robot: "phone",
    preheader: `${opts.student.name} عايزك تتابع حصصه على Gahez Live.`,
    title: "تابع حصص ابنك أول بأول",
    intro: `<strong>${esc(opts.student.name)}</strong> ضافك كولي أمر على Gahez Live. من حسابك هتشوف الحصص اللي حضرها، وقت المشاهدة، والواجبات ودرجاتها.`,
    rows: [["كود الربط", `<strong style="font-size:20px;letter-spacing:3px">${esc(opts.code)}</strong>`]],
    cta: { label: "اعمل حساب ولي أمر", url: link(`/join/parent?code=${encodeURIComponent(opts.code)}`) },
    note: `وصلك الإيميل ده لأن ${esc(opts.student.name)} سجّل إيميلك كولي أمر.`,
  });
  await sendMail({ to: opts.email, subject: `${opts.student.name} ضافك كولي أمر على Gahez Live`, ...mail });
}

export function lectureShareBlock(lecture: Lecture, teacherName: string) {
  const shareUrl = `${env.appUrl}/lectures/${lecture.id}`;
  const copyUrl = `${env.appUrl}/lectures/${lecture.id}?copy=1`;
  const shareText = `احجز مكانك في حصة "${lecture.title}" مع أستاذ ${teacherName} على جاهز لايف:\n${shareUrl}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 10px;background:#FFF1F4;border:1px dashed #FDA4AF;border-radius:14px">
    <tr>
      <td class="pad" style="padding:18px 20px;text-align:center">
        <div style="font-family:'Cairo',Tahoma,sans-serif;font-weight:700;font-size:15px;color:#9F1239;margin-bottom:6px">📢 شارك رابط الحصة مع طلابك وزملائك</div>
        <p style="margin:0 0 10px;font-family:'Cairo',Tahoma,sans-serif;font-size:13px;color:#475569;line-height:1.6">
          كل ما تشارك رابط الحصة بدري، الطلاب بيقدروا يحجزوا مكانهم ويستعدوا للحضور قبل اكتمال العدد.
        </p>
        <div style="margin:8px auto 14px;padding:9px 12px;background:#ffffff;border:1px solid #FECDD3;border-radius:8px;font-family:monospace;font-size:12px;color:#BE123C;word-break:break-all;direction:ltr">
          ${esc(shareUrl)}
        </div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto">
          <tr>
            <td align="center" style="padding:4px 6px">
              <a href="${esc(copyUrl)}" target="_blank" style="display:inline-block;padding:10px 18px;background:#E11D48;color:#ffffff;font-family:'Cairo',Tahoma,sans-serif;font-size:13px;font-weight:700;text-decoration:none;border-radius:8px">📋 نسخ رابط الحصة تلقائياً</a>
            </td>
            <td align="center" style="padding:4px 6px">
              <a href="${esc(whatsappUrl)}" target="_blank" style="display:inline-block;padding:10px 18px;background:#16A34A;color:#ffffff;font-family:'Cairo',Tahoma,sans-serif;font-size:13px;font-weight:700;text-decoration:none;border-radius:8px">💬 مشاركة عبر واتساب</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

export function renderLectureMail(
  lecture: Lecture,
  teacherName: string,
  draft: Pick<LectureMailDraft, "subject" | "title" | "message">,
  opts?: { includeShare?: boolean },
) {
  const includeShare = opts?.includeShare ?? true;
  return renderEmail({
    product: "live",
    preheader: draft.subject,
    title: draft.title,
    intro: esc(draft.message).replace(/\r?\n/g, "<br>"),
    rows: lectureRows(lecture, teacherName),
    body: includeShare ? lectureShareBlock(lecture, teacherName) : undefined,
    cta: { label: "افتح الحصة", url: link(`/lectures/${lecture.id}`) },
    note: "وصلك الإيميل ده بخصوص الحصة دي على جاهز لايف.",
  });
}

export function sendLectureReminder(to: User, lecture: Lecture, teacherName: string, stage: "3h" | "15m" = "15m") {
  const is3h = stage === "3h";
  const timeDesc = is3h ? "خلال 3 ساعات" : "خلال ربع ساعة";
  const draft: LectureMailDraft = {
    ...lectureMailCopy("reminder", lecture.title),
    template: "reminder",
    audience: to.id === lecture.teacherId ? "teacher" : "students",
    subject: is3h ? `تذكير: حصتك كمان 3 ساعات — ${lecture.title}` : `تذكير: حصتك كمان ربع ساعة — ${lecture.title}`,
    title: is3h ? "حصتك كمان 3 ساعات ⏰" : "حصتك كمان ربع ساعة ⏰",
    message: to.id === lecture.teacherId
      ? `أهلاً ${to.name}، ميعاد حصتك ${timeDesc}. جهّز الكاميرا والمايك والمواد قبل البث، وشجّع طلابك ينضموا.`
      : `أهلاً ${to.name}، ميعاد الحصة ${timeDesc}. افتح صفحة الحصة وخلّيك جاهز تدخل أول ما البث يبدأ.`,
  };
  return sendMail({ to: to.email, subject: draft.subject, ...renderLectureMail(lecture, teacherName, draft, { includeShare: true }) });
}

export async function sendLectureLive(to: User[], lecture: Lecture, teacherName: string) {
  const mail = renderEmail({
    product: "live",
    robot: "hero",
    preheader: `${teacherName} بدأ البث دلوقتي.`,
    title: "الحصة بدأت! 🔴",
    intro: `<strong>${esc(teacherName)}</strong> بدأ بث "${esc(lecture.title)}" دلوقتي. ادخل على طول.`,
    cta: { label: "ادخل البث", url: link(`/live/${lecture.id}`) },
    note: "وصلك الإيميل ده لأنك حاجز الحصة دي.",
  });
  // One message per student: the BCC-less list keeps addresses private.
  await Promise.all(to.map((u) => sendMail({ to: u.email, subject: `بدأت دلوقتي: ${lecture.title}`, ...mail })));
}

export async function sendRecordingReady(to: User[], lecture: Lecture) {
  const mail = renderEmail({
    product: "live",
    robot: "desk",
    preheader: `تسجيل "${lecture.title}" بقى متاح.`,
    title: "التسجيل جاهز 🎬",
    intro: `تسجيل حصة "${esc(lecture.title)}" بقى متاح. تقدر تتفرج عليه في أي وقت وتراجع اللي فاتك.`,
    cta: { label: "شوف التسجيل", url: link(`/lectures/${lecture.id}`) },
    note: "وصلك الإيميل ده لأنك حاجز الحصة دي.",
  });
  await Promise.all(to.map((u) => sendMail({ to: u.email, subject: `التسجيل جاهز: ${lecture.title}`, ...mail })));
}

export async function sendNewAssignment(to: User[], lectureTitle: string, assignment: { id: string; title: string; dueAt: Date | null }) {
  const mail = renderEmail({
    product: "live",
    robot: "desk",
    preheader: `واجب جديد: ${assignment.title}`,
    title: "عندك واجب جديد 📝",
    intro: `المدرس نزّل واجب على حصة "${esc(lectureTitle)}".`,
    rows: [
      ["الواجب", esc(assignment.title)],
      ["آخر ميعاد", assignment.dueAt ? esc(fmtDateTime(assignment.dueAt)) : "مفيش ميعاد محدد"],
    ],
    cta: { label: "حل الواجب", url: link(`/s/assignments/${assignment.id}`) },
    note: "وصلك الإيميل ده لأنك حاجز الحصة دي.",
  });
  await Promise.all(to.map((u) => sendMail({ to: u.email, subject: `واجب جديد: ${assignment.title}`, ...mail })));
}

export async function sendGraded(opts: {
  student: User;
  parentEmails: string[];
  assignmentTitle: string;
  score: number;
  maxScore: number;
  feedback: string;
  assignmentId: string;
}) {
  const rows: Array<[string, string]> = [
    ["الواجب", esc(opts.assignmentTitle)],
    ["الدرجة", `<strong>${opts.score} / ${opts.maxScore}</strong>`],
  ];
  if (opts.feedback) rows.push(["تعليق المدرس", esc(opts.feedback)]);
  const toStudent = renderEmail({
    product: "live",
    robot: "dance",
    preheader: `درجتك في "${opts.assignmentTitle}": ${opts.score}/${opts.maxScore}`,
    title: "واجبك اتصحّح ✅",
    intro: `أهلاً ${esc(opts.student.name)}، المدرس صحّح واجبك.`,
    rows,
    cta: { label: "شوف التصحيح", url: link(`/s/assignments/${opts.assignmentId}`) },
  });
  await sendMail({ to: opts.student.email, subject: `واجبك اتصحّح: ${opts.assignmentTitle}`, ...toStudent });
  if (opts.parentEmails.length) {
    const toParent = renderEmail({
      product: "live",
      robot: "desk",
      preheader: `${opts.student.name} خد ${opts.score}/${opts.maxScore} في "${opts.assignmentTitle}"`,
      title: `درجة جديدة لـ${esc(opts.student.name)}`,
      intro: `المدرس صحّح واجب <strong>${esc(opts.student.name)}</strong>.`,
      rows,
      cta: { label: "تابع من حساب ولي الأمر", url: link("/p") },
    });
    await sendMail({ to: opts.parentEmails, subject: `درجة جديدة لـ${opts.student.name}`, ...toParent });
  }
}

export async function sendPayoutUpdate(teacher: User, amountCents: number, status: "paid" | "rejected", note: string) {
  const paid = status === "paid";
  const mail = renderEmail({
    product: "live",
    robot: paid ? "dance" : "phone",
    preheader: paid ? `حوّلنالك ${fmtMoney(amountCents)}.` : "طلب السحب محتاج مراجعة.",
    title: paid ? "فلوسك اتحوّلت 💸" : "طلب السحب اترفض",
    intro: paid
      ? `أهلاً ${esc(teacher.name)}، حوّلنا <strong>${esc(fmtMoney(amountCents))}</strong> على الحساب اللي اخترته.`
      : `أهلاً ${esc(teacher.name)}، مقدرناش ننفّذ طلب سحب <strong>${esc(fmtMoney(amountCents))}</strong>، والمبلغ رجع لرصيدك.`,
    body: note ? `<p style="margin:14px 0 0">${esc(note)}</p>` : undefined,
    cta: { label: "افتح المحفظة", url: link("/t/wallet") },
  });
  await sendMail({ to: teacher.email, subject: paid ? "فلوسك اتحوّلت" : "طلب السحب اترفض", ...mail });
}

export async function sendPasswordReset(user: User, token: string) {
  const mail = renderEmail({
    product: "live",
    robot: "phone",
    preheader: "لينك تغيير الباسورد، صالح لمدة ساعة.",
    title: "غيّر الباسورد",
    intro: `أهلاً ${esc(user.name)}، دوس على الزرار عشان تختار باسورد جديد. اللينك صالح لمدة ساعة.`,
    cta: { label: "اختار باسورد جديد", url: link(`/reset-password?token=${encodeURIComponent(token)}`) },
    note: "لو مش انت اللي طلبت ده، تجاهل الإيميل وحسابك في أمان.",
  });
  await sendMail({ to: user.email, subject: "تغيير الباسورد على Gahez Live", ...mail });
}

export async function sendLectureCancelled(to: Array<Pick<User, "email">>, lecture: Lecture, opts: { noShow?: boolean } = {}) {
  const paid = lecture.priceCents > 0;
  const mail = renderEmail({
    product: "live",
    robot: "phone",
    preheader: `حصة "${lecture.title}" اتلغت.`,
    title: "الحصة اتلغت",
    intro: `${opts.noShow ? "المدرس ما بدأش" : "للأسف المدرس لغى"} حصة "${esc(lecture.title)}" اللي كانت ${esc(fmtDateTime(lecture.startsAt))}${opts.noShow ? " في ميعادها، فاتلغت." : "."}${
      paid ? " بنتابع رد الفلوس على نفس وسيلة الدفع، وممكن تاخد أيام عمل قليلة." : ""
    }`,
    cta: { label: "افتح التطبيق", url: link("/s") },
    note: "وصلك الإيميل ده لأنك كنت حاجز الحصة دي.",
  });
  await Promise.all(to.map((u) => sendMail({ to: u.email, subject: `اتلغت: ${lecture.title}`, ...mail })));
}

export async function sendLectureRescheduled(to: Array<Pick<User, "email">>, lecture: Lecture, previousStart: Date) {
  const mail = renderEmail({
    product: "live",
    robot: "phone",
    preheader: `ميعاد "${lecture.title}" اتغير.`,
    title: "ميعاد الحصة اتغير",
    intro: `المدرس غيّر ميعاد حصة "${esc(lecture.title)}" من ${esc(fmtDateTime(previousStart))} إلى <strong>${esc(fmtDateTime(lecture.startsAt))}</strong>. لو الميعاد الجديد مش مناسب، تقدر تلغي حجزك من صفحة الحصة.`,
    cta: { label: "افتح الحصة", url: link(`/lectures/${lecture.id}`) },
    note: "وصلك الإيميل ده لأنك حاجز الحصة دي أو ولي أمر طالب حاجزها.",
  });
  await Promise.all(to.map((u) => sendMail({ to: u.email, subject: `ميعاد جديد: ${lecture.title}`, ...mail })));
}

export async function sendBookingCancelled(student: User, lecture: Lecture) {
  const mail = renderEmail({
    product: "live",
    robot: "phone",
    preheader: `حجزك في "${lecture.title}" اتلغى.`,
    title: "حجزك اتلغى",
    intro: `لغينا حجزك في حصة "${esc(lecture.title)}".${lecture.priceCents > 0 ? " بنتابع رد الفلوس على نفس وسيلة الدفع، وممكن تاخد أيام عمل قليلة." : ""}`,
    cta: { label: "افتح التطبيق", url: link("/s") },
    note: "وصلك الإيميل ده لأنك لغيت حجزك في الحصة دي.",
  });
  await sendMail({ to: student.email, subject: `اتلغى حجزك: ${lecture.title}`, ...mail });
}

/** Tickets reach the team's inbox too; replying there goes to the person who wrote. */
export async function sendTicketOpened(user: User, subject: string, body: string, ticketId: string) {
  const mail = renderEmail({
    product: "live",
    robot: "desk",
    preheader: `${user.name}: ${subject}`,
    title: "تذكرة دعم جديدة",
    intro: `<strong>${esc(user.name)}</strong> بعت تذكرة: ${esc(subject)}`,
    rows: [["الرسالة", `<div style="font-weight:400;white-space:pre-wrap;line-height:1.8">${esc(body)}</div>`]],
    cta: { label: "افتح التذكرة", url: link(`/support/${ticketId}`) },
    note: "وصلك الإيميل ده لأن حد بعت تذكرة دعم من التطبيق.",
  });
  await sendMail({ to: "support@gahez.space", replyTo: user.email, subject: `تذكرة: ${subject}`, ...mail });
}

/** Tells the owners a teacher waits for review, so nobody sits unanswered behind the admin bell. */
export async function sendVerificationRequest(to: Array<Pick<User, "email">>, teacher: User) {
  if (to.length === 0) return;
  const mail = renderEmail({
    product: "live",
    robot: "desk",
    preheader: `${teacher.name} مستني مراجعة التوثيق.`,
    title: "طلب توثيق مدرس جديد",
    intro: `<strong>${esc(teacher.name)}</strong> بعت بياناته للتوثيق. راجعه النهارده عشان يقدر يبدأ حصصه المدفوعة.`,
    cta: { label: "راجع الطلب", url: link(`/admin/teacher-verifications/${teacher.id}`) },
    note: "وصلك الإيميل ده لأنك مسؤول مراجعة توثيق المدرسين.",
  });
  await sendMail({ to: to.map((u) => u.email), subject: `طلب توثيق: ${teacher.name}`, ...mail });
}

export async function sendTicketAnswered(user: User, subject: string, ticketId: string) {
  const mail = renderEmail({
    product: "live",
    robot: "phone",
    preheader: `وصلك رد على "${subject}".`,
    title: "وصلك رد من الدعم",
    intro: `فريق الدعم رد على تذكرتك "${esc(subject)}".`,
    cta: { label: "شوف الرد", url: link(`/support/${ticketId}`) },
    note: "وصلك الإيميل ده لأنك بعت تذكرة دعم.",
  });
  await sendMail({ to: user.email, subject: `رد على: ${subject}`, ...mail });
}
