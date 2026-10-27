import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from '@/ui';
import { useBoard } from './sync';
import { Whiteboard } from './whiteboard';

/** The lecture's board after class: every page, read-only, downloadable. Hidden when nothing was drawn. */
export function BoardReview({ lectureId }: { lectureId: string }) {
  const board = useBoard(lectureId, true);
  const [page, setPage] = useState(0);
  const pages = board.state.pages;
  if (!board.ready || !pages.some((p) => p.items.length)) return null;
  const n = pages.length;
  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="flex-1 text-title-lg">سبورة الحصة</h2>
        <IconButton label="الصفحة اللي فاتت" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
          <ChevronRight />
        </IconButton>
        <span className="font-num text-label-lg">
          {page + 1}/{n}
        </span>
        <IconButton label="الصفحة الجاية" size="sm" disabled={page >= n - 1} onClick={() => setPage(page + 1)}>
          <ChevronLeft />
        </IconButton>
      </div>
      <div className="overflow-hidden rounded-lg bg-stage">
        <Whiteboard state={board.state} pageOverride={page} className="aspect-video" />
      </div>
    </section>
  );
}
