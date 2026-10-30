import { useEffect, useState, type HTMLAttributes, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('size-6 animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function PageSpinner() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 180);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div className="gl-page-loading" role="status" aria-label="جارٍ تحميل الصفحة">
      <div className="gl-loading-top" aria-hidden="true"><span /><i>{slow && <Spinner className="size-5" />}</i></div>
      <div className="gl-loading-content" aria-hidden="true"><div className="gl-loading-title" /><div className="gl-loading-subtitle" /><div className="gl-loading-card" /><div className="gl-loading-pair"><div /><div /></div></div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton h-4', className)} aria-hidden="true" />;
}

const badgeVariants = cva('gl-badge inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-label-md [&_svg]:size-3.5', {
  variants: {
    tone: {
      neutral: 'bg-surface-container-high text-on-surface-variant',
      primary: 'bg-primary-container text-on-primary-container',
      secondary: 'bg-secondary-container text-on-secondary-container',
      tertiary: 'bg-tertiary-container text-on-tertiary-container',
      success: 'bg-success-container text-on-success-container',
      warning: 'bg-warning-container text-on-warning-container',
      error: 'bg-error-container text-on-error-container',
      outline: 'border border-outline-variant text-on-surface-variant',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export function Badge({ tone, className, ...props }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

/** The "on air" marker. Pulses; one per card at most. */
export function LiveBadge({ className, label = 'مباشر' }: { className?: string; label?: string }) {
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-full bg-live px-2.5 text-label-md text-on-live', className)}>
      <span className="size-2 animate-live-pulse rounded-full bg-white" aria-hidden="true" />
      {label}
    </span>
  );
}

/** Small dot for unread counts on icons. */
export function CountDot({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        'absolute -top-1 -end-1 z-20 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 font-num text-[11px] font-bold leading-none text-white shadow-sm ring-2 ring-surface pointer-events-none select-none',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

const bannerTone = {
  info: { cls: 'bg-secondary-container text-on-secondary-container', Icon: Info },
  success: { cls: 'bg-success-container text-on-success-container', Icon: CheckCircle2 },
  warning: { cls: 'bg-warning-container text-on-warning-container', Icon: TriangleAlert },
  error: { cls: 'bg-error-container text-on-error-container', Icon: AlertCircle },
} as const;

/** Inline message inside a page (not a toast). Errors always carry an icon, never colour alone. */
export function Banner({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: keyof typeof bannerTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const { cls, Icon } = bannerTone[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('gl-banner flex gap-3 rounded-lg p-4', cls, className)}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="text-title-sm">{title}</p>}
        {children && <div className="text-body-md opacity-90">{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('gl-empty flex flex-col items-center px-6 py-12 text-center', className)}>
      <div className="mb-5 grid size-20 animate-float place-items-center rounded-2xl bg-primary-container text-on-primary-container [&_svg]:size-9">{icon}</div>
      <h3 className="text-title-lg">{title}</h3>
      {body && <p className="mt-2 max-w-sm text-body-md text-on-surface-variant">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ProgressBar({ value, tone = 'secondary', className, label }: { value: number; tone?: 'primary' | 'secondary' | 'tertiary' | 'success'; className?: string; label?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const fill = { primary: 'bg-primary', secondary: 'bg-secondary', tertiary: 'bg-tertiary', success: 'bg-success' }[tone];
  return (
    <div className={cn('h-2 overflow-hidden rounded-full bg-surface-container-highest', className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cn('h-full rounded-full transition-[width] duration-500 ease-decelerate', fill)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Circular progress with the value in the middle; for attendance and scores. */
export function ProgressRing({ value, size = 72, stroke = 7, tone = 'secondary', children }: { value: number | null; size?: number; stroke?: number; tone?: 'primary' | 'secondary' | 'tertiary' | 'success'; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = value == null ? 0 : Math.max(0, Math.min(1, value));
  const color = { primary: 'var(--primary)', secondary: 'var(--secondary)', tertiary: 'var(--tertiary)', success: 'var(--success)' }[tone];
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-container-highest)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: 'stroke-dashoffset 700ms var(--motion-emphasized-decelerate)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
