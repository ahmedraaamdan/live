// Fills a development server with a believable demo, through the public API
// (so it exercises the same code the app does). Run against a dev server
// started with the mock gateway:
//
//   node scripts/seed-demo.mjs            (API defaults to http://localhost:8080/api)
//
// Every demo account uses the password below. Development data only.
const API = process.env.API ?? "http://localhost:8080/api";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(API).hostname)) throw new Error("Run test data only against an isolated local server");
const config = await fetch(API + "/config").then(r => r.json());
if (config.paymentProvider !== "mock") throw new Error("Test data requires the mock payment provider");
const PASSWORD = "demo12345";

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

async function account(role, name, email, extra = {}) {
  try {
    return await call(null, "POST", "/auth/signup", { role, name, email, password: PASSWORD, ...extra });
  } catch {
    return call(null, "POST", "/auth/login", { email, password: PASSWORD });
  }
}

const inMin = (m) => new Date(Date.now() + m * 60_000).toISOString();

async function lecture(t, body) {
  return call(t.token, "POST", "/lectures", { durationMin: 90, priceCents: 15000, capacity: 200, description: "", ...body });
}

async function bookAndPay(s, l) {
  const r = await call(s.token, "POST", `/lectures/${l.id}/book`, {});
  if (r.payment) await call(s.token, "POST", `/payments/mock/${r.payment.id}/complete`, { method: ["card", "wallet", "apple_pay", "google_pay"][Math.floor(Math.random() * 4)] });
}

async function watch(s, l, beats) {
  for (let i = 0; i < beats; i++) await call(s.token, "POST", `/lectures/${l.id}/heartbeat`, { mode: "live" });
}

console.log("Seeding demo data…");
const admin = await account("parent", "إدارة Gahez", "admin@gahez.space");
const physics = await account("teacher", "أ. محمد سامي", "teacher@demo.gahez", { subject: "physics" });
const math = await account("teacher", "أ. سارة علي", "math@demo.gahez", { subject: "math" });
const chem = await account("teacher", "د. كريم حسن", "chem@demo.gahez", { subject: "chemistry" });
const english = await account("teacher", "Mr. Omar Nabil", "english@demo.gahez", { subject: "english" });
await call(physics.token, "PATCH", "/me", { headline: "مدرس فيزياء ثانوي · 12 سنة خبرة", bio: "بشرح الفيزياء بالأمثلة اللي بتشوفها كل يوم." });
await call(math.token, "PATCH", "/me", { headline: "رياضيات تالتة ثانوي · تفاضل وتكامل" });
await call(chem.token, "PATCH", "/me", { headline: "كيمياء عضوية من غير حفظ" });

const student = await account("student", "يوسف أحمد", "student@demo.gahez", { grade: "s3", parentEmail: "parent@demo.gahez" });
const code = student.me.student?.linkCode;
const parent = await account("parent", "أحمد يوسف", "parent@demo.gahez", { childCode: code });

const crowd = [];
const names = ["مريم خالد", "عمر سعيد", "نور الهدى", "علي حسن", "سلمى محمود", "زياد طارق", "هنا وليد", "آدم شريف", "جنى إبراهيم", "مالك ياسر", "ليلى عادل", "كريم مصطفى"];
for (let i = 0; i < names.length; i++) crowd.push(await account("student", names[i], `crowd${i}@demo.gahez`, { grade: i % 4 === 0 ? "s2" : "s3" }));

// Live now: a loved physics class, a decent math class, and a crowded but disliked one.
const p1 = await lecture(physics, { title: "الكهربية التيارية: قانون أوم وتوصيل المقاومات", subject: "physics", grade: "s3", startsAt: inMin(2), description: "قانون أوم، التوصيل على التوالي والتوازي، ومسائل امتحانات." });
const m1 = await lecture(math, { title: "التفاضل: قواعد الاشتقاق ومسائل على الدوال", subject: "math", grade: "s3", startsAt: inMin(3), priceCents: 12000 });
const c1 = await lecture(chem, { title: "مراجعة عضوية سريعة (كل الباب في ساعة)", subject: "chemistry", grade: "s3", startsAt: inMin(1), priceCents: 9000, durationMin: 60 });
const e1 = await lecture(english, { title: "Grammar: Conditionals in 45 minutes", subject: "english", grade: "s2", startsAt: inMin(4), priceCents: 0, durationMin: 45 });
for (const [t, l] of [[physics, p1], [math, m1], [chem, c1], [english, e1]]) await call(t.token, "POST", `/lectures/${l.id}/live/start`);

await bookAndPay(student, p1);
await bookAndPay(student, m1);
for (const [i, s] of crowd.entries()) {
  await bookAndPay(s, p1);
  if (i < 8) await bookAndPay(s, c1);
  if (i < 5) await bookAndPay(s, m1);
  if (i % 2 === 0) await bookAndPay(s, e1);
}
// Watch long enough to vote, then vote.
for (const [i, s] of crowd.entries()) {
  await watch(s, p1, 7);
  await call(s.token, "POST", `/lectures/${p1.id}/vote`, { value: i === 11 ? -1 : 1 });
  if (i < 8) {
    await watch(s, c1, 6);
    await call(s.token, "POST", `/lectures/${c1.id}/vote`, { value: i < 2 ? 1 : -1 });
  }
  if (i < 5) {
    await watch(s, m1, 6);
    await call(s.token, "POST", `/lectures/${m1.id}/vote`, { value: i === 4 ? -1 : 1 });
  }
}
await call(crowd[0].token, "POST", `/lectures/${p1.id}/messages`, { kind: "question", body: "يعني إيه مقاومة مكافئة يا مستر؟" });
await call(crowd[1].token, "POST", `/lectures/${p1.id}/messages`, { kind: "question", body: "التوصيل على التوازي بيقلل المقاومة ليه؟" });
await call(crowd[2].token, "POST", `/lectures/${p1.id}/messages`, { kind: "comment", body: "الشرح جامد جدًا 🔥" });

// Upcoming.
await lecture(physics, { title: "المغناطيسية: المجال حول سلك مستقيم", subject: "physics", grade: "s3", startsAt: inMin(60 * 26) });
await lecture(math, { title: "التكامل المحدد والمساحات", subject: "math", grade: "s3", startsAt: inMin(60 * 5), priceCents: 12000 });
await lecture(chem, { title: "الاتزان الكيميائي: مسائل Kc و Kp", subject: "chemistry", grade: "s3", startsAt: inMin(60 * 50), priceCents: 10000 });
const next = await lecture(physics, { title: "حل امتحانات: الكهربية (الجزء الأول)", subject: "physics", grade: "s3", startsAt: inMin(60 * 3), priceCents: 10000 });
await bookAndPay(student, next);

// An earlier class (live now, ended below) with a recording and homework for the demo student.
const past = await lecture(physics, { title: "مقدمة الكهربية: الشحنة والتيار", subject: "physics", grade: "s3", startsAt: inMin(1), priceCents: 10000 });
await call(physics.token, "POST", `/lectures/${past.id}/live/start`);
await bookAndPay(student, past);
await watch(student, past, 10);
await call(physics.token, "POST", `/lectures/${past.id}/live/end`);
await call(physics.token, "POST", `/lectures/${past.id}/recording`, { url: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4" });
await call(physics.token, "POST", `/lectures/${past.id}/assignments`, { title: "واجب الشحنة والتيار", instructions: "حل المسائل من 1 لـ 6 في كراسة التمارين وصوّر الحل.", maxScore: 10, dueAt: inMin(60 * 48) });
await call(physics.token, "POST", `/lectures/${p1.id}/assignments`, { title: "مسائل قانون أوم", instructions: "احسب المقاومة المكافئة في الأشكال من 1 لـ 4.", maxScore: 20, dueAt: inMin(60 * 24) });

console.log(`
Done. Password for every demo account: ${PASSWORD}
  teacher  teacher@demo.gahez
  student  student@demo.gahez   (link code ${code})
  parent   parent@demo.gahez
  admin    admin@gahez.space    (parent account; administrator provisioning is separate)
`);
void admin;
void parent;
