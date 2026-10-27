import { cn } from '@/lib/cn';

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function initials(name: string) {
  const parts = name.replace(/^(أ\.|د\.|م\.|Mr\.|Ms\.|Dr\.)\s*/i, '').trim().split(/\s+/);
  return (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[1]?.[0] ?? '') : '');
}

const sizes = { xs: 'size-7 text-label-sm', sm: 'size-9 text-label-md', md: 'size-11 text-label-lg', lg: 'size-16 text-title-lg', xl: 'size-24 text-headline-md' };

/** Photo when there is one, otherwise initials on a colour derived from the name. */
export function Avatar({ name, src, size = 'md', className, ring }: { name: string; src?: string | null; size?: keyof typeof sizes; className?: string; ring?: boolean }) {
  const n = (hash(name) % 6) + 1;
  return (
    <span
      className={cn('relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-bold', sizes[size], ring && 'ring-2 ring-surface-container-lowest', className)}
      style={src ? undefined : { background: `var(--avatar-${n}-bg)`, color: `var(--avatar-${n}-fg)` }}
      aria-hidden="true"
    >
      {src ? <img src={src} alt="" className="size-full object-cover" /> : initials(name)}
    </span>
  );
}

export function AvatarStack({ names, max = 4 }: { names: string[]; max?: number }) {
  const shown = names.slice(0, max);
  return (
    <div className="flex -space-x-2 space-x-reverse">
      {shown.map((n, i) => (
        <Avatar key={i} name={n} size="xs" ring />
      ))}
      {names.length > max && (
        <span className="grid size-7 place-items-center rounded-full bg-surface-container-highest font-num text-label-sm text-on-surface-variant ring-2 ring-surface-container-lowest">
          +{names.length - max}
        </span>
      )}
    </div>
  );
}
