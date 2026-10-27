import { cn } from '@/lib/cn';

// The Gahez G, as on gahez.space (Gahez Tools, assets/design/BRAND.md).
const G_PATH =
  'M443.62,161.36h-20.82c-10.2,49.84-54.3,87.33-107.15,87.33-60.41,0-109.37-48.97-109.37-109.37s48.97-109.37,109.37-109.37c48.96,0,90.4,32.17,104.35,76.52h20.54C424.83,45.25,369.28,0,303.17,0h-161.36C63.49,0,0,63.49,0,141.81h0c0,78.32,63.49,141.81,141.81,141.81h161.36c71.98,0,131.42-53.62,140.58-123.1h-.13v.83Z';
const G_BAR = '444.64 166.78 465.46 166.78 465.46 165.95 465.46 138.5 357.03 138.5 357.03 165.95 357.03 166.78 444.64 166.78';

export function GahezMark({ className }: { className?: string }) {
  return (
    <svg className={cn('h-6 w-auto', className)} viewBox="0 0 465.46 283.62" fill="currentColor" aria-hidden="true">
      <path d={G_PATH} />
      <polygon points={G_BAR} />
    </svg>
  );
}

/** "G Gahez [Live]" lockup. */
export function Logo({ className, size = 'md' }: { className?: string; size?: 'md' | 'lg' }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)} aria-label="Gahez Live" dir="ltr">
      <GahezMark className={size === 'lg' ? 'h-9' : 'h-6'} />
      <span className={cn('font-num font-bold tracking-tight', size === 'lg' ? 'text-headline-md' : 'text-title-lg')}>Gahez</span>
      <span className={cn('rounded-sm bg-primary px-1.5 font-num font-bold text-on-primary', size === 'lg' ? 'text-title-md' : 'text-label-md')}>Live</span>
    </span>
  );
}
