import { type FormEvent, useState } from "react";
import { ArrowLeft, Check, MessageCircle } from "lucide-react";
import { Link } from "wouter";
import { Reveal } from "./studio-motion";
import { routes } from "@/lib/routes";

type Status = "idle" | "sending" | "sent" | "failed" | "busy" | "invalid";
const errors = {
  failed: "تعذّر إرسال الرسالة الآن. حاول مجددًا أو استخدم صفحة التواصل.",
  busy: "أرسلت عدة رسائل خلال فترة قصيرة. يرجى المحاولة لاحقًا.",
  invalid: "راجع الاسم والبريد الإلكتروني، ثم أرسل الطلب مجددًا.",
};

export function InquirySection() {
  const [status, setStatus] = useState<Status>("idle");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const value = (key: string) => String(fields.get(key) ?? "").trim();
    const role = value("role");
    setStatus("sending");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: value("name"),
          email: value("email"),
          phone: value("phone"),
          subject: `استفسار قبل التسجيل — ${role}`,
          message:
            value("message") ||
            `أرغب في معرفة كيف أبدأ على جاهز Live بصفتي ${role}.`,
          _gotcha: value("company"),
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (response.status === 422) {
        setStatus("invalid");
        return;
      }
      if (response.status === 429) {
        setStatus("busy");
        return;
      }
      const body = await response.json().catch(() => null);
      setStatus(response.ok && body?.success ? "sent" : "failed");
    } catch {
      setStatus("failed");
    }
  };
  return (
    <section className="inquiry-section studio-section" id="start">
      <div className="container-wide inquiry-grid">
        <Reveal className="inquiry-intro">
          <span className="studio-kicker">نرتّب البداية معًا</span>
          <h2>
            لديك سؤال؟
            <br />
            <span>تحدّث معنا.</span>
          </h2>
          <p>
            هل تختار حصتك الأولى، أم تفكر في تقديم دروسك؟ أخبرنا بما تحتاجه،
            وسنرد عليك عبر البريد الإلكتروني.
          </p>
          <ol>
            {[
              ["أخبرنا عنك", "اختر صفتك واترك وسيلة للتواصل."],
              [
                "اكتب ما تحتاجه",
                "سؤال عن الحصص، أو التدريس، أو استخدام المنصة.",
              ],
              [
                "نرد على استفسارك",
                "يراجع فريقنا رسالتك ويساعدك في خطوتك التالية.",
              ],
            ].map(([title, copy], index) => (
              <li key={title}>
                <b>{index + 1}</b>
                <div>
                  <strong>{title}</strong>
                  <span>{copy}</span>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>
        <Reveal className="inquiry-paper">
          {status === "sent" ? (
            <div className="inquiry-success" role="status">
              <Check size={42} />
              <h3>وصلتنا رسالتك.</h3>
              <p>شكرًا لتواصلك. سنراجع استفسارك ونرد على بريدك الإلكتروني.</p>
              <button
                className="button-secondary"
                onClick={() => setStatus("idle")}
              >
                إرسال استفسار آخر
              </button>
            </div>
          ) : (
            <form
              onSubmit={submit}
              className="inquiry-form"
              data-testid="form-home-inquiry"
            >
              <span className="inquiry-form-icon">
                <MessageCircle size={24} />
              </span>
              <h3>ما الذي تريد معرفته؟</h3>
              <p>هذا النموذج للاستفسار قبل التسجيل.</p>
              <div className="inquiry-fields">
                <label>
                  الاسم
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={120}
                    autoComplete="name"
                    placeholder="اسمك الكامل"
                  />
                </label>
                <label>
                  أنت هنا بصفتك
                  <select name="role" defaultValue="طالب">
                    <option>طالب</option>
                    <option>مدرس</option>
                    <option>ولي أمر</option>
                  </select>
                </label>
              </div>
              <label>
                البريد الإلكتروني
                <input
                  name="email"
                  required
                  type="email"
                  maxLength={200}
                  autoComplete="email"
                  placeholder="you@example.com"
                  dir="ltr"
                />
              </label>
              <label>
                رقم الهاتف <small>(اختياري)</small>
                <input
                  name="phone"
                  type="tel"
                  maxLength={40}
                  autoComplete="tel"
                  dir="ltr"
                  placeholder="رقم للتواصل"
                />
              </label>
              <label>
                كيف يمكننا مساعدتك؟ <small>(اختياري)</small>
                <textarea
                  name="message"
                  rows={3}
                  maxLength={5000}
                  placeholder="اكتب سؤالك هنا…"
                />
              </label>
              <input
                className="waitlist-trap"
                name="company"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
              />
              {status in errors && (
                <p className="inquiry-error" role="alert">
                  {errors[status as keyof typeof errors]}{" "}
                  <Link href={routes.contact.path}>تواصل معنا</Link>
                </p>
              )}
              <button
                className="button-primary inquiry-submit"
                type="submit"
                disabled={status === "sending"}
              >
                {status === "sending" ? "جارٍ الإرسال…" : "أرسل استفسارك"}
                <ArrowLeft size={22} />
              </button>
              <small className="inquiry-privacy">
                سنستخدم بياناتك للرد على استفسارك.{" "}
                <Link href={routes.privacy.path}>سياسة الخصوصية</Link>
              </small>
            </form>
          )}
        </Reveal>
      </div>
    </section>
  );
}
