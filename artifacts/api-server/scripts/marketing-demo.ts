/**
 * A self-contained copy of the app filled with a month of invented activity,
 * for screen recordings and marketing visuals. Never touches a real database:
 * it refuses to start when DATABASE_URL is set or NODE_ENV is production, keeps
 * its data in .data/marketing-demo (embedded Postgres), uses the mock gateway,
 * sends no email, and listens on this machine only.
 *
 *   pnpm --filter @workspace/live-app run build     (BASE_PATH=/ , once)
 *   pnpm --filter @workspace/api-server run demo:marketing
 *   pnpm --filter @workspace/api-server run demo:marketing -- --reset
 *
 * Then open http://localhost:8095/__demo and pick an account. Dates are relative
 * to the seeding moment: the past 30 days are finished classes, today has live
 * classes, and the coming month is scheduled. Use --reset to refresh them.
 */
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.DATABASE_URL) throw new Error("Refusing to run: DATABASE_URL is set. This demo only ever uses its own embedded database.");
if (process.env.NODE_ENV === "production") throw new Error("Refusing to run in production.");

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.DEMO_PORT ?? 8095);
const ORIGIN = `http://localhost:${PORT}`;
const DATA_DIR = path.resolve(here, "../.data/marketing-demo");
const APP_DIST = path.resolve(here, "../../live-app/dist");
const PORTRAITS = path.resolve(here, "../../jahez-live/public/images/teachers");
const ACCOUNTS_FILE = path.join(DATA_DIR, "accounts.json");
const PASSWORD = "demo-gahez-2026";

if (!existsSync(path.join(APP_DIST, "index.html"))) throw new Error(`Build the app first: ${APP_DIST} is missing.`);
if (process.argv.includes("--reset")) rmSync(DATA_DIR, { recursive: true, force: true });
mkdirSync(DATA_DIR, { recursive: true });

Object.assign(process.env, {
  NODE_ENV: "development",
  PORT: String(PORT),
  PAYMENT_PROVIDER: "mock",
  APP_URL: ORIGIN,
  API_URL: ORIGIN,
  APP_DIST,
  UPLOAD_DIR: path.join(DATA_DIR, "uploads"),
  ADMIN_EMAILS: "admin@demo.gahez",
  SUPER_ADMIN_EMAILS: "admin@demo.gahez",
  SMTP_HOST: "",
  SMTP_USER: "",
  SMTP_PASS: "",
  LIVEKIT_URL: "",
  EASYKASH_API_KEY: "",
  LOG_LEVEL: "warn",
});

const database = await import("@workspace/db");
const { default: express } = await import("express");
const { eq } = await import("drizzle-orm");
const { SUBJECTS, GRADES, subjectLabel, gradeLabel, splitBooking } = await import("@workspace/live-core");
const { createSession, hashPassword } = await import("../src/lib/auth");
const { newTotpSecret, sealSecret } = await import("../src/lib/two-factor");
const { shortCode } = await import("../src/lib/codes");
const { subscribe } = await import("../src/lib/events");
const { default: app } = await import("../src/app");

const {
  assignmentsTable, attendanceTable, bookingsTable, initDb, lectureMessagesTable, lectureReportsTable, lecturesTable, lectureVotesTable,
  notificationsTable, parentLinksTable, paymentsTable, payoutsTable, savedLecturesTable, studentProfilesTable, submissionsTable,
  supportTicketMessagesTable, supportTicketsTable, teacherFollowsTable, teacherProfilesTable, teacherVerificationsTable, userSecurityTable, usersTable, verificationDocumentsTable, walletEntriesTable,
} = database;

const FEE_BPS = 1000;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// ---------------------------------------------------------------- randomness

/** Seeded, so a --reset gives the same people and the same shape every time. */
let seed = 20261031;
function random() {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (min: number, max: number) => min + random() * (max - min);
const whole = (min: number, max: number) => Math.floor(between(min, max + 1));
const pick = <T,>(items: readonly T[]) => items[Math.floor(random() * items.length)]!;
const chance = (p: number) => random() < p;
function weighted<T>(items: ReadonlyArray<readonly [T, number]>): T {
  let roll = random() * items.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [item, weight] of items) if ((roll -= weight) <= 0) return item;
  return items[0]![0];
}
function sample<T>(items: readonly T[], count: number): T[] {
  const pool = [...items], out: T[] = [];
  for (let i = 0; i < count && pool.length; i++) out.push(pool.splice(Math.floor(random() * pool.length), 1)[0]!);
  return out;
}

// ---------------------------------------------------------------- content

const MALE = ["محمد", "أحمد", "محمود", "مصطفى", "يوسف", "عمر", "كريم", "علي", "حسن", "إبراهيم", "خالد", "طارق", "عمرو", "هشام", "سامح", "وليد", "ياسين", "زياد", "مروان", "آدم", "سيف", "عبد الله", "أنس", "بلال", "حمزة"];
const FEMALE = ["مريم", "سارة", "نور", "هبة", "آية", "فاطمة", "ياسمين", "دينا", "منى", "رنا", "سلمى", "جنى", "ملك", "روان", "هنا", "شهد", "لينا", "إسراء", "نهى", "أميرة", "ندى", "حبيبة", "رقية", "مها", "دعاء"];
const FAMILY = ["السيد", "حسن", "إبراهيم", "عبد الرحمن", "مصطفى", "الشافعي", "فؤاد", "سالم", "رمضان", "عبد العزيز", "النجار", "البنا", "صبري", "زكي", "الجندي", "شاهين", "عوض", "غنيم", "المصري", "نبيل", "فتحي", "جمال", "رشاد", "توفيق", "منصور"];
const fullName = () => `${pick(chance(0.5) ? MALE : FEMALE)} ${pick(FAMILY)}`;

/** The first seven reuse the illustrative characters and portraits of the marketing site. */
const HEROES = [
  { name: "أ. نورة العتيبي", subject: "math", photo: "noura", headline: "مدرسة رياضيات للثانوية العامة", bio: "بحوّل التفاضل والتكامل لخطوات تقدر تفهمها قبل ما تحفظها.", years: 11 },
  { name: "د. يزن الحربي", subject: "chemistry", photo: "yazan", headline: "دكتور كيمياء وتجارب عملية", bio: "الكيمياء عندي بتبدأ بالتجربة، وبعدها المعادلة بتبقى منطقية.", years: 14 },
  { name: "أ. ليان الشريف", subject: "arabic", photo: "layan", headline: "لغة عربية ومهارات الكتابة", bio: "نحو وبلاغة وتعبير، بأسلوب يخلّيك تكتب إجابة كاملة الدرجة.", years: 9 },
  { name: "أ. فهد السبيعي", subject: "physics", photo: "fahad", headline: "فيزياء الثانوية بشرح تطبيقي", bio: "كل قانون له قصة ومثال من حياتك، وبعدها مسائل بنحلها مع بعض.", years: 12 },
  { name: "أ. سارة القحطاني", subject: "arabic", photo: "sara", headline: "تأسيس اللغة العربية للمرحلة الإعدادية", bio: "بأسس الطالب في النحو والقراءة خطوة بخطوة.", years: 7 },
  { name: "د. مازن الدوسري", subject: "math", photo: "mazen", headline: "دكتور رياضيات ومراجعات نهائية", bio: "مراجعات مركزة على أفكار الامتحان وطريقة التفكير في المسألة.", years: 16 },
  { name: "أ. ريم النجار", subject: "english", photo: "reem", headline: "محادثة وقواعد اللغة الإنجليزية", bio: "هتتكلم إنجليزي من أول حصة، والقواعد بتيجي مع الاستخدام.", years: 8 },
  { name: "أ. كريم عبد الرحمن", subject: "physics", photo: null, headline: "فيزياء وكهربية للصف الثالث الثانوي", bio: "شرح مبسط للكهربية والمغناطيسية مع نماذج امتحانات.", years: 10 },
  { name: "د. هبة مصطفى", subject: "biology", photo: null, headline: "أحياء بالرسم والخرائط الذهنية", bio: "بنفهم الأحياء بالرسم، فتفتكرها في الامتحان من غير حفظ.", years: 13 },
  { name: "أ. عمر نبيل", subject: "computer", photo: null, headline: "برمجة وحاسب آلي من الصفر", bio: "نتعلم البرمجة بمشاريع صغيرة تشتغل قدامك.", years: 6 },
] as const;
const OTHER_SUBJECTS = ["math", "math", "physics", "physics", "chemistry", "arabic", "arabic", "english", "english", "biology", "french", "german", "history", "geography", "philosophy", "science", "computer", "religion"] as const;

const TOPICS: Record<string, string[]> = {
  math: ["النهايات ببساطة", "التفاضل وتطبيقاته", "التكامل المحدد", "المصفوفات", "المتتابعات", "حساب المثلثات", "الهندسة الفراغية", "الدوال وتمثيلها البياني", "الاحتمالات", "مراجعة الجبر"],
  physics: ["الحركة الدائرية", "قوانين نيوتن", "الكهربية التيارية", "المغناطيسية", "الموجات والضوء", "الشغل والطاقة", "الفيزياء الحديثة", "الدوائر الكهربية"],
  chemistry: ["التفاعلات الكيميائية", "الكيمياء العضوية", "الاتزان الكيميائي", "الكهربية الكيميائية", "الجدول الدوري", "الأحماض والقواعد", "الروابط الكيميائية"],
  arabic: ["المبتدأ والخبر", "البلاغة ببساطة", "كتابة إجابة منظمة", "الأدب والنصوص", "الإعراب خطوة بخطوة", "القراءة المتحررة", "التعبير الوظيفي"],
  english: ["Speaking with confidence", "Tenses made simple", "Writing a paragraph", "Reading skills", "Phrasal verbs", "Exam vocabulary", "Grammar review"],
  biology: ["الوراثة", "الجهاز العصبي", "التكاثر", "المناعة", "الدعامة والحركة", "البيولوجيا الجزيئية"],
  french: ["Les bases du français", "Conjugaison", "Compréhension écrite"],
  german: ["Deutsch für Anfänger", "Grammatik", "Lesen und Schreiben"],
  history: ["ثورة 1919", "الحضارة المصرية القديمة", "الحملة الفرنسية", "مصر الحديثة"],
  geography: ["خرائط مصر", "المناخ والسكان", "الجغرافيا السياسية"],
  philosophy: ["مدخل إلى المنطق", "الفلسفة وعلم النفس", "التفكير النقدي"],
  science: ["الخلية", "القوى والحركة", "الطاقة", "الكائنات الحية"],
  computer: ["أساسيات Python", "الخوارزميات", "تصميم صفحات الويب", "قواعد البيانات"],
  religion: ["آيات وأحكام", "السيرة النبوية", "القيم والأخلاق"],
};
const STYLE = ["شرح ومراجعة", "حل نماذج امتحانات", "من الصفر", "أهم الأفكار", "تدريب وأسئلة", "ليلة الامتحان"];
const QUESTIONS = ["ممكن حضرتك تعيد النقطة دي تاني؟", "هل الجزء ده بييجي في الامتحان؟", "طب لو المسألة جت بالعكس نحلها إزاي؟", "إيه الفرق بين الطريقتين؟", "ممكن مثال تاني؟", "القانون ده ينفع نستخدمه في كل الحالات؟", "الواجب هيكون على الجزء ده؟"];
const ANSWERS = ["أكيد، هنحل مثال كمان دلوقتي.", "أيوه، وبييجي غالبًا في أول سؤال.", "ركز في المعطيات الأول، وبعدها هتلاقيها نفس الفكرة.", "الطريقة التانية أسرع، بس الأولى أوضح للفهم.", "نعم، بشرط تتأكد من الوحدات.", "هرفع لكم ملخص بعد الحصة."];
const WRITTEN = ["حليت الأسئلة كلها، والمسألة الأخيرة أخدت وقت بس وصلت للناتج.", "مرفق الحل بالخطوات زي ما شرحت حضرتك.", "حليتها بطريقتين، وعندي سؤال في الجزء التالت.", "الحل كامل، راجعت النواتج مرتين."];
const FEEDBACK = ["ممتاز، خطوات الحل واضحة.", "شغل كويس، راجع النقطة الأخيرة.", "أحسنت! حافظ على المستوى ده.", "حل صحيح، بس محتاج ترتب الخطوات أكتر.", "مجهود رائع، استمر."];

function quizFor(subject: string) {
  const label = subjectLabel(subject);
  return Array.from({ length: 5 }, (_, i) => ({
    id: randomUUID(),
    prompt: `السؤال ${i + 1}: اختر الإجابة الصحيحة في ${label}.`,
    options: ["الإجابة الأولى", "الإجابة الثانية", "الإجابة الثالثة", "الإجابة الرابعة"],
    correctIndex: whole(0, 3),
    points: 2,
  }));
}

// ---------------------------------------------------------------- seeding

async function insertAll(tx: any, table: any, rows: any[], size = 800) {
  for (let i = 0; i < rows.length; i += size) await tx.insert(table).values(rows.slice(i, i + size));
}

interface DemoAccount { id: string; role: string; name: string; email: string; note: string }

async function seedDemo(): Promise<DemoAccount[]> {
  const started = Date.now();
  const now = new Date();
  const ago = (ms: number) => new Date(now.getTime() - ms);
  const passwordHash = await hashPassword(PASSWORD);
  const codes = new Set<string>();
  const uniqueCode = (length: number) => { for (;;) { const code = shortCode(length); if (!codes.has(code)) { codes.add(code); return code; } } };

  // People ---------------------------------------------------------------
  const admin = { id: randomUUID(), role: "admin" as const, name: "إدارة جاهز", email: "admin@demo.gahez", passwordHash, createdAt: ago(45 * DAY) };
  const teachers = Array.from({ length: 50 }, (_, i) => {
    const hero = HEROES[i];
    const subject = hero?.subject ?? OTHER_SUBJECTS[i % OTHER_SUBJECTS.length]!;
    const person = hero?.name ?? `${chance(0.2) ? "د." : "أ."} ${fullName()}`;
    return {
      id: randomUUID(), subject, hero: Boolean(hero), quality: hero ? between(0.91, 0.98) : between(0.78, 0.97),
      grades: subject === "english" || subject === "computer" ? ["s1", "s2", "s3", "uni"] : subject === "arabic" && i === 4 ? ["m1", "m2", "m3"] : pick([["s3", "s2"], ["s3", "s1"], ["s2", "s1"], ["m3", "s1"], ["s3"]]),
      user: { role: "teacher" as const, name: person, email: i < 10 ? `teacher${i + 1}@demo.gahez` : `t${i + 1}@demo.gahez`, passwordHash, avatarUrl: hero?.photo ? `${ORIGIN}/demo-media/${hero.photo}.webp` : null, createdAt: ago(between(32, 45) * DAY) },
      profile: { headline: hero?.headline ?? `مدرس ${subjectLabel(subject)}`, bio: hero?.bio ?? `شرح مبسط في ${subjectLabel(subject)} مع تدريب ومتابعة.`, experience: hero ? `${hero.years} سنة خبرة في تدريس ${subjectLabel(subject)}.` : `${whole(3, 15)} سنة خبرة في التدريس.` },
    };
  });
  const gradeMix = [["s3", 30], ["s2", 20], ["s1", 15], ["m3", 12], ["m2", 8], ["m1", 5], ["uni", 7], ["p6", 3]] as const;
  const students = Array.from({ length: 2000 }, (_, i) => ({
    id: randomUUID(), name: i === 0 ? "يوسف أحمد" : i === 1 ? "مريم أحمد" : fullName(), email: i === 0 ? "student@demo.gahez" : `s${i + 1}@demo.gahez`,
    grade: i <= 1 ? "s3" : weighted(gradeMix), createdAt: ago(between(31, 45) * DAY), parentEmail: i <= 1 ? "parent@demo.gahez" : chance(0.6) ? `p${i + 1}@demo.gahez` : null, linkCode: uniqueCode(6),
  }));
  const parents = Array.from({ length: 450 }, (_, i) => ({ id: randomUUID(), name: i === 0 ? "أحمد يوسف" : fullName(), email: i === 0 ? "parent@demo.gahez" : `parent${i + 1}@demo.gahez`, createdAt: ago(between(25, 44) * DAY) }));
  const byGrade = new Map<string, typeof students>();
  for (const student of students) (byGrade.get(student.grade) ?? byGrade.set(student.grade, []).get(student.grade)!).push(student);

  await db().transaction(async (tx) => {
    await tx.insert(usersTable).values(admin);
    await insertAll(tx, usersTable, teachers.map((t) => ({ id: t.id, ...t.user })));
    await insertAll(tx, usersTable, students.map((s) => ({ id: s.id, role: "student" as const, name: s.name, email: s.email, passwordHash, phone: s.email === "student@demo.gahez" ? "01000000000" : null, createdAt: s.createdAt })));
    await insertAll(tx, usersTable, parents.map((p) => ({ id: p.id, role: "parent" as const, name: p.name, email: p.email, passwordHash, createdAt: p.createdAt })));
    await insertAll(tx, teacherProfilesTable, teachers.map((t) => ({ userId: t.id, subject: t.subject, ...t.profile })));
    await insertAll(tx, studentProfilesTable, students.map((s) => ({ userId: s.id, grade: s.grade, parentEmail: s.parentEmail, linkCode: s.linkCode })));
    const links = [{ parentId: parents[0]!.id, studentId: students[0]!.id }, { parentId: parents[0]!.id, studentId: students[1]!.id }];
    for (const parent of parents.slice(1)) for (const student of sample(students.slice(2), chance(0.2) ? 2 : 1)) links.push({ parentId: parent.id, studentId: student.id });
    await insertAll(tx, parentLinksTable, links);
    // Admin tools and teaching both need two-factor, as in production; the picker signs in directly.
    await tx.insert(userSecurityTable).values({ userId: admin.id, totpSecretEnc: sealSecret(newTotpSecret()), totpEnabledAt: admin.createdAt });
    await insertAll(tx, userSecurityTable, teachers.map((t) => ({ userId: t.id, googleSubject: `demo-${t.id}`, googleEmail: t.user.email, totpSecretEnc: sealSecret(newTotpSecret()), totpEnabledAt: t.user.createdAt })));
    const documents = teachers.flatMap((t) => [0, 1].map((n) => ({ id: randomUUID(), ownerId: t.id, filename: `demo-${n}.png`, mime: "image/png", size: 1, storageKey: "demo-fixture" })));
    await insertAll(tx, verificationDocumentsTable, documents);
    await insertAll(tx, teacherVerificationsTable, teachers.map((t, i) => ({ teacherId: t.id, status: "approved" as const, fullName: t.user.name.replace(/^(أ\.|د\.)\s*/, ""), phone: "01000000000", subject: subjectLabel(t.subject), governorate: pick(["القاهرة", "الجيزة", "الإسكندرية", "المنصورة", "طنطا", "أسيوط"]), qualification: `بكالوريوس في ${subjectLabel(t.subject)}`, experienceYears: whole(3, 16), membershipNumber: `DEMO-${1000 + i}`, frontDocumentId: documents[i * 2]!.id, backDocumentId: documents[i * 2 + 1]!.id, submittedAt: t.user.createdAt, reviewedAt: new Date(t.user.createdAt.getTime() + DAY), reviewerId: admin.id })));
  });
  console.log(`  people: ${teachers.length} teachers, ${students.length} students, ${parents.length} parents`);

  // Lectures -------------------------------------------------------------
  const prices = [[0, 12], [5000, 18], [7500, 18], [10000, 22], [12000, 12], [15000, 12], [20000, 6]] as const;
  type DemoLecture = { row: typeof lecturesTable.$inferInsert & { id: string }; teacher: (typeof teachers)[number]; end: Date; phase: "past" | "live" | "future" | "cancelled" };
  const lectures: DemoLecture[] = [];
  const makeLecture = (teacher: (typeof teachers)[number], startsAt: Date, phase: DemoLecture["phase"]) => {
    const durationMin = pick([60, 60, 90, 90, 120]);
    const topic = pick(TOPICS[teacher.subject] ?? TOPICS.science!);
    const end = new Date(startsAt.getTime() + durationMin * 60_000);
    const released = phase === "past" && now.getTime() - end.getTime() > DAY;
    const lecture: DemoLecture = {
      teacher, end, phase,
      row: {
        id: randomUUID(), teacherId: teacher.id, code: uniqueCode(7), title: `${topic}: ${pick(STYLE)}`, subject: teacher.subject, grade: pick(teacher.grades),
        description: `حصة مباشرة في ${subjectLabel(teacher.subject)}. هنشرح ${topic} بالتفصيل، ونحل أمثلة مع بعض، وتقدر تسأل في أي وقت.`,
        startsAt, durationMin, priceCents: weighted(prices), capacity: pick([30, 40, 50, 60, 80, 100]), listed: true,
        status: phase === "past" ? "ended" : phase === "live" ? "live" : phase === "cancelled" ? "cancelled" : "scheduled",
        liveStartedAt: phase === "past" || phase === "live" ? new Date(startsAt.getTime() + whole(0, 4) * 60_000) : null,
        liveEndedAt: phase === "past" ? new Date(end.getTime() + whole(0, 10) * 60_000) : null,
        reminderSentAt: phase === "past" ? new Date(startsAt.getTime() - HOUR) : null,
        fundsReleasedAt: released ? new Date(end.getTime() + DAY) : null,
        createdAt: new Date(Math.min(now.getTime() - HOUR, startsAt.getTime() - between(4, 16) * DAY)),
      },
    };
    lectures.push(lecture);
    return lecture;
  };
  for (const teacher of teachers) {
    const perWeek = teacher.hero ? 4 : whole(2, 3);
    const slots = Array.from({ length: perWeek }, () => ({ weekday: whole(0, 6), hour: whole(15, 22), minute: pick([0, 0, 30]) }));
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (let dayOffset = -30; dayOffset <= 30; dayOffset++) {
      const date = new Date(today.getTime() + dayOffset * DAY);
      for (const slot of slots) {
        if (date.getDay() !== slot.weekday) continue;
        const startsAt = new Date(date.getFullYear(), date.getMonth(), date.getDate(), slot.hour, slot.minute);
        if (startsAt.getTime() > now.getTime() - 4 * HOUR && startsAt.getTime() < now.getTime() + HOUR) continue;
        makeLecture(teacher, startsAt, startsAt < now ? (chance(0.012) ? "cancelled" : "past") : "future");
      }
    }
  }
  // Classes on air right now: most of the heroes, so every recording has a live moment.
  for (const teacher of teachers.slice(0, 6)) makeLecture(teacher, new Date(now.getTime() - whole(4, 35) * 60_000), "live").row.durationMin = 120;

  // Bookings, money, attendance, ratings, homework ------------------------
  const bookings: Array<typeof bookingsTable.$inferInsert> = [];
  const payments: Array<typeof paymentsTable.$inferInsert> = [];
  const wallet: Array<typeof walletEntriesTable.$inferInsert> = [];
  const attendance: Array<typeof attendanceTable.$inferInsert> = [];
  const votes: Array<typeof lectureVotesTable.$inferInsert> = [];
  const assignments: Array<typeof assignmentsTable.$inferInsert> = [];
  const submissions: Array<typeof submissionsTable.$inferInsert> = [];
  const messages: Array<typeof lectureMessagesTable.$inferInsert> = [];
  const available = new Map<string, number>();
  const star = students[0]!;

  for (const lecture of lectures) {
    const { row, teacher, phase } = lecture;
    const pool = byGrade.get(row.grade) ?? students;
    const capacity = row.capacity!;
    const daysAway = (row.startsAt.getTime() - now.getTime()) / DAY;
    const fill = phase === "past" || phase === "live" || phase === "cancelled" ? (teacher.hero ? between(0.55, 0.98) : between(0.2, 0.7)) : Math.max(0.04, (teacher.hero ? 0.7 : 0.35) * Math.exp(-daysAway / 14) * between(0.6, 1.1));
    const chosen = sample(pool, Math.min(pool.length, Math.max(3, Math.round(capacity * fill))));
    // Keep the showcase student busy with the showcase teachers.
    if (teacher.hero && row.grade === "s3" && !chosen.includes(star) && (phase === "live" || (phase === "past" ? chance(0.45) : daysAway < 16 && chance(0.5)))) chosen.push(star);
    const hasHomework = phase === "past" && chance(0.8);
    let assignment: (typeof assignments)[number] | null = null;
    if (hasHomework) {
      const quiz = chance(0.6) ? quizFor(row.subject) : [];
      assignment = { id: randomUUID(), lectureId: row.id, teacherId: row.teacherId, title: `واجب: ${row.title.split(":")[0]}`, instructions: quiz.length ? "اختار الإجابة الصحيحة لكل سؤال." : "حل التدريبات بخطوات واضحة وارفع إجابتك.", questions: quiz, maxScore: quiz.length ? 10 : 20, dueAt: new Date(lecture.end.getTime() + whole(2, 5) * DAY), createdAt: new Date(lecture.end.getTime() + whole(1, 5) * HOUR) };
      assignments.push(assignment);
    }
    for (const student of chosen) {
      const bookingId = randomUUID();
      const paid = row.priceCents > 0;
      const confirmedAt = new Date(Math.min(now.getTime(), row.startsAt.getTime()) - between(0.05, phase === "future" ? Math.min(10, Math.max(1, 12 - daysAway)) : 9) * DAY);
      const paymentId = paid ? randomUUID() : null;
      bookings.push({ id: bookingId, lectureId: row.id, studentId: student.id, status: phase === "cancelled" ? "refunded" : "confirmed", pricePaidCents: row.priceCents, createdAt: confirmedAt, confirmedAt, confirmedPaymentId: paymentId });
      if (paymentId) {
        payments.push({ id: paymentId, bookingId, userId: student.id, provider: "mock", providerRef: `demo_${paymentId}`, providerTxnId: `demo_txn_${paymentId.slice(0, 8)}`, amountCents: row.priceCents, status: phase === "cancelled" ? "refunded" : "succeeded", method: weighted([["wallet", 42], ["card", 34], ["cash", 14], ["apple_pay", 6], ["google_pay", 4]] as const), createdAt: confirmedAt, updatedAt: confirmedAt });
        const { platformCents, teacherCents } = splitBooking(row.priceCents, FEE_BPS);
        const status = phase === "cancelled" ? "void" as const : row.fundsReleasedAt ? "available" as const : "pending" as const;
        const shared = { lectureId: row.id, bookingId, paymentId, status, memo: row.title, createdAt: confirmedAt, teacherId: row.teacherId };
        wallet.push({ ...shared, owner: "teacher", kind: "sale", amountCents: teacherCents }, { ...shared, owner: "platform", kind: "commission", amountCents: platformCents });
        if (status === "available") available.set(row.teacherId, (available.get(row.teacherId) ?? 0) + teacherCents);
      }
      if (phase === "live" && chance(0.75)) attendance.push({ lectureId: row.id, studentId: student.id, liveSeconds: Math.round((now.getTime() - row.startsAt.getTime()) / 1000 * between(0.5, 1)), replaySeconds: 0, firstSeenAt: row.startsAt, lastSeenAt: now });
      if (phase !== "past") continue;
      const attended = student === star ? chance(0.92) : chance(0.84);
      if (attended) {
        const liveSeconds = Math.round(row.durationMin * 60 * between(0.55, 1));
        const firstSeenAt = new Date(row.startsAt.getTime() + whole(0, 300) * 1000);
        attendance.push({ lectureId: row.id, studentId: student.id, liveSeconds, replaySeconds: 0, firstSeenAt, lastSeenAt: new Date(firstSeenAt.getTime() + liveSeconds * 1000) });
        if (chance(0.48)) votes.push({ lectureId: row.id, studentId: student.id, value: chance(teacher.quality) ? 1 : -1, createdAt: lecture.end, updatedAt: lecture.end });
      }
      if (!assignment || !attended || !chance(student === star ? 0.8 : 0.72)) continue;
      const submittedAt = new Date(Math.min(now.getTime() - 5 * 60_000, assignment.createdAt!.getTime() + between(2, 60) * HOUR));
      const quiz = assignment.questions ?? [];
      if (quiz.length) {
        const answers = Object.fromEntries(quiz.map((q) => [q.id, chance(0.74) ? q.correctIndex : whole(0, 3)]));
        const score = quiz.reduce((sum, q) => sum + (answers[q.id] === q.correctIndex ? q.points : 0), 0);
        submissions.push({ assignmentId: assignment.id!, studentId: student.id, answers, score, gradingMethod: "automatic", feedback: "صُحّح تلقائيًا وفق مفتاح الإجابة الذي حدده المدرس. يمكن للمدرس مراجعة الدرجة.", gradedAt: submittedAt, submittedAt });
      } else {
        const graded = now.getTime() - submittedAt.getTime() > 2 * DAY || chance(0.3);
        submissions.push({ assignmentId: assignment.id!, studentId: student.id, body: pick(WRITTEN), submittedAt, gradingMethod: "manual", score: graded ? whole(11, 20) : null, feedback: graded ? pick(FEEDBACK) : null, gradedAt: graded ? new Date(submittedAt.getTime() + between(2, 30) * HOUR) : null });
      }
    }
    if ((phase === "live" || (phase === "past" && teacher.hero)) && chosen.length) {
      for (let i = 0; i < (phase === "live" ? 9 : 5); i++) {
        const asker = pick(chosen);
        const at = new Date(Math.min(now.getTime() - 60_000, row.startsAt.getTime() + (8 + i * 5) * 60_000));
        const questionId = randomUUID();
        const answered = chance(0.7);
        messages.push({ id: questionId, lectureId: row.id, userId: asker.id, kind: "question", body: pick(QUESTIONS), answered, createdAt: at });
        if (answered) messages.push({ lectureId: row.id, userId: row.teacherId, kind: "answer", body: pick(ANSWERS), parentId: questionId, createdAt: new Date(at.getTime() + 40_000) });
      }
    }
  }
  // Keep the showcase student with something still to do.
  const starAssignments = new Set(submissions.filter((s) => s.studentId === star.id).map((s) => s.assignmentId));
  const pendingForStar = assignments.filter((a) => starAssignments.has(a.id!)).slice(-3).map((a) => a.id);
  const openSubmissions = submissions.filter((s) => !(s.studentId === star.id && pendingForStar.includes(s.assignmentId)));
  for (const a of assignments.filter((x) => pendingForStar.includes(x.id))) a.dueAt = new Date(now.getTime() + whole(2, 5) * DAY);

  // Payouts: part of what became available has already been withdrawn.
  const payouts: Array<typeof payoutsTable.$inferInsert> = [];
  for (const teacher of teachers) {
    const balance = available.get(teacher.id) ?? 0;
    if (balance < 50_000) continue;
    const first = Math.round((balance * between(0.3, 0.45)) / 100) * 100;
    const second = Math.round((balance * between(0.15, 0.25)) / 100) * 100;
    const method = pick(["instapay", "vodafone_cash", "bank"] as const);
    const account = method === "bank" ? "حساب تجريبي •••• 1024" : "010•••••000";
    const paidAt = ago(between(6, 12) * DAY);
    const rows = [{ amountCents: first, status: "paid" as const, createdAt: ago(between(13, 18) * DAY), processedAt: paidAt }, { amountCents: second, status: chance(0.3) ? "requested" as const : "paid" as const, createdAt: ago(between(1, 5) * DAY), processedAt: null as Date | null }];
    for (const row of rows) {
      const payoutId = randomUUID();
      payouts.push({ id: payoutId, teacherId: teacher.id, method, account, ...row, processedAt: row.status === "paid" ? row.processedAt ?? ago(DAY / 2) : null });
      wallet.push({ owner: "teacher", teacherId: teacher.id, kind: "payout", amountCents: -row.amountCents, status: "available", payoutId, memo: "طلب سحب", createdAt: row.createdAt });
    }
  }

  await db().transaction(async (tx) => {
    await insertAll(tx, lecturesTable, lectures.map((l) => l.row));
    await insertAll(tx, bookingsTable, bookings);
    await insertAll(tx, paymentsTable, payments);
    await insertAll(tx, payoutsTable, payouts);
  });
  console.log(`  lectures: ${lectures.length}, bookings: ${bookings.length}, payments: ${payments.length}, payouts: ${payouts.length}`);
  await db().transaction(async (tx) => {
    await insertAll(tx, walletEntriesTable, wallet);
    await insertAll(tx, attendanceTable, attendance);
    await insertAll(tx, lectureVotesTable, votes);
  });
  console.log(`  wallet entries: ${wallet.length}, attendance: ${attendance.length}, ratings: ${votes.length}`);
  await db().transaction(async (tx) => {
    await insertAll(tx, assignmentsTable, assignments, 200);
    await insertAll(tx, submissionsTable, openSubmissions);
    await insertAll(tx, lectureMessagesTable, messages);
  });
  console.log(`  homework: ${assignments.length}, submissions: ${openSubmissions.length}, class messages: ${messages.length}`);

  // The bell, for the accounts that appear on camera -----------------------
  const firstTeacher = teachers[0]!;
  const ownLectures = lectures.filter((l) => l.teacher === firstTeacher && l.phase !== "cancelled").slice(-6);
  const bell: Array<typeof notificationsTable.$inferInsert> = [];
  ownLectures.forEach((l, i) => {
    bell.push({ userId: firstTeacher.id, kind: "booking", title: `حجز جديد: ${pick(students).name}`, body: l.row.title, link: `/lectures/${l.row.id}`, createdAt: ago((i + 1) * 3 * HOUR), readAt: i > 2 ? now : null });
  });
  const starLectures = bookings.filter((b) => b.studentId === star.id).map((b) => lectures.find((l) => l.row.id === b.lectureId)!).filter(Boolean);
  starLectures.slice(-6).forEach((l, i) => {
    bell.push({ userId: star.id, kind: l.phase === "live" ? "live" : "booking", title: l.phase === "live" ? "الحصة بدأت! 🔴" : "حجزك اتأكد", body: l.row.title, link: `/lectures/${l.row.id}`, createdAt: ago((i + 1) * 4 * HOUR), readAt: i > 1 ? now : null });
  });
  bell.push({ userId: parents[0]!.id, kind: "graded", title: `درجة جديدة لـ${star.name}`, body: "واجب: 18/20", link: `/p/children/${star.id}`, createdAt: ago(5 * HOUR) });
  bell.push({ userId: admin.id, kind: "payout", title: `طلب سحب جديد من ${firstTeacher.user.name}`, link: "/admin/payouts", createdAt: ago(2 * HOUR) });
  await db().insert(notificationsTable).values(bell);

  // Enough for the follow, save, support and review screens to have something to show.
  await db().insert(teacherFollowsTable).values(teachers.slice(0, 4).map((t) => ({ studentId: star.id, teacherId: t.id })));
  const starBooked = new Set(bookings.filter((b) => b.studentId === star.id).map((b) => b.lectureId));
  const worthSaving = lectures.filter((l) => l.phase === "future" && l.row.grade === "s3" && !starBooked.has(l.row.id)).slice(0, 4);
  await db().insert(savedLecturesTable).values(worthSaving.map((l) => ({ studentId: star.id, lectureId: l.row.id })));
  const tickets = [
    { user: star.id, category: "payment" as const, subject: "دفعت ولم يظهر الحجز", body: "دفعت بالمحفظة أمس ولم تظهر الحصة في حسابي.", reply: "راجعنا العملية وتأكد حجزك. تجده الآن في حصصك." },
    { user: firstTeacher.id, category: "account" as const, subject: "تعديل بيانات التحويل", body: "أريد تغيير رقم المحفظة التي تصلها أرباحي.", reply: null },
    { user: students[7]!.id, category: "technical" as const, subject: "الصوت يتقطع في البث", body: "الصوت كان يتقطع في حصة أمس على الموبايل.", reply: null },
  ];
  for (const t of tickets) {
    const id = randomUUID();
    await db().insert(supportTicketsTable).values({ id, userId: t.user, category: t.category, subject: t.subject, status: t.reply ? "answered" : "open", createdAt: ago(20 * HOUR), updatedAt: ago(3 * HOUR) });
    await db().insert(supportTicketMessagesTable).values({ ticketId: id, authorId: t.user, body: t.body, createdAt: ago(20 * HOUR) });
    if (t.reply) await db().insert(supportTicketMessagesTable).values({ ticketId: id, authorId: admin.id, fromAdmin: true, body: t.reply, createdAt: ago(3 * HOUR) });
  }
  const waiting = lectures.filter((l) => l.phase === "past" && !l.row.fundsReleasedAt && l.row.priceCents > 0);
  const reported = waiting.find((l) => bookings.some((b) => b.lectureId === l.row.id));
  if (reported) {
    const reporter = bookings.find((b) => b.lectureId === reported.row.id)!;
    await db().insert(lectureReportsTable).values({ lectureId: reported.row.id, studentId: reporter.studentId, reason: "technical", details: "الصوت كان يتقطع في آخر نصف ساعة." });
    await db().update(lecturesTable).set({ fundsReviewReason: "reported" }).where(eq(lecturesTable.id, reported.row.id));
  }

  console.log(`  seeded in ${Math.round((Date.now() - started) / 1000)}s`);
  return [
    { id: admin.id, role: "الإدارة", name: admin.name, email: admin.email, note: "" },
    ...teachers.slice(0, 10).map((t) => ({ id: t.id, role: "مدرس", name: t.user.name, email: t.user.email, note: `${subjectLabel(t.subject)} · ${t.grades.map(gradeLabel).join("، ")}` })),
    { id: star.id, role: "طالب", name: star.name, email: star.email, note: gradeLabel(star.grade) },
    { id: parents[0]!.id, role: "ولي أمر", name: parents[0]!.name, email: parents[0]!.email, note: `${star.name}، ${students[1]!.name}` },
  ];
}

const db = () => database.db;

// ---------------------------------------------------------------- serving

const SUBJECT_KEYS = new Set<string>(SUBJECTS.map((s) => s.key));
const GRADE_KEYS = new Set<string>(GRADES.map((g) => g.key));
if (![...OTHER_SUBJECTS].every((s) => SUBJECT_KEYS.has(s)) || !GRADE_KEYS.has("s3")) throw new Error("Subject or grade keys drifted from live-core");

await initDb({ migrationsFolder: path.resolve(here, "../../../lib/db/drizzle"), pgliteDir: path.join(DATA_DIR, "pglite") });
if (!existsSync(ACCOUNTS_FILE)) {
  console.log("Seeding the marketing demo…");
  writeFileSync(ACCOUNTS_FILE, JSON.stringify(await seedDemo(), null, 2));
}
const accounts = JSON.parse(readFileSync(ACCOUNTS_FILE, "utf8")) as DemoAccount[];

// Live classes show a viewer count, which normally comes from open connections.
const onAir = await db().select({ id: lecturesTable.id }).from(lecturesTable).where(eq(lecturesTable.status, "live"));
for (const lecture of onAir) {
  const seen = await db().select({ id: attendanceTable.studentId }).from(attendanceTable).where(eq(attendanceTable.lectureId, lecture.id));
  for (const viewer of seen) subscribe(lecture.id, { res: { writeHead() {}, write() {}, on() {} } as never, userId: viewer.id, role: "student" });
}

const esc = (value: string) => value.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const server = express();
server.use("/demo-media", express.static(PORTRAITS, { maxAge: "1d" }));
// Hide the pilot's setup banners on camera: this copy has no streaming service attached.
server.get("/api/config", (_req, res) => {
  res.json({ paymentProvider: "mock", liveConfigured: true, paymentConfigured: true, recordingConfigured: true, liveParticipantLimit: null, liveRoomLimit: null, feeBps: FEE_BPS, appUrl: ORIGIN });
});
server.get("/__demo", (_req, res) => {
  const rows = accounts.map((a) => `<a href="/__demo/as/${a.id}"><b>${esc(a.name)}</b><span>${esc(a.role)}${a.note ? ` · ${esc(a.note)}` : ""}</span></a>`).join("");
  res.type("html").send(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>نسخة العرض التجريبية</title><style>body{font-family:system-ui;background:#f7f7f4;margin:0;padding:32px 16px;color:#12141b}main{max-width:560px;margin:auto}h1{font-size:1.4rem;margin:0 0 6px}p{color:#555;margin:0 0 20px;line-height:1.7}a{display:block;background:#fff;border:1px solid #ddd;border-radius:12px;padding:12px 16px;margin-bottom:8px;color:inherit;text-decoration:none}a:hover{border-color:#e11d48}b,span{display:block}span{color:#666;font-size:.85rem;margin-top:2px}</style><main><h1>نسخة العرض التجريبية</h1><p>بيانات توضيحية على هذا الجهاز فقط، منفصلة عن الموقع الحقيقي. اختر الحساب:</p>${rows}</main></html>`);
});
server.get("/__demo/as/:id", async (req, res) => {
  const account = accounts.find((a) => a.id === req.params.id);
  if (!account) return void res.status(404).send("not found");
  const token = await createSession(account.id, "marketing-demo");
  res.type("html").send(`<!doctype html><script>localStorage.setItem("gl.token",${JSON.stringify(token)});sessionStorage.removeItem("gl.switch-token");location.replace("/");</script>`);
});
server.use(app);
server.listen(PORT, "127.0.0.1", () => {
  console.log(`\nMarketing demo ready: ${ORIGIN}/__demo`);
  console.log(`Password for every demo account (students and parents; teachers use the picker): ${PASSWORD}`);
});
