import { useMemo, useState } from 'react';
import { Header } from '@/components/marketing/header';
import { Footer } from '@/components/marketing/footer';
import { TeacherDirectoryCard } from '@/components/marketing/teacher-card';
import { EmptyState } from '@/components/marketing/empty-state';
import { SeoContentSection } from '@/components/marketing/seo-content-section';
import { useSeo } from '@/hooks/use-seo';
import { routes } from '@/lib/routes';
import { breadcrumbJsonLd } from '@/lib/structured-data';
import { subjects, teachers } from '@/data/classes';

export default function Teachers() {
  useSeo({
    title: routes.teachers.title,
    description: routes.teachers.description,
    path: routes.teachers.path,
    jsonLd: breadcrumbJsonLd([{ label: 'الرئيسية', path: '/' }, { label: 'المدرسون' }]),
  });

  const [subject, setSubject] = useState('الكل');
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState('');

  const notify = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(''), 2700);
  };

  const filtered = useMemo(
    () => teachers.filter((t) => subject === 'الكل' || t.subject === subject),
    [subject],
  );

  const toggleFollow = (id: string, name: string) =>
    setFollowed((current) => {
      const next = new Set(current);
      if (next.has(id)) { next.delete(id); notify(`ألغيت متابعة ${name}`); } else { next.add(id); notify(`أصبحت تتابع ${name}`); }
      return next;
    });

  return (
    <div className="app-shell" dir="rtl">
      <Header />
      <main>
        <section className="classes-hero">
          <div className="container-wide">
            <p className="section-kicker fade-up">المدرسون</p>
            <h1 className="classes-hero-title fade-up">اختر المدرس المناسب لك.</h1>
            <p className="classes-hero-copy fade-up delay-1">تعرّف إلى تخصص كل مدرس وحصصه وتقييمات طلابه، ثم اختر من يناسب احتياجك.</p>
          </div>
        </section>

        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container-wide">
            <div className="filter-row" aria-label="تصفية حسب المادة">
              {subjects.map((item) => (
                <button key={item} className={`filter-pill ${subject === item ? 'active' : ''}`} onClick={() => setSubject(item)} data-testid={`filter-teacher-subject-${item}`}>
                  {item}
                </button>
              ))}
            </div>
            <p className="studio-demo-note">نماذج توضيحية لملفات المدرسين وتقييماتهم قبل الإطلاق.</p>
            {filtered.length === 0 ? (
              <EmptyState title="لا يوجد مدرسون لهذه المادة حاليًا." copy="اختر مادة أخرى لعرض المدرسين المتاحين." />
            ) : (
              <div className="teacher-directory-grid">
                {filtered.map((teacher) => (
                  <TeacherDirectoryCard key={teacher.id} teacher={teacher} followed={followed.has(teacher.id)} onFollow={() => toggleFollow(teacher.id, teacher.name)} />
                ))}
              </div>
            )}
          </div>
        </section>

        <SeoContentSection
          blocks={[
            {
              heading: 'كيف تقارن بين المدرسين؟',
              paragraphs: [
                'راجع تخصص كل مدرس والحصص التي يقدمها وتقييمات الطلاب. تساعدك هذه التفاصيل على المقارنة بين الخيارات في المادة نفسها.',
              ],
            },
            {
              heading: 'ماذا يعني توثيق حساب المدرس؟',
              paragraphs: [
                'تعني علامة التوثيق أن جاهز Live راجع بيانات الحساب. وهي لا تعني ضمان نتيجة دراسية محددة؛ اختر المدرس بناءً على تخصصه وحصصه ومدى مناسبتها لك.',
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
