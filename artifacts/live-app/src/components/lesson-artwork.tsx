import { Atom, BookOpen, Code2, Dna, FlaskConical, Globe2, Languages, Pi } from 'lucide-react';

const visuals: Partial<Record<string, { icon: typeof Atom; formula: string }>> = {
  physics: { icon: Atom, formula: 'V = I × R' }, math: { icon: Pi, formula: 'ƒ(x) = x²' },
  chemistry: { icon: FlaskConical, formula: 'H₂O' }, biology: { icon: Dna, formula: 'DNA' },
  english: { icon: Languages, formula: 'Hello!' }, arabic: { icon: BookOpen, formula: 'أ ب ت' },
  computer: { icon: Code2, formula: '</>' }, geography: { icon: Globe2, formula: '30° N' },
};
/** Subject artwork, never a fabricated portrait attributed to a real teacher. */
export function LessonArtwork({ subject, label, coverUrl }: { subject: string; label: string; coverUrl?: string | null }) {
  if (coverUrl) return <div className="lesson-artwork lesson-uploaded-cover"><img src={coverUrl} alt={`غلاف حصة ${label}`} /><span className="lesson-uploaded-label">{label} · حصة مباشرة</span></div>;
  const visual = visuals[subject] ?? { icon: BookOpen, formula: 'تعلّم. اسأل. افهم.' };
  const Icon = visual.icon;
  return <div className="lesson-artwork" aria-hidden="true"><div className="lesson-art-label"><span /> تعلّمها على الهواء</div><div className="lesson-art-orbit"><Icon strokeWidth={1.1} /></div><span className="lesson-art-formula" dir="auto">{visual.formula}</span><span className="lesson-art-subject">{label}</span><span className="lesson-art-caption">نفهمها، خطوة بخطوة.</span><span className="lesson-art-stamp">LIVE<br/>CLASS</span></div>;
}
