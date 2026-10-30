import { useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, ExternalLink, GraduationCap, Heart, Share2, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { subjectLabel, type TeacherLecturesDTO, type TeacherProfileDTO } from '@workspace/live-core';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { LectureCard } from '@/components/lecture-card';
import { QueryError } from '@/components/query-error';
import { ShareTeacherCard } from '@/components/share-teacher-card';
import { detectPlatform, PlatformIcon } from '@/components/social-icons';
import { Avatar, Badge, Button, Card, EmptyState, Page, PageSpinner, Segmented, TopBar } from '@/ui';

export function TeacherProfile({ id }: { id: string }) {
  const { me } = useSession();
  const [period, setPeriod] = useState<'upcoming' | 'past'>('upcoming');
  const [share, setShare] = useState(false);
  const q = useQuery({
    queryKey: ['teacher-profile', id],
    queryFn: () => api<TeacherProfileDTO>(`/teachers/${id}`),
    refetchInterval: 30000,
  });
  const lectures = useInfiniteQuery({
    queryKey: ['teacher-public-lectures', id, period],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      api<TeacherLecturesDTO>(`/teachers/${id}/lectures?period=${period}&offset=${pageParam}`),
    getNextPageParam: page => page.nextOffset ?? undefined,
    enabled: Boolean(q.data),
  });

  useEffect(() => {
    if (!q.data) return;
    const old = document.title;
    document.title = `${q.data.teacher.name} | جاهز Live`;
    return () => {
      document.title = old;
    };
  }, [q.data?.teacher.name]);

  if (q.isPending) {
    return (
      <>
        <TopBar title="ملف المدرس" back />
        <Page>
          <PageSpinner />
        </Page>
      </>
    );
  }

  if (q.isError) {
    return (
      <>
        <TopBar title="ملف المدرس" back />
        <Page>
          <QueryError error={q.error} retry={q.refetch} />
        </Page>
      </>
    );
  }

  const { teacher: t, rating, stats } = q.data;
  const items = lectures.data?.pages.flatMap(page => page.items) ?? [];

  return (
    <>
      <TopBar
        title="ملف المدرس"
        back
        actions={
          <Button size="sm" variant="tonal" onClick={() => setShare(true)}>
            <Share2 /> مشاركة
          </Button>
        }
      />
      <Page className="teacher-profile-page">
        <section className="teacher-profile-hero">
          <div className="teacher-profile-decoration" aria-hidden="true">
            <BookOpen />
            <span>LIVE</span>
          </div>
          <div className="teacher-profile-identity">
            <Avatar name={t.name} src={t.avatarUrl} size="xl" />
            <div className="min-w-0 flex-1">
              <p className="profile-eyebrow">مدرسك. بطريقته.</p>
              <h1 dir="auto">{t.name}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2 mb-2">
                {t.verified && (
                  <Badge tone="success" className="gap-1.5 font-medium">
                    <CheckCircle2 size={14} /> حساب موثّق
                  </Badge>
                )}
                {t.subject && (
                  <Badge tone="primary" className="font-medium">
                    {subjectLabel(t.subject)}
                  </Badge>
                )}
              </div>
              <p className="teacher-profile-headline">{t.headline || 'تعرّف إلى المدرس، واختر حصتك التالية.'}</p>
            </div>
          </div>
          <div className="teacher-profile-numbers">
            <span>
              <strong>{stats.completedLessons}</strong>
              حصة مكتملة
            </span>
            <span>
              <strong>{stats.students}</strong>
              طالب حجز حصصه
            </span>
            <span>
              <strong>{rating.raters}</strong>
              طالب شارك بالتقييم
            </span>
          </div>
        </section>

        <section className="teacher-profile-rating" aria-label="تقييم المدرس">
          <div>
            <p className="profile-eyebrow">
              <Heart size={16} /> رأي الطلاب
            </p>
            <h2>
              {rating.positivePercent === null ? (
                'بانتظار أول تقييم.'
              ) : (
                <>
                  <span className="font-num">{rating.positivePercent}%</span> تقييم إيجابي.
                </>
              )}
            </h2>
            <p>
              {rating.total
                ? `${rating.total} تقييم من ${rating.raters} طالب. قد يقيّم الطالب أكثر من حصة.`
                : 'لا توجد تقييمات مسجّلة لهذا المدرس بعد.'}
            </p>
          </div>
          <div className="teacher-rating-counts">
            <div>
              <ThumbsUp />
              <strong>{rating.likes}</strong>
              <span>إعجاب</span>
            </div>
            <div>
              <ThumbsDown />
              <strong>{rating.dislikes}</strong>
              <span>عدم إعجاب</span>
            </div>
          </div>
          <div
            className="teacher-rating-track"
            role="img"
            aria-label={rating.positivePercent === null ? 'لا توجد تقييمات' : `${rating.positivePercent} بالمئة تقييمات إيجابية`}
          >
            <span style={{ width: `${rating.positivePercent ?? 0}%` }} />
          </div>
          <p className="teacher-rating-note">
            التقييم من داخل الحصة، بعد 3 دقائق من البث أو 5 دقائق من التسجيل، للطلاب الحاجزين فقط.
          </p>
        </section>

        <div className="teacher-profile-columns">
          <div className="teacher-profile-about">
            <Card>
              <h2>عن المدرس</h2>
              <p className="whitespace-pre-wrap">
                {t.bio || 'لم يضف المدرس نبذته بعد. يمكنك الاطّلاع على حصصه وتقييمات الطلاب.'}
              </p>
              {t.experience && (
                <>
                  <h3>الخبرة وطريقة الشرح</h3>
                  <p className="whitespace-pre-wrap">{t.experience}</p>
                </>
              )}
              {t.socialLinks.length > 0 && (
                <div className="teacher-profile-socials">
                  {t.socialLinks.map((link, i) => {
                    const platform = detectPlatform(link.label, link.url);
                    return (
                      <a
                        key={`${link.url}-${i}`}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="transition-colors hover:border-primary"
                      >
                        <PlatformIcon platform={platform} size={18} />
                        <span>{link.label}</span>
                      </a>
                    );
                  })}
                </div>
              )}
            </Card>

            {t.certificates.length > 0 && (
              <section className="teacher-certificates">
                <h2>
                  <GraduationCap /> المؤهلات والشهادات
                </h2>
                <p className="text-body-sm text-on-surface-variant">أضافها المدرس إلى ملفه.</p>
                <div>
                  {t.certificates.map((certificate, i) => (
                    <a key={`${certificate.url}-${i}`} href={certificate.url} target="_blank" rel="noopener noreferrer">
                      {certificate.kind === 'image' ? (
                        <img src={certificate.url} alt={certificate.label} loading="lazy" />
                      ) : (
                        <GraduationCap aria-hidden="true" />
                      )}
                      <span>
                        {certificate.label}
                        <ExternalLink size={16} />
                      </span>
                    </a>
                  ))}
                </div>
              </section>
            )}
          </div>

          <section className="teacher-profile-lessons">
            <h2>نلتقي في حصة.</h2>
            <Segmented
              value={period}
              onChange={setPeriod}
              options={[
                { value: 'upcoming', label: 'الحصص القادمة' },
                { value: 'past', label: 'الحصص السابقة' },
              ]}
            />
            {lectures.isPending && <div className="skeleton mt-4 h-48 rounded-xl" />}
            {lectures.isError && <QueryError error={lectures.error} retry={lectures.refetch} />}
            {!lectures.isPending && !lectures.isError && !items.length && (
              <EmptyState
                icon={<BookOpen />}
                title={period === 'upcoming' ? 'لا توجد حصص قادمة معلنة' : 'لا توجد حصص سابقة معلنة'}
                body="تظهر هنا الحصص التي أتاحها المدرس للعرض العام."
              />
            )}
            <div className="teacher-profile-lecture-list">
              {items.map(lecture => (
                <LectureCard
                  key={lecture.id}
                  lecture={lecture}
                  href={me ? `/lectures/${lecture.id}` : `/l/${lecture.code}`}
                />
              ))}
            </div>
            {lectures.hasNextPage && (
              <Button variant="tonal" block loading={lectures.isFetchingNextPage} onClick={() => void lectures.fetchNextPage()}>
                عرض حصص أكثر
              </Button>
            )}
          </section>
        </div>
      </Page>
      <ShareTeacherCard teacherId={id} open={share} onOpenChange={setShare} />
    </>
  );
}
