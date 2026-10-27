// End-to-end smoke test of the whole product through the API: teacher,
// lecture, booking + mock payment, live Q&A, attendance, votes and feed,
// recording, homework, parent report. Needs a dev server with the mock
// gateway (pnpm run dev:watch). Run: pnpm run smoke
const API = process.env.API ?? "http://localhost:8080/api";
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
check("attendance 6 min", att[0]?.liveSeconds === 360, att[0]);
await call(T, "POST", `/lectures/${lecture.id}/recording`, { url: "https://example.com/rec.mp4" });
const withRec = await call(S, "GET", `/lectures/${lecture.id}`);
check("recording visible to booked student", withRec.recording?.url === "https://example.com/rec.mp4");

// votes + feed
const v = await call(S, "POST", `/lectures/${lecture.id}/vote`, { value: 1 });
check("verified like", v.likes === 1 && v.mine === 1);
const lv = await call(S, "GET", `/lectures/${lecture.id}`);
check("votes on dto", lv.votes.likes === 1 && lv.votes.mine === 1 && lv.votes.canVote === true, lv.votes);
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
const anon = await fetch("http://localhost:8080/api/feed").then((r) => r.json());
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
check("child report", kid.stats.lecturesAttended === 1 && kid.stats.avgScorePct === 90 && kid.payments.length === 1, kid.stats);

// admin + payout (release funds by hand: the scheduler waits PAYOUT_HOLD_HOURS)
const admin = await call(null, "POST", "/auth/signup", { role: "parent", name: "Admin", email: `admin+${stamp}@gahez.space`, password: "password123" }).catch(() => null);
const notes = await call(S, "GET", "/notifications");
check("student notifications", notes.length >= 3, notes.map((n) => n.title));

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
