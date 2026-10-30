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
import { openSignup } from '@/lib/signup';

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

  const toggleFollow = (id: string, name: string) =>
    setFollowedTeachers((current) => {
      const next = new Set(current);
      if (next.has(id)) { next.delete(id); notify(`ألغيت متابعة ${name}`); } else { next.add(id); notify(`ستصلك حصص ${name} الجديدة`); }
      return next;
    });

  // Until registration opens with the launch, booking means joining the waiting list.
  const handleAction = (_item: ClassItem) => openSignup('student');

  return (
    <div className="app-shell" dir="rtl">
      <Header />
      <main>
        <section className="classes-hero">
          <div className="container-wide">
            <p className="section-kicker fade-up">تصفح الحصص</p>
            <h1 className="classes-hero-title fade-up">الحصص المباشرة عبر الإنترنت</h1>
            <p className="classes-hero-copy fade-up delay-1">ابحث عن المادة التي تحتاجها، وقارن المدرسين والمواعيد والأسعار قبل الحجز.</p>
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
                  placeholder="ابحث عن مادة، مدرس، أو موضوع..."
                  aria-label="ابحث عن حصة"
                  data-testid="input-search-classes"
                />
              </div>
              <select className="filter-select" value={grade} onChange={(e) => setGrade(e.target.value)} aria-label="تصفية حسب الصف الدراسي" data-testid="select-grade-filter">
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
            <p className="studio-demo-note">نماذج توضيحية للحصص والمدرسين. التسجيل متاح قبل الإطلاق.</p>

            {filtered.length === 0 ? (
              <EmptyState
                mascot
                title="لا توجد حصص تطابق بحثك."
                copy="جرّب كلمات أخرى أو غيّر خيارات التصفية."
                action={<button className="button-secondary" onClick={() => { setQuery(''); setSubject('الكل'); setGrade('كل المراحل'); }} data-testid="button-clear-filters">إظهار كل الحصص</button>}
              />
            ) : (
              <div className="class-rows">
                <ClassRow title="مباشرة الآن" items={liveNow} followed={followedTeachers} onFollow={toggleFollow} onAction={handleAction} emptyLabel="لا توجد حصص مباشرة تطابق هذه الخيارات." />
                <ClassRow title="الحصص القادمة" items={upcoming} followed={followedTeachers} onFollow={toggleFollow} onAction={handleAction} emptyLabel="لا توجد حصص قادمة تطابق هذه الخيارات." />
              </div>
            )}
          </div>
        </section>

        <SeoContentSection
          blocks={[
            {
              heading: 'كيف تتعلم في حصة مباشرة؟',
              paragraphs: [
                'تجتمع مع المدرس في موعد محدد عبر هاتفك أو حاسوبك. تتابع الشرح، وتطرح أسئلتك أثناء الحصة، وتناقش ما تحتاج إلى توضيحه.',
              ],
            },
            {
              heading: 'كيف تختار مدرسك؟',
              paragraphs: [
                'ابدأ بتخصص المدرس وموضوع الحصة، ثم راجع تقييمات الطلاب والموعد والسعر. اختر ما يوافق احتياجك وجدولك.',
              ],
            },
            {
              heading: 'ما الفرق بين الحصص المباشرة والقادمة؟',
              paragraphs: [
                'الحصة المباشرة بدأت بالفعل، أما الحصة القادمة فلها موعد لاحق يمكنك الحجز له مسبقًا. راجع حالة الحصة وموعدها قبل الحجز.',
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
