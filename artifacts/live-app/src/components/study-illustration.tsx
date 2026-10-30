import { Atom, BookOpen, FlaskConical, Pi, Sparkles } from 'lucide-react';

/** Decorative subject sketches; no invented teacher identities or lecture data. */
export function StudyWallpaper() {
  return <div className="app-study-wallpaper" aria-hidden="true"><Atom /><Pi /><FlaskConical /><BookOpen /></div>;
}
export function StudyIllustration() {
  return <div className="app-study-illustration" aria-hidden="true"><span className="app-sketch-orbit" /><Atom className="app-sketch-atom" strokeWidth={1.3} /><span className="app-sketch-note">ƒ(x)</span><BookOpen className="app-sketch-book" strokeWidth={1.4} /><Sparkles className="app-sketch-spark" strokeWidth={1.5} /></div>;
}
export function StudyBanner({ title, body }: { title: string; body: string }) {
  return <section className="app-study-banner"><div><span>جاهز Live</span><h2>{title}</h2><p>{body}</p></div><StudyIllustration /></section>;
}
