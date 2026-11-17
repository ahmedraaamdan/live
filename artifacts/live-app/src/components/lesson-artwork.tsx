import { lectureCover } from '@/lib/lecture-cover';

export function LessonArtwork({ subject, label, coverUrl }: { subject: string; label: string; coverUrl?: string | null }) {
  return (
    <div className="lesson-artwork lesson-uploaded-cover">
      <img src={lectureCover(subject, coverUrl)} alt="" />
      <span className="lesson-uploaded-label">{label} · حصة مباشرة</span>
    </div>
  );
}
