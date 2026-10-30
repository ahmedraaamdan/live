import type { QuizQuestion } from '@workspace/live-core';
import { Button, Card, Select, TextArea, TextField } from '@/ui';

export const newQuestion = (): QuizQuestion => ({ id: crypto.randomUUID(), prompt: '', options: ['', '', '', ''], correctIndex: 0, points: 1 });

export function QuizEditor({ questions, onChange }: { questions: QuizQuestion[]; onChange: (questions: QuizQuestion[]) => void }) {
  const update = (id: string, patch: Partial<QuizQuestion>) => onChange(questions.map(q => q.id === id ? { ...q, ...patch } : q));
  return <div className="flex flex-col gap-4">
    <p className="text-body-md text-on-surface-variant">حدد السؤال والخيارات والإجابة الصحيحة. تُصحّح الإجابات على الخادم بعد التسليم، ولا يظهر مفتاح الإجابة للطلاب.</p>
    {questions.map((q, i) => <Card key={q.id} className="flex flex-col gap-3">
      <div className="flex items-center justify-between"><h3 className="text-title-lg">السؤال {i + 1}</h3><Button variant="danger-text" size="sm" disabled={questions.length === 1} onClick={() => onChange(questions.filter(x => x.id !== q.id))}>حذف السؤال</Button></div>
      <TextArea label={`نص السؤال ${i + 1}`} value={q.prompt} maxLength={1000} onChange={e => update(q.id, { prompt: e.target.value })} rows={2} />
      {q.options.map((option, n) => <TextField key={n} label={`الخيار ${n + 1} للسؤال ${i + 1}`} maxLength={400} value={option} onChange={e => update(q.id, { options: q.options.map((v, j) => j === n ? e.target.value : v) })} />)}
      <div className="grid grid-cols-2 gap-3"><Select label={`الإجابة الصحيحة للسؤال ${i + 1}`} value={String(q.correctIndex)} onChange={e => update(q.id, { correctIndex: Number(e.target.value) })} options={q.options.map((_, n) => ({ value: String(n), label: `الخيار ${n + 1}` }))} /><TextField label={`درجة السؤال ${i + 1}`} type="number" min={1} max={100} value={q.points} onChange={e => update(q.id, { points: Number(e.target.value) })} /></div>
    </Card>)}
    <Button variant="outlined" disabled={questions.length >= 30} onClick={() => onChange([...questions, newQuestion()])}>إضافة سؤال ({questions.length}/30)</Button>
  </div>;
}
