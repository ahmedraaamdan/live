/** Small shared pieces: countdown, celebration, the share sheet. */
import { useEffect, useMemo, useState } from 'react';
import { Copy, MessageCircle, Share2 } from 'lucide-react';
import { fmtClock } from '@/lib/format';
import { publicUrl, shareLink, whatsappUrl } from '@/lib/platform';
import { Button, Sheet, toast } from '@/ui';

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** Big countdown to a start time: days or hh:mm:ss. */
export function Countdown({ to, className }: { to: string; className?: string }) {
  const now = useNow();
  const secs = Math.max(0, Math.floor((new Date(to).getTime() - now) / 1000));
  const days = Math.floor(secs / 86_400);
  return (
    <span className={className}>
      {days >= 1 ? (
        <>
          <span className="font-num">{days}</span> {days === 1 ? 'يوم' : days === 2 ? 'يومين' : 'أيام'}
        </>
      ) : (
        <span className="font-num" dir="ltr">
          {fmtClock(secs)}
        </span>
      )}
    </span>
  );
}

/**
 * The peak moment (booking confirmed, first live): a short burst of
 * confetti in the brand colours. Pure CSS, respects reduced motion.
 */
export function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 1.8 + Math.random() * 1.4,
        color: ['var(--ref-rose-500)', 'var(--ref-blue-600)', 'var(--ref-cyan-400)', 'var(--ref-amber-300)'][i % 4],
        size: 6 + Math.random() * 6,
        round: i % 3 === 0,
      })),
    [],
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-[90] overflow-hidden" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 block"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * (p.round ? 1 : 0.45),
            background: p.color,
            borderRadius: p.round ? '50%' : 2,
            animation: `confetti-fall ${p.duration}s ${p.delay}s var(--motion-standard) forwards`,
          }}
        />
      ))}
    </div>
  );
}

/** Teacher shares a lecture's booking link: WhatsApp first (that's where classes live), then copy / system share. */
export function ShareLectureSheet({ open, onOpenChange, code, title }: { open: boolean; onOpenChange: (v: boolean) => void; code: string; title: string }) {
  const url = publicUrl(`/l/${code}`);
  const text = `احجز مكانك في حصة "${title}" على Gahez Live 👇\n${url}`;
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="مشاركة رابط الحجز" description="شارك الرابط ليطّلع الطلاب على تفاصيل الحصة ويكملوا الحجز.">
      <div className="mb-5 flex items-center gap-3 rounded-md bg-surface-container-high p-3">
        <code className="min-w-0 flex-1 truncate font-num text-body-md" dir="ltr">
          {url}
        </code>
        <Button
          size="sm"
          variant="tonal"
          onClick={async () => {
            await navigator.clipboard?.writeText(url);
            toast('اتنسخ اللينك');
          }}
        >
          <Copy /> نسخ
        </Button>
      </div>
      <div className="mb-5 text-center">
        <p className="text-body-md text-on-surface-variant">أو قول للطلاب الكود ده</p>
        <p className="mt-1 font-num text-display-sm tracking-[0.3em]" dir="ltr">
          {code}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <Button size="lg" block onClick={() => window.open(whatsappUrl(text), '_blank')}>
          <MessageCircle /> مشاركة عبر واتساب
        </Button>
        <Button
          size="lg"
          variant="outlined"
          block
          onClick={async () => {
            const r = await shareLink({ title, text, url });
            if (r === 'copied') toast('اتنسخ اللينك');
          }}
        >
          <Share2 /> مشاركة
        </Button>
      </div>
    </Sheet>
  );
}
