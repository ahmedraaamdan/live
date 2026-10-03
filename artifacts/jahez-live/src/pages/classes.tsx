import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Header } from '@/components/marketing/header';
import { Footer } from '@/components/marketing/footer';
import { SectionHeader } from '@/components/marketing/section-header';
import { ClassCard } from '@/components/marketing/class-card';
import { EmptyState } from '@/components/marketing/empty-state';
import { SeoContentSection } from '@/components/marketing/seo-content-section';
import { useSeo } from '@/hooks/use-seo';
import { routes } from '@/lib/routes';
import { breadcrumbJsonLd } from '@/lib/structured-data';
import { classes, subjects } from '@/data/classes';
import type { ClassItem } from '@/data/classes';
import { openWaitlist } from '@/lib/waitlist';

const grades = ['كل المراحل', ...Array.from(new Set(classes.map((c) => c.grade)))];

function useToast() {
  const [toast, setToast] = useState('');
  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2700);
  };
  return { toast, notify };
}

function ClassRow({
  title,
  items,
  followed,
  onFollow,
  onAction,
  emptyLabel,
}: {
  title: string;
  items: ClassItem[];
  followed: Set<string>;
  onFollow: (id: string, name: string) => void;
  onAction: (item: ClassItem) => void;
  emptyLabel: string;
}) {
  if (!items.length) return null;
  return (
    <div className="class-row">
      <h3 className="class-row-title">{title}</h3>
      <div className="class-grid">
        {items.map((item) => (
          <ClassCard
            key={`${title}-${item.id}`}
            item={item}
            followed={followed.has(item.teacherId)}
            onFollow={() => onFollow(item.teacherId, item.teacher)}
            onAction={() => onAction(item)}
          />
        ))}
      </div>
      {items.length === 0 && <EmptyState copy={emptyLabel} />}
    </div>
  );
}

export default function Classes() {
  useSeo({
    title: routes.classes.title,
    description: routes.classes.description,
    path: routes.classes.path,
    jsonLd: breadcrumbJsonLd([{ label: 'الرئيسية', path: '/' }, { label: 'الحصص' }]),
  });

  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState('الكل');
  const [grade, setGrade] = useState('كل المراحل');
  const [followedTeachers, setFollowedTeachers] = useState<Set<string>>(new Set());
  const { toast, notify } = useToast();

  const filtered = useMemo(
    () =>
      classes.filter((item) => {
        const matchesSubject = subject === 'الكل' || item.subject === subject;
        const matchesGrade = grade === 'كل المراحل' || item.grade === grade;
        const matchesQuery = `${item.title} ${item.teacher} ${item.subject}`.includes(query.trim());
        return matchesSubject && matchesGrade && matchesQuery;
      }),
    [query, subject, grade],
  );

  const liveNow = filtered.filter((c) => c.status === 'live');
  const upcoming = filtered.filter((c) => c.status === 'upcoming');
  const topRated = [...filtered].sort((a, b) => Number(b.rating) - Number(a.rating)).slice(0, 3);
  const mostViewed = [...filtered.filter((c) => c.viewers)].sort((a, b) => Number(b.viewers) - Number(a.viewers)).slice(0, 3);

  const toggleFollow = (id: string, name: string) =>
    setFollowedTeachers((current) => {
      const next = new Set(current);
      if (next.has(id)) { next.delete(id); notify(`ألغيت متابعة ${name}`); } else { next.add(id); notify(`ستصلك حصص ${name} الجديدة`); }
      return next;
    });

  // Until registration opens with the launch, booking means joining the waiting list.
  const handleAction = (_item: ClassItem) => openWaitlist('student');

  return (
    <div className="app-shell" dir="rtl">
      <Header />
      <main>
        <section className="classes-hero">
          <div className="container-wide">
            <p className="section-kicker fade-up">تصفح الحصص</p>
            <h1 className="classes-hero-title fade-up">الحصص الأونلاين</h1>
            <p className="classes-hero-copy fade-up delay-1">دور على المادة اللي محتاجها، اختار المدرس، وشوف الميعاد والسعر قبل ما تحجز.</p>
          </div>
        </section>

        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container-wide">
            <div className="discovery-bar">
              <div className="search-box">
                <Search size={18} />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ابحث عن مادة، معلم، أو فكرة..."
                  aria-label="ابحث عن حصة"
                  data-testid="input-search-classes"
                />
              </div>
              <select className="filter-select" value={grade} onChange={(e) => setGrade(e.target.value)} aria-label="فلترة حسب الصف الدراسي" data-testid="select-grade-filter">
                {grades.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="filter-row" aria-label="تصفية حسب المادة">
              {subjects.map((item) => (
                <button key={item} className={`filter-pill ${subject === item ? 'active' : ''}`} onClick={() => setSubject(item)} data-testid={`filter-subject-${item}`}>
                  {item}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                mascot
                title="مفيش حصص مطابقة دلوقتي."
                copy="جرّب تغيّر البحث أو الفلاتر."
                action={<button className="button-secondary" onClick={() => { setQuery(''); setSubject('الكل'); setGrade('كل المراحل'); }} data-testid="button-clear-filters">إظهار كل الحصص</button>}
              />
            ) : (
              <div className="class-rows">
                <ClassRow title="شغالة دلوقتي" items={liveNow} followed={followedTeachers} onFollow={toggleFollow} onAction={handleAction} emptyLabel="مفيش حصص مباشرة دلوقتي بالفلتر ده." />
                <ClassRow title="الحصص الجاية" items={upcoming} followed={followedTeachers} onFollow={toggleFollow} onAction={handleAction} emptyLabel="مفيش حصص قادمة بالفلتر ده." />
                <ClassRow title="الأعلى تقييماً" items={topRated} followed={followedTeachers} onFollow={toggleFollow} onAction={handleAction} emptyLabel="" />
                <ClassRow title="الأكثر مشاهدة" items={mostViewed} followed={followedTeachers} onFollow={toggleFollow} onAction={handleAction} emptyLabel="" />
              </div>
            )}
          </div>
        </section>

        <SeoContentSection
          blocks={[
            {
              heading: 'إيه هي الحصص الأونلاين؟',
              paragraphs: [
                'الحصص الأونلاين على جاهز Live هي حصص تعليمية مباشرة (لايف) بيقدمها مدرسين حقيقيين، بتتفرج عليها من موبايلك أو الكمبيوتر في نفس ميعادها. مش فيديو مسجل بتشغّله وقت ما تحب — المدرس فعليًا بيشرح دلوقتي، وتقدر تسأله وتتفاعل معاه.',
              ],
            },
            {
              heading: 'إزاي تختار المدرس المناسب؟',
              paragraphs: [
                'قبل ما تحجز، شوف تقييم المدرس وعدد الطلاب اللي قيّموه، وعدد الحصص اللي عملها قبل كده. المدرسين الموثّقين عليهم علامة توثيق واضحة على البروفايل.',
              ],
            },
            {
              heading: 'إيه الفرق بين الحصة المباشرة والـ Premiere؟',
              paragraphs: [
                '"مباشر الآن" يعني الحصة شغالة فعلاً دلوقتي وتقدر تدخلها على طول. "Premiere" يعني المدرس أعلن عن الحصة قبل ميعادها بأيام عشان تحجز مقعدك بدري وتستنى الميعاد.',
              ],
            },
          ]}
        />
      </main>
      <Footer />
      {toast && <div className="toast" role="status" data-testid="status-toast">{toast}</div>}
    </div>
  );
}
