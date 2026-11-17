import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import '@/styles/home-feature.css';

export function HomeFeature({ role, label, title, children }: {
  role: 'student' | 'teacher';
  label: ReactNode;
  title: string;
  children: ReactNode;
}) {
  const artwork = role === 'student' ? 'student-anywhere.webp' : 'teacher-studio.webp';
  return (
    <section className={`home-feature home-feature--${role}`} aria-label={role === 'student' ? 'مساحة التعلّم' : 'مساحة التدريس'}>
      <div className="home-feature-copy">
        <div className="home-feature-label">{label}</div>
        <h2 className="home-feature-title" dir="auto">{title}</h2>
        <div className="home-feature-details">{children}</div>
      </div>
      <div className="home-feature-art" aria-hidden="true">
        <Sparkles className="home-feature-spark" strokeWidth={1.5} />
        <img src={`${import.meta.env.BASE_URL}images/${artwork}`} width="1280" height="1280" alt="" fetchPriority="high" />
      </div>
    </section>
  );
}
