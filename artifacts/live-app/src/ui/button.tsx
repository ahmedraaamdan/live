import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';
import { Spinner } from './feedback';

/**
 * Buttons follow M3's emphasis ladder: one `filled` per screen for the main
 * action, `tonal` for important secondary ones, `outlined` for alternatives,
 * `text` for the least emphasis. `live` is reserved for going/joining live.
 */
export const buttonVariants = cva(
  'state-layer press inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-sans text-label-lg transition-[background-color,box-shadow,color] duration-150 ease-standard disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      variant: {
        filled: 'bg-primary text-on-primary shadow-glow',
        tonal: 'bg-secondary-container text-on-secondary-container',
        outlined: 'border border-outline-variant bg-transparent text-on-surface',
        text: 'bg-transparent text-secondary',
        neutral: 'bg-surface-container-high text-on-surface',
        inverse: 'bg-inverse-surface text-inverse-on-surface',
        live: 'bg-gradient-live text-on-live shadow-glow',
        danger: 'bg-error text-on-error',
        'danger-text': 'bg-transparent text-error',
      },
      size: {
        sm: 'h-9 px-4 text-label-md [&_svg]:size-4',
        md: 'h-11 px-6 [&_svg]:size-5',
        lg: 'h-14 px-8 text-title-md [&_svg]:size-5',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'filled', size: 'md' },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, loading, disabled, children, type = 'button', ...props },
  ref,
) {
  return (
    <button ref={ref} type={type} className={cn(buttonVariants({ variant, size, block }), className)} disabled={disabled || loading} {...props}>
      {loading ? <Spinner className="size-5" /> : children}
    </button>
  );
});

const iconButtonVariants = cva(
  'state-layer press inline-grid shrink-0 place-items-center rounded-full transition-colors duration-150 disabled:opacity-40 [&_svg]:size-6',
  {
    variants: {
      variant: {
        standard: 'text-on-surface-variant',
        filled: 'bg-primary text-on-primary',
        tonal: 'bg-surface-container-high text-on-surface',
        outlined: 'border border-outline-variant text-on-surface-variant',
        stage: 'bg-white/12 text-on-stage backdrop-blur-md',
        'stage-active': 'bg-white text-black',
        'stage-danger': 'bg-live text-on-live',
      },
      size: {
        sm: 'size-9 [&_svg]:size-5',
        md: 'size-11',
        lg: 'size-14 [&_svg]:size-7',
      },
    },
    defaultVariants: { variant: 'standard', size: 'md' },
  },
);

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof iconButtonVariants> {
  /** Required: icon-only buttons need a spoken name. */
  label: string;
  children: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, variant, size, label, type = 'button', ...props },
  ref,
) {
  return <button ref={ref} type={type} aria-label={label} title={label} className={cn(iconButtonVariants({ variant, size }), className)} {...props} />;
});

/** Floating action button: the one creation action on list screens. */
export function Fab({ className, children, label, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      className={cn(
        'state-layer press fixed z-30 flex h-14 items-center gap-3 rounded-lg bg-primary px-5 text-label-lg text-on-primary shadow-e3 [&_svg]:size-6',
        'bottom-[calc(var(--nav-height)+var(--safe-bottom)+1rem)] left-4 lg:bottom-8 lg:left-8',
        className,
      )}
      {...props}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}
