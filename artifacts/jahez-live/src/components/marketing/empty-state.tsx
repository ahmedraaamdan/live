import { Search } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({
  title = 'لم نجد هذه الفكرة بعد',
  copy = 'جرّب كلمة أخرى أو استكشف كل المواد.',
  action,
  mascot = false,
}: {
  title?: string;
  copy?: string;
  action?: ReactNode;
  /** Show the GAHEZ Agent mascot (desk variant) instead of the search icon. */
  mascot?: boolean;
}) {
  return (
    <div className="empty-state">
      {mascot
        ? <div className="empty-state-mascot" data-gahez-mascot="desk" data-face="surprised" data-dir="rtl" aria-hidden="true" />
        : <Search size={27} />}
      <h3>{title}</h3>
      <p>{copy}</p>
      {action}
    </div>
  );
}
