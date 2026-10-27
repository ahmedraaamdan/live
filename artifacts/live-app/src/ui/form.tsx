import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Fields: label above (floating labels read badly in Arabic), 48px tall,
 * tonal fill with an outline that turns secondary on focus and error-red
 * with a message under it on error.
 */
const fieldBase =
  'w-full rounded-md border border-transparent bg-surface-container-high px-4 text-body-lg text-on-surface placeholder:text-on-surface-variant/70 transition-[border-color,background-color] duration-150 outline-none focus:border-secondary focus:bg-surface-container-lowest aria-[invalid=true]:border-error disabled:opacity-50';

export function Field({ label, hint, error, children, id, className }: { label?: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; id: string; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-label-lg text-on-surface">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-msg`} className="text-body-sm text-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="text-body-sm text-on-surface-variant">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type FieldProps = { label?: ReactNode; hint?: ReactNode; error?: string | null; containerClassName?: string };

export const TextField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldProps & { trailing?: ReactNode; ltr?: boolean }>(function TextField(
  { label, hint, error, containerClassName, className, id, trailing, ltr, ...props },
  ref,
) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Field label={label} hint={hint} error={error} id={fid} className={containerClassName}>
      <div className="relative">
        <input
          ref={ref}
          id={fid}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${fid}-msg` : undefined}
          dir={ltr ? 'ltr' : undefined}
          className={cn(fieldBase, 'h-12', ltr && 'text-end', trailing && 'pe-12', className)}
          {...props}
        />
        {trailing && <div className="absolute inset-y-0 end-1 grid place-items-center">{trailing}</div>}
      </div>
    </Field>
  );
});

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps>(function TextArea(
  { label, hint, error, containerClassName, className, id, rows = 4, ...props },
  ref,
) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Field label={label} hint={hint} error={error} id={fid} className={containerClassName}>
      <textarea ref={ref} id={fid} rows={rows} aria-invalid={error ? true : undefined} className={cn(fieldBase, 'resize-y py-3', className)} {...props} />
    </Field>
  );
});

/** Native select: on phones it opens the OS picker, which beats any custom menu. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & FieldProps & { options: ReadonlyArray<{ value: string; label: string }>; placeholder?: string }>(
  function Select({ label, hint, error, containerClassName, className, id, options, placeholder, ...props }, ref) {
    const auto = useId();
    const fid = id ?? auto;
    return (
      <Field label={label} hint={hint} error={error} id={fid} className={containerClassName}>
        <div className="relative">
          <select ref={ref} id={fid} aria-invalid={error ? true : undefined} className={cn(fieldBase, 'h-12 appearance-none pe-10', className)} {...props}>
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute end-3 top-1/2 size-5 -translate-y-1/2 text-on-surface-variant" aria-hidden="true" />
        </div>
      </Field>
    );
  },
);

/** M3 segmented button: 2–5 mutually exclusive options. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'md',
  ariaLabel,
}: {
  value: T;
  onChange: (v: NoInfer<T>) => void;
  options: ReadonlyArray<{ value: NoInfer<T>; label: ReactNode; icon?: ReactNode }>;
  className?: string;
  size?: 'sm' | 'md';
  ariaLabel?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn('flex rounded-full bg-surface-container-high p-1', className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'state-layer flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-label-lg transition-[background-color,color,box-shadow] duration-200 ease-standard [&_svg]:size-4',
              size === 'sm' ? 'h-8' : 'h-10',
              on ? 'bg-surface-container-lowest text-on-surface shadow-e1' : 'text-on-surface-variant',
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Filter / choice chip. */
export function Chip({ selected, onClick, children, icon, className }: { selected?: boolean; onClick?: () => void; children: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'state-layer press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-sm border px-3.5 text-label-lg transition-colors duration-150 [&_svg]:size-4',
        selected ? 'border-transparent bg-secondary-container text-on-secondary-container' : 'border-outline-variant text-on-surface-variant',
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex min-h-14 cursor-pointer items-center gap-4">
      <div className="min-w-0 flex-1">
        <div className="text-title-md">{label}</div>
        {description && <div className="text-body-md text-on-surface-variant">{description}</div>}
      </div>
      <span className="relative inline-flex">
        <input id={id} type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-8 w-[52px] rounded-full border-2 border-outline bg-surface-container-highest transition-colors duration-200 peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:outline-2 peer-focus-visible:outline-secondary" />
        <span className="absolute top-1/2 right-2 size-4 -translate-y-1/2 rounded-full bg-outline transition-all duration-200 ease-spring peer-checked:right-[26px] peer-checked:size-6 peer-checked:bg-on-primary" />
      </span>
    </label>
  );
}
