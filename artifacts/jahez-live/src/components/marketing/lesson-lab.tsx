import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  MessageCircle,
  MousePointer2,
  Play,
} from "lucide-react";
import { TiltSurface } from "./studio-motion";

const lessons = [
  {
    subject: "رياضيات",
    label: "فهم الفكرة، قبل حفظ القاعدة.",
    title: "لماذا نربّع الضلع؟",
    expression: "A = a²",
    question: "لماذا نضرب طول الضلع في نفسه؟",
    answer: "لأن المساحة تحسب عدد الوحدات داخل المربع: صفوف × أعمدة.",
    result: "٤ صفوف × ٤ أعمدة = ١٦ وحدة مربعة",
    tag: "المساحة ببساطة",
  },
  {
    subject: "لغة عربية",
    label: "افهم موقع الكلمة في الجملة.",
    title: "من قام بالفعل؟",
    expression: "يقرأُ الطالبُ",
    question: "كيف أميّز الفاعل في هذه الجملة؟",
    answer: "اسأل: من الذي يقرأ؟ الإجابة هي الطالب، ولذلك فهو الفاعل.",
    result: "الطالبُ: فاعل مرفوع وعلامة رفعه الضمة",
    tag: "النحو خطوة بخطوة",
  },
  {
    subject: "لغة إنجليزية",
    label: "من القاعدة إلى الاستخدام.",
    title: "كيف نصف ما يحدث الآن؟",
    expression: "I am learning.",
    question: "متى أستخدم صيغة am + ing؟",
    answer: "استخدمها لوصف فعل يحدث الآن: أنا أتعلّم في هذه اللحظة.",
    result: "I am + learning → أنا أتعلّم الآن",
    tag: "الإنجليزية بالمثال",
  },
];

export function LessonLab() {
  const [active, setActive] = useState(0);
  const [answered, setAnswered] = useState(false);
  const reduce = useReducedMotion();
  const lesson = lessons[active];
  return (
    <div className="lesson-lab">
      <div className="lab-orbit lab-orbit-one" aria-hidden="true" />
      <div className="lab-orbit lab-orbit-two" aria-hidden="true" />
      <span className="lab-floating-label">
        <MessageCircle size={16} /> السؤال جزء من التعلّم.
      </span>
      <TiltSurface className="lab-surface">
        <div className="lab-header">
          <span>
            <i /> داخل الحصة
          </span>
          <small>تجربة تفاعلية توضيحية</small>
          <span className="lab-window-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </div>
        <div
          className="lab-tabs"
          role="tablist"
          aria-label="جرّب شرحًا في مادة مختلفة"
        >
          {lessons.map((item, index) => (
            <button
              key={item.subject}
              id={`lesson-tab-${index}`}
              role="tab"
              aria-selected={index === active}
              aria-controls="lesson-panel"
              tabIndex={index === active ? 0 : -1}
              onKeyDown={(event) => {
                if (
                  ["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)
                ) {
                  event.preventDefault();
                  const next =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? lessons.length - 1
                        : (active +
                            (event.key === "ArrowLeft" ? 1 : -1) +
                            lessons.length) %
                          lessons.length;
                  setActive(next);
                  setAnswered(false);
                  document.getElementById(`lesson-tab-${next}`)?.focus();
                }
              }}
              onClick={() => {
                setActive(index);
                setAnswered(false);
              }}
            >
              {item.subject}
            </button>
          ))}
        </div>
        <div
          id="lesson-panel"
          role="tabpanel"
          aria-labelledby={`lesson-tab-${active}`}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              <div className="lab-board">
                <span className="lab-board-caption">{lesson.label}</span>
                <h2>{lesson.title}</h2>
                <div
                  className={`lab-expression ${active === 1 ? "arabic-expression" : active === 2 ? "english-expression" : ""}`}
                  dir={active === 1 ? "rtl" : "ltr"}
                >
                  {lesson.expression}
                </div>
                {active === 0 ? (
                  <div
                    className={`lab-square ${answered ? "is-solved" : ""}`}
                    aria-label="مربع من ست عشرة وحدة"
                  >
                    {Array.from({ length: 16 }, (_, i) => (
                      <span
                        key={i}
                        style={{ "--cell-index": i } as React.CSSProperties}
                      />
                    ))}
                    <b className="lab-square-side">a</b>
                  </div>
                ) : (
                  <div className="lab-language-note">
                    <span>{active === 1 ? "فعل" : "subject"}</span>
                    <ArrowLeft size={18} />
                    <span>{active === 1 ? "فاعل" : "verb"}</span>
                    <Check size={20} />
                  </div>
                )}
                <span className="lab-board-tag">{lesson.tag}</span>
              </div>
              <div className="lab-question">
                <span className="lab-question-avatar">؟</span>
                <p>{lesson.question}</p>
              </div>
              <div className="lab-answer-area" aria-live="polite">
                {answered ? (
                  <motion.div
                    initial={reduce ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="lab-answer"
                  >
                    <span>
                      <Check size={16} /> لنتتبع الفكرة
                    </span>
                    <p>{lesson.answer}</p>
                    <small>{lesson.result}</small>
                  </motion.div>
                ) : (
                  <button
                    className="lab-explain"
                    onClick={() => setAnswered(true)}
                  >
                    <Play size={14} fill="currentColor" /> لنفهمها معًا{" "}
                    <ArrowLeft size={17} />
                  </button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="lab-footer">
          <span>
            <span className="lab-online-dot" /> شرح مباشر، مع مساحة للسؤال
          </span>
          <MousePointer2 size={15} />
        </div>
      </TiltSurface>
      <div className="lab-side-note">
        <ArrowLeft size={20} />
        <span>
          جرّب السؤال.
          <br />
          <b>هكذا تبدأ الفكرة.</b>
        </span>
      </div>
      <span className="lab-giant-a" aria-hidden="true">
        a²
      </span>
    </div>
  );
}
