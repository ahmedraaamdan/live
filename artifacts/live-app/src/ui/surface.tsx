import type { HTMLAttributes, ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { ChevronLeft } from 'lucide-react';
import { Link } from 'wouter';
import { cn } from '@/lib/cn';

/**
 * Cards (M3): `elevated` rests on the page with a soft shadow, `filled` sits
 * on a tonal surface, `outlined` for dense lists. Interactive cards get
 * the state layer and press feedback.
 */
const cardVariants = cva('rounded-lg text-on-surface', {
  variants: {
    variant: {
      elevated: 'bg-surface-container-lowest shadow-e1',
      filled: 'bg-surface-container',
      outlined: 'border border-outline-variant bg-surface-container-lowest',
      ink: 'bg-gradient-ink text-white',
    },
    pad: { none: '', sm: 'p-4', md: 'p-5', lg: 'p-6' },
    interactive: { true: 'state-layer press block cursor-pointer transition-shadow duration-300 hover:shadow-e2' },
  },
  defaultVariants: { variant: 'elevated', pad: 'md' },
});

export interface CardProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {}

export function Card({ className, variant, pad, interactive, ...props }: CardProps) {
  return <div className={cn(cardVariants({ variant, pad, interactive }), className)} {...props} />;
}

/** A card that navigates. */
export function LinkCard({ href, className, variant, pad, children }: { href: string; className?: string; children: ReactNode } & VariantProps<typeof cardVariants>) {
  return (
    <Link href={href} className={cn(cardVariants({ variant, pad, interactive: true }), className)}>
      {children}
    </Link>
  );
}

/** Section heading with an optional trailing action ("عرض الكل"). */
export function SectionHeader({ title, action, className }: { title: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-3 flex items-center justify-between gap-4', className)}>
      <h2 className="text-title-lg">{title}</h2>
      {action}
    </div>
  );
}

export function SectionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="state-layer inline-flex h-9 items-center gap-1 rounded-full px-3 text-label-lg text-secondary">
      {children}
      <ChevronLeft className="size-4" aria-hidden="true" />
    </Link>
  );
}

/** M3 list item: leading visual, one–three lines of text, trailing meta. */
export function ListItem({
  leading,
  title,
  subtitle,
  trailing,
  href,
  onClick,
  className,
  chevron,
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
  chevron?: boolean;
}) {
  const body = (
    <>
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <div className="truncate text-title-md">{title}</div>
        {subtitle && <div className="truncate text-body-md text-on-surface-variant">{subtitle}</div>}
      </div>
      {trailing && <div className="shrink-0 text-start text-body-md text-on-surface-variant">{trailing}</div>}
      {chevron && <ChevronLeft className="size-5 shrink-0 text-on-surface-variant" aria-hidden="true" />}
    </>
  );
  const cls = cn('flex min-h-16 w-full items-center gap-4 px-4 py-3 text-start', (href || onClick) && 'state-layer cursor-pointer', className);
  if (href)
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls}>
        {body}
      </button>
    );
  return <div className={cls}>{body}</div>;
}

export function List({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('divide-y divide-outline-variant overflow-hidden rounded-lg bg-surface-container-lowest shadow-e1', className)}>{children}</div>;
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn('border-0 border-t border-outline-variant', className)} />;
}

/** A metric: the value is the hero, the label supports it. */
export function Stat({
  label,
  value,
  icon,
  tone = 'neutral',
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: 'neutral' | 'primary' | 'secondary' | 'tertiary' | 'success';
  hint?: ReactNode;
  className?: string;
}) {
  const iconCls = {
    neutral: 'bg-surface-container-high text-on-surface-variant',
    primary: 'bg-primary-container text-on-primary-container',
    secondary: 'bg-secondary-container text-on-secondary-container',
    tertiary: 'bg-tertiary-container text-on-tertiary-container',
    success: 'bg-success-container text-on-success-container',
  }[tone];
  return (
    <Card className={cn('flex flex-col gap-3', className)} pad="sm">
      {icon && <div className={cn('grid size-10 place-items-center rounded-md [&_svg]:size-5', iconCls)}>{icon}</div>}
      <div>
        <div className="font-num text-headline-md">{value}</div>
        <div className="text-body-md text-on-surface-variant">{label}</div>
        {hint && <div className="mt-1 text-body-sm text-on-surface-variant">{hint}</div>}
      </div>
    </Card>
  );
}

/** Two-up/three-up responsive grid used for stats. */
export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4', className)}>{children}</div>;
}
