// End-to-end smoke test of the whole product through the API: teacher,
// lecture, booking + mock payment, live Q&A, attendance, votes and feed,
// recording, homework, parent report. Needs a dev server with the mock
// gateway (pnpm run dev:watch). Run: pnpm run smoke
const API = process.env.API ?? "http://localhost:8080/api";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(API).hostname)) throw new Error("Run test data only against an isolated local server");
const config = await fetch(API + "/config").then(r => r.json());
if (config.paymentProvider !== "mock") throw new Error("Test data requires the mock payment provider");
const stamp = Date.now();
let failures = 0;

async function call(token, method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json)}`);
  return json;
}
function check(label, cond, extra) {
  console.log(`${cond ? "✓" : "✗"} ${label}${extra !== undefined ? " — " + JSON.stringify(extra) : ""}`);
  if (!cond) failures++;
}

const teacher = await call(null, "POST", "/auth/signup", { role: "teacher", name: "أ. محمد سامي", email: `t${stamp}@test.com`, password: "password123", subject: "physics" });
check("teacher signup", teacher.me.user.role === "teacher");
const T = teacher.token;

const startsAt = new Date(Date.now() + 10 * 60_000).toISOString();
const lecture = await call(T, "POST", "/lectures", { title: "الكهربية التيارية — الحصة الأولى", subject: "physics", grade: "s3", description: "قانون أوم وتوصيل المقاومات", startsAt, durationMin: 90, priceCents: 15000, capacity: 50 });
check("lecture created", lecture.code?.length === 7, lecture.code);

const pub = await call(null, "GET", `/l/${lecture.code}`);
check("public lecture by code", pub.id === lecture.id);

const student = await call(null, "POST", "/auth/signup", { role: "student", name: "يوسف أحمد", email: `s${stamp}@test.com`, password: "password123", grade: "s3", parentEmail: `p${stamp}@test.com` });
const S = student.token;
check("student signup with link code", student.me.student.linkCode.length === 6);

const book = await call(S, "POST", `/lectures/${lecture.id}/book`, {});
check("booking pending + checkout url", book.booking.status === "pending_payment" && book.checkoutUrl.includes("/dev/pay/"));
await call(S, "POST", `/payments/mock/${book.payment.id}/complete`, { method: "apple_pay", outcome: "success" });
const pay = await call(S, "GET", `/payments/${book.payment.id}`);
check("payment succeeded", pay.status === "succeeded" && pay.method === "apple_pay");
const lStudent = await call(S, "GET", `/lectures/${lecture.id}`);
check("booking confirmed", lStudent.booking.status === "confirmed");
const again = await call(S, "POST", `/lectures/${lecture.id}/book`, {});
check("rebook is a no-op", again.checkoutUrl === null && again.booking.status === "confirmed");

const wallet = await call(T, "GET", "/wallet");
check("teacher 90% pending", wallet.pendingCents === 13500 && wallet.availableCents === 0, { pending: wallet.pendingCents });

const dash = await call(T, "GET", "/teacher/dashboard");
check("teacher dashboard", dash.stats.monthBookings === 1 && dash.stats.monthEarningsCents === 13500, dash.stats);

// live
await call(T, "POST", `/lectures/${lecture.id}/live/start`);
const tok = await call(S, "POST", `/lectures/${lecture.id}/live/token`);
check("viewer token (live not configured)", tok.role === "viewer" && tok.configured === false);
const q = await call(S, "POST", `/lectures/${lecture.id}/messages`, { kind: "question", body: "يعني إيه مقاومة مكافئة؟" });
const a = await call(T, "POST", `/lectures/${lecture.id}/messages`, { body: "مجموع المقاومات اللي بتعمل نفس تأثيرهم مع بعض", parentId: q.id });
check("teacher answer", a.kind === "answer");
const msgs = await call(S, "GET", `/lectures/${lecture.id}/messages`);
check("question marked answered", msgs.find((m) => m.id === q.id)?.answered === true);
for (let i = 0; i < 12; i++) await call(S, "POST", `/lectures/${lecture.id}/heartbeat`, { mode: "live" });
await call(T, "POST", `/lectures/${lecture.id}/live/end`);
const att = await call(T, "GET", `/lectures/${lecture.id}/attendance`);
check("rapid heartbeats cannot inflate attendance", att[0]?.liveSeconds < 10, att[0]);
await call(T, "POST", `/lectures/${lecture.id}/recording`, { url: "https://example.com/rec.mp4" });
const withRec = await call(S, "GET", `/lectures/${lecture.id}`);
check("recording visible to booked student", withRec.recording?.url === "https://example.com/rec.mp4");

// votes + feed
const voteDenied = await fetch(API + `/lectures/${lecture.id}/vote`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${S}` }, body: JSON.stringify({ value: 1 }) });
check("rapid heartbeats cannot unlock verified voting", voteDenied.status === 400);
const lv = await call(S, "GET", `/lectures/${lecture.id}`);
check("unwatched student cannot vote", lv.votes.canVote === false && lv.votes.mine === 0, lv.votes);
const t2 = await call(null, "POST", "/auth/signup", { role: "teacher", name: "أ. سارة علي", email: `t2${stamp}@test.com`, password: "password123", subject: "math" });
const soon = new Date(Date.now() + 5 * 60_000).toISOString();
const l2 = await call(t2.token, "POST", "/lectures", { title: "التفاضل — مراجعة", subject: "math", grade: "s3", startsAt: soon, durationMin: 60, priceCents: 0 });
const l3 = await call(t2.token, "POST", "/lectures", { title: "هندسة أولى إعدادي", subject: "math", grade: "m1", startsAt: soon, durationMin: 60, priceCents: 0 });
await call(t2.token, "POST", `/lectures/${l2.id}/live/start`);
await call(t2.token, "POST", `/lectures/${l3.id}/live/start`);
const feed = await call(S, "GET", "/feed");
check("feed has live lectures", feed.live.length >= 2, feed.live.map((x) => [x.lecture.title, x.score, x.reason]));
const iS3 = feed.live.findIndex((x) => x.lecture.id === l2.id), iM1 = feed.live.findIndex((x) => x.lecture.id === l3.id);
check("grade match ranks above mismatch", iS3 >= 0 && iS3 < iM1);
const anon = await fetch(API + "/feed").then((r) => r.json());
check("feed is public", Array.isArray(anon.live));

// homework
const hw = await call(T, "POST", `/lectures/${lecture.id}/assignments`, { title: "واجب قانون أوم", instructions: "حل المسائل من 1 لـ 5", maxScore: 10 });
const sHw = await call(S, "GET", "/assignments");
check("student sees assignment", sHw.length === 1 && sHw[0].mySubmission === null);
const sub = await call(S, "POST", `/assignments/${hw.id}/submit`, { body: "الإجابة: R = 12 أوم" });
const graded = await call(T, "POST", `/submissions/${sub.id}/grade`, { score: 9, feedback: "ممتاز يا يوسف" });
check("graded", graded.score === 9);

// parent
const parent = await call(null, "POST", "/auth/signup", { role: "parent", name: "أحمد يوسف", email: `p${stamp}@test.com`, password: "password123", childCode: student.me.student.linkCode });
const P = parent.token;
const kids = await call(P, "GET", "/parent/children");
check("parent linked by code", kids.length === 1, kids[0]?.stats);
const kid = await call(P, "GET", `/parent/children/${student.me.user.id}`);
check("child report", kid.stats.lecturesAttended === 0 && kid.stats.avgScorePct === 90 && kid.payments.length === 1, kid.stats);

// admin + payout (release funds by hand: the scheduler waits PAYOUT_HOLD_HOURS)
const admin = await call(null, "POST", "/auth/signup", { role: "parent", name: "Admin", email: `admin+${stamp}@gahez.space`, password: "password123" }).catch(() => null);
async function denied(label, token, method, path, body, status = 400) {
  const r = await fetch(API + path, { method, headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
  check(label, r.status === status, r.status);
}
const questionA = crypto.randomUUID(), questionB = crypto.randomUUID();
const questions = [
  { id: questionA, prompt: "ما وحدة قياس المقاومة؟", options: ["أوم", "أمبير", "فولت", "واط"], correctIndex: 0, points: 3 },
  { id: questionB, prompt: "ما ناتج 2 + 2؟", options: ["3", "4", "5", "6"], correctIndex: 1, points: 2 },
];
await denied("reject inconsistent quiz total", T, "POST", `/lectures/${lecture.id}/assignments`, { title: "اختبار غير صحيح", questions, maxScore: 10 });
await denied("reject invalid answer key", T, "POST", `/lectures/${lecture.id}/assignments`, { title: "اختبار غير صحيح", questions: [{ ...questions[0], correctIndex: 4 }], maxScore: 3 });
const quiz = await call(T, "POST", `/lectures/${lecture.id}/assignments`, { title: "اختبار قصير مصحح تلقائيًا", questions, maxScore: 5 });
check("teacher receives answer key", quiz.questions[0].correctIndex === 0);
const studentQuiz = await call(S, "GET", `/assignments/${quiz.id}`);
check("student never receives answer key", studentQuiz.questions.every(q => !("correctIndex" in q)));
const parentQuiz = await call(P, "GET", `/assignments/${quiz.id}?studentId=${student.me.user.id}`);
check("parent never receives answer key", parentQuiz.questions.every(q => !("correctIndex" in q)));
await denied("reject incomplete quiz", S, "POST", `/assignments/${quiz.id}/submit`, { answers: { [questionA]: 0 } });
await denied("reject out-of-range answer", S, "POST", `/assignments/${quiz.id}/submit`, { answers: { [questionA]: 5, [questionB]: 1 } });
const auto = await call(S, "POST", `/assignments/${quiz.id}/submit`, { answers: { [questionA]: 0, [questionB]: 0 }, score: 999 });
check("server computes weighted grade, ignores supplied score", auto.score === 3 && auto.gradingMethod === "automatic" && Boolean(auto.gradedAt));
await denied("graded quiz cannot be retried", S, "POST", `/assignments/${quiz.id}/submit`, { answers: { [questionA]: 0, [questionB]: 1 } });
await denied("other teacher cannot read answer key", t2.token, "GET", `/assignments/${quiz.id}`, undefined, 403);
await denied("other teacher cannot grade", t2.token, "POST", `/submissions/${auto.id}/grade`, { score: 5 }, 403);
await denied("negative grade rejected", T, "POST", `/submissions/${auto.id}/grade`, { score: -1 });
const reviewed = await call(T, "POST", `/submissions/${auto.id}/grade`, { score: 4, feedback: "مراجعة المدرس" });
check("teacher can review automatic grade", reviewed.score === 4 && reviewed.gradingMethod === "manual");
const report = await call(P, "GET", `/parent/children/${student.me.user.id}`);
check("parent report includes automatic quiz and review", report.assignments.find(a => a.id === quiz.id)?.mySubmission?.score === 4 && report.stats.avgScorePct === 85);
const emptyStudent = await call(null, "POST", "/auth/signup", { role: "student", name: "طالب آخر", email: `outsider${stamp}@test.com`, password: "password123", grade: "s3" });
const otherParent = await call(null, "POST", "/auth/signup", { role: "parent", name: "ولي أمر آخر", email: `otherp${stamp}@test.com`, password: "password123", childCode: emptyStudent.me.student.linkCode });
await denied("parent cannot read assignment without child's booking", otherParent.token, "GET", `/assignments/${quiz.id}?studentId=${emptyStudent.me.user.id}`, undefined, 403);
await denied("unbooked student cannot read quiz", emptyStudent.token, "GET", `/assignments/${quiz.id}`, undefined, 403);
await denied("invalid parent link fails signup", T, "POST", "/auth/signup", { role: "parent", name: "ولي أمر", email: `badcode${stamp}@test.com`, password: "password123", childCode: "ZZZZZZ" });
const foreignUpload = await fetch(API + "/uploads", { method: "POST", headers: { authorization: `Bearer ${emptyStudent.token}`, "content-type": "application/pdf", "x-filename": "test.pdf" }, body: "%PDF-1.4 test" }).then(r => r.json());
const manual = await call(T, "POST", `/lectures/${lecture.id}/assignments`, { title: "ملفات الواجب", maxScore: 10 });
await denied("reject another student's attachment", S, "POST", `/assignments/${manual.id}/submit`, { attachmentIds: [foreignUpload.id] });
await denied("inactive lecture cannot count as replay", S, "POST", `/lectures/${lecture.id}/heartbeat`, { mode: "live" });
await call(S, "POST", `/lectures/${l2.id}/book`, {});
await denied("replay requires a ready recording", S, "POST", `/lectures/${l2.id}/heartbeat`, { mode: "replay" });
await call(S, "POST", `/lectures/${l2.id}/heartbeat`, { mode: "live" });
await new Promise(resolve => setTimeout(resolve, 1100));
await call(S, "POST", `/lectures/${l2.id}/heartbeat`, { mode: "live" });
const timed = await call(t2.token, "GET", `/lectures/${l2.id}/attendance`);
check("actual elapsed watch time is credited", timed.find(a => a.student.id === student.me.user.id)?.liveSeconds >= 1 && timed.find(a => a.student.id === student.me.user.id)?.liveSeconds < 5);


const raceQuiz = await call(T, "POST", `/lectures/${lecture.id}/assignments`, { title: "اختبار التسليم المتزامن", questions, maxScore: 5 });
const race = await Promise.all([0, 1].map(value => fetch(API + `/assignments/${raceQuiz.id}/submit`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${S}` }, body: JSON.stringify({ answers: { [questionA]: 0, [questionB]: value } }) }).then(r => r.status)));
check("only one concurrent quiz attempt is accepted", race.filter(s => s === 200).length === 1 && race.filter(s => s === 400).length === 1, race);
const oneSeat = await call(T, "POST", "/lectures", { title: "آخر مقعد — اختبار تزامن", subject: "physics", grade: "s3", startsAt: soon, durationMin: 60, priceCents: 0, capacity: 1 });
const seats = await Promise.all([S, emptyStudent.token].map(token => fetch(API + `/lectures/${oneSeat.id}/book`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: "{}" }).then(r => r.status)));
check("last seat cannot be double-booked", seats.filter(s => s === 201).length === 1 && seats.filter(s => s === 409).length === 1, seats);
const lateLecture = await call(T, "POST", "/lectures", { title: "تأكيد دفع متأخر — اختبار", subject: "physics", grade: "s3", startsAt: soon, durationMin: 60, priceCents: 10000 });
const lateBooking = await call(S, "POST", `/lectures/${lateLecture.id}/book`, {});
await call(T, "POST", `/lectures/${lateLecture.id}/cancel`, {});
await call(S, "POST", `/payments/mock/${lateBooking.payment.id}/complete`, { outcome: "success", method: "card" });
const latePay = await call(S, "GET", `/payments/${lateBooking.payment.id}`);
const lateDetail = await call(S, "GET", `/lectures/${lateLecture.id}`);
check("late payment for cancelled lecture is refunded without reopening booking", latePay.status === "refunded" && lateDetail.booking.status === "cancelled");
await call(S, "POST", `/payments/mock/${lateBooking.payment.id}/complete`, { outcome: "success", method: "card" });
check("duplicate payment callback stays refunded", (await call(S, "GET", `/payments/${lateBooking.payment.id}`)).status === "refunded");
const malformed = await fetch(API + "/uploads", { method: "POST", headers: { authorization: `Bearer ${S}`, "content-type": "application/pdf", "x-filename": "%" }, body: "%PDF-1.4 test" });
check("malformed upload name is a validation error", malformed.status === 400);
const fakeImage = await fetch(API + "/uploads", { method: "POST", headers: { authorization: `Bearer ${S}`, "content-type": "image/png", "x-filename": "fake.png" }, body: "<script>not an image</script>" });
check("reject MIME-spoofed upload", fakeImage.status === 400);
await denied("public signup cannot request administrator role", T, "POST", "/auth/signup", { role: "admin", name: "Admin", email: `role${stamp}@test.com`, password: "password123" });
await denied("invalid parent signup was rolled back", T, "POST", "/auth/login", { email: `badcode${stamp}@test.com`, password: "password123" }, 401);
const notes = await call(S, "GET", "/notifications");
check("student notifications", notes.length >= 3, notes.map((n) => n.title));

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
