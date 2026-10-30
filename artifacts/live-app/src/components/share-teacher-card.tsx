import { useEffect, useState } from 'react';
import { Copy, Download, Share2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { TeacherProfileDTO } from '@workspace/live-core';
import { api, errorMessage } from '@/lib/api';
import { useCapabilities } from '@/lib/capabilities';
import { renderTeacherShareCard, teacherProfileUrl } from '@/lib/teacher-share-card';
import { Banner, Button, Sheet, TextField, toast } from '@/ui';
export function ShareTeacherCard({ teacherId, open, onOpenChange }: { teacherId: string; open: boolean; onOpenChange: (value: boolean) => void }) {
  const capabilities = useCapabilities();
  const q = useQuery({ queryKey: ['teacher-profile', teacherId], queryFn: () => api<TeacherProfileDTO>(`/teachers/${teacherId}`), enabled: open, staleTime: 0 });
  const url = teacherProfileUrl(teacherId, capabilities.data?.appUrl);
  const [card, setCard] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!open || !q.data || q.isFetching) return;
    let cancelled = false, objectUrl: string | undefined;
    setGenerating(true); setError(''); setCard(null);
    renderTeacherShareCard(q.data, url).then(blob => { if (!cancelled) { objectUrl = URL.createObjectURL(blob); setCard({ blob, url: objectUrl }); } }).catch(e => { if (!cancelled) setError(errorMessage(e)); }).finally(() => { if (!cancelled) setGenerating(false); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [open, q.data, q.isFetching, url, attempt]);
  const download = () => { if (!card) return; const a = document.createElement('a'); a.href = card.url; a.download = 'gahez-teacher-story.png'; a.click(); };
  const share = async () => {
    if (!card) return;
    const file = new File([card.blob], 'gahez-teacher-story.png', { type: 'image/png' });
    if (!navigator.canShare?.({ files: [file] })) return download();
    try { await navigator.share({ files: [file], title: q.data?.teacher.name, text: `ملفي وحصصي على جاهز Live: ${url}` }); } catch (e) { if (!(e instanceof Error && e.name === 'AbortError')) toast(errorMessage(e)); }
  };
  return <Sheet open={open} onOpenChange={onOpenChange} title="كارتك. وخطوتهم الأولى." description="ستوري بمقاس 1080 × 1920. الرمز يفتح ملف المدرس، والتقييم يعكس وقت إنشاء الصورة." footer={<><Button disabled={!card || generating || q.isFetching} variant="tonal" onClick={download}><Download /> تنزيل الصورة</Button><Button disabled={!card || generating || q.isFetching} onClick={() => void share()}><Share2 /> مشاركة الصورة</Button></>}>
    <div className="teacher-share-preview">{q.isFetching || generating ? <div className="skeleton teacher-share-placeholder" role="status" aria-label="جارٍ تجهيز الكارت" /> : card && <img src={card.url} alt={`كارت مشاركة ${q.data?.teacher.name} مع التقييم ورمز QR`} />}</div>
    {(error || q.isError) && <Banner tone="error">{error || errorMessage(q.error)} <Button variant="text" onClick={() => { setAttempt(n => n + 1); void q.refetch(); }}>إعادة المحاولة</Button></Banner>}
    <div className="mt-4 flex items-end gap-2"><TextField label="رابط الملف العام" containerClassName="min-w-0 flex-1" value={url} readOnly ltr /><Button variant="tonal" aria-label="نسخ رابط ملف المدرس" onClick={async () => { try { await navigator.clipboard.writeText(url); toast('نُسخ رابط الملف'); } catch { toast('يمكنك تحديد الرابط ونسخه من الحقل'); } }}><Copy /></Button></div>
  </Sheet>;
}
