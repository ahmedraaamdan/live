/**
 * Board state for one lecture: loads the stored ops, applies live ones
 * from the event stream, and (for the teacher) applies local ops at once
 * and ships them to the API in small batches.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { applyBoardOps, emptyBoard, type BoardItem, type BoardOp, type BoardState } from '@workspace/live-core';
import { api } from '@/lib/api';

export function useBoard(lectureId: string, host: boolean) {
  const [state, setState] = useState<BoardState>(emptyBoard);
  const [draft, setDraft] = useState<{ page: number; item: BoardItem | null }>({ page: 0, item: null });
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [ready, setReady] = useState(false);
  const queue = useRef<BoardOp[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<BoardOp[]>(`/lectures/${lectureId}/board`)
      .then((ops) => {
        if (!cancelled) setState(applyBoardOps(emptyBoard(), ops));
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, [lectureId]);

  /** Ops arriving over the event stream (viewers only: the teacher already applied its own). */
  const receive = useCallback(
    (ops: BoardOp[]) => {
      if (host) return;
      const durable: BoardOp[] = [];
      for (const o of ops) {
        if (o.op === 'draft') setDraft({ page: o.page, item: o.item });
        else if (o.op === 'pointer') setPointer(o.x == null || o.y == null ? null : { x: o.x, y: o.y });
        else durable.push(o);
      }
      if (durable.length) {
        setState((s) => applyBoardOps(s, durable));
        // A finished stroke replaces its draft.
        if (durable.some((o) => o.op === 'add')) setDraft((d) => ({ ...d, item: null }));
      }
    },
    [host],
  );

  const flush = useCallback(() => {
    timer.current = null;
    const ops = queue.current;
    queue.current = [];
    if (ops.length) void api(`/lectures/${lectureId}/board`, { body: { ops } }).catch(() => undefined);
  }, [lectureId]);

  /** The teacher's edits: shown at once, sent within ~60 ms. */
  const send = useCallback(
    (ops: BoardOp[]) => {
      const durable = ops.filter((o) => o.op !== 'draft' && o.op !== 'pointer');
      if (durable.length) setState((s) => applyBoardOps(s, durable));
      // Only the latest draft/pointer in a batch matters.
      queue.current = [...queue.current.filter((q) => !ops.some((o) => (o.op === 'draft' || o.op === 'pointer') && o.op === q.op)), ...ops];
      if (!timer.current) timer.current = setTimeout(flush, 60);
    },
    [flush],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    flush();
  }, [flush]);

  return { state, draft, pointer, ready, receive, send };
}
