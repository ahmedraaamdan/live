import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookCopy, Save, Trash2 } from 'lucide-react';
import { homeworkTemplateInputSchema, type AssignmentInput, type HomeworkTemplateDTO, type HomeworkTemplateSummaryDTO } from '@workspace/live-core';
import { api, errorMessage } from '@/lib/api';
import { Banner, Button, Select, Sheet, toast } from '@/ui';
export function HomeworkTemplates({ draft, apply }: { draft: () => AssignmentInput; apply: (template: HomeworkTemplateDTO) => void }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState('');
  const [removeOpen, setRemoveOpen] = useState(false);
  const q = useQuery({ queryKey: ['homework-templates'], queryFn: () => api<HomeworkTemplateSummaryDTO[]>('/homework-templates') });
  const load = useMutation({ mutationFn: (id: string) => api<HomeworkTemplateDTO>(`/homework-templates/${id}`), onSuccess: template => { apply(template); setSelected(template.id); toast('استُخدم القالب. راجع موعد التسليم ثم انشر الواجب.'); }, onError: error => toast(errorMessage(error)) });
  const save = useMutation({ mutationFn: async (replace: boolean) => {
    const value = homeworkTemplateInputSchema.safeParse(draft());
    if (!value.success) throw new Error(value.error.issues[0]?.message ?? 'أكمل بيانات الواجب أولًا');
    return api<HomeworkTemplateDTO>(replace && selected ? `/homework-templates/${selected}` : '/homework-templates', { method: replace && selected ? 'PATCH' : 'POST', body: value.data });
  }, onSuccess: template => { setSelected(template.id); qc.invalidateQueries({ queryKey: ['homework-templates'] }); toast('حُفظ القالب في مكتبتك؛ لم يُنشر واجب جديد.'); }, onError: error => toast(errorMessage(error)) });
  const remove = useMutation({ mutationFn: () => api(`/homework-templates/${selected}`, { method: 'DELETE' }), onSuccess: () => { setSelected(''); setRemoveOpen(false); qc.invalidateQueries({ queryKey: ['homework-templates'] }); toast('حُذف القالب. الواجبات المنشورة محفوظة.'); }, onError: error => toast(errorMessage(error)) });
  const busy = load.isPending || save.isPending || remove.isPending;
  return <div className="homework-template-box">
    <div className="flex items-center gap-2 text-title-md"><BookCopy size={20} /><span>مكتبة قوالبك</span></div>
    <p className="text-body-sm text-on-surface-variant">جهّز الواجب مرة، واستخدمه في حصص أخرى. لا يُنسخ موعد التسليم.</p>
    {q.isError && <Banner tone="error">تعذر تحميل القوالب. <Button type="button" variant="text" onClick={() => void q.refetch()}>إعادة المحاولة</Button></Banner>}
    <Select label="ابدأ من قالب محفوظ" value={selected} disabled={busy || q.isPending} placeholder={q.isPending ? 'جارٍ التحميل…' : 'اختر قالبًا'} options={(q.data ?? []).map(t => ({ value: t.id, label: `${t.title} · ${t.questionCount ? `${t.questionCount} سؤال` : 'كتابي'}` }))} onChange={e => { if (e.target.value) load.mutate(e.target.value); else setSelected(''); }} />
    <div className="flex flex-wrap gap-2"><Button type="button" variant="tonal" size="sm" disabled={busy} onClick={() => save.mutate(false)}><Save /> حفظ كقالب جديد</Button>{selected && <><Button type="button" variant="text" size="sm" disabled={busy} onClick={() => save.mutate(true)}>تحديث القالب</Button><Button type="button" variant="danger-text" size="sm" disabled={busy} onClick={() => setRemoveOpen(true)}><Trash2 /> حذف</Button></>}</div>
    <Sheet open={removeOpen} onOpenChange={setRemoveOpen} title="حذف القالب؟" description="سيُحذف من مكتبتك. تبقى الواجبات التي نشرتها منه كما هي." footer={<><Button type="button" variant="tonal" onClick={() => setRemoveOpen(false)}>إلغاء</Button><Button type="button" variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>حذف القالب</Button></>}><span /></Sheet>
  </div>;
}
