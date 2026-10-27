/**
 * The lecture's live event stream (questions, answers, status, viewers).
 * fetch-based rather than EventSource so it can send the bearer token, and
 * it reconnects on its own with a short backoff.
 */
import { useEffect, useRef } from 'react';
import type { LectureEvent } from '@workspace/live-core';
import { apiUrl, authHeaders } from './api';

export function useLectureEvents(lectureId: string | undefined, onEvent: (e: LectureEvent) => void, enabled = true) {
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    if (!lectureId || !enabled) return;
    const ctrl = new AbortController();
    let retry = 1000;

    async function run() {
      while (!ctrl.signal.aborted) {
        try {
          const res = await fetch(apiUrl(`/lectures/${lectureId}/events`), { headers: authHeaders(), signal: ctrl.signal });
          if (!res.ok || !res.body) throw new Error(String(res.status));
          retry = 1000;
          const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
          let buf = '';
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += value;
            let i: number;
            while ((i = buf.indexOf('\n\n')) >= 0) {
              const chunk = buf.slice(0, i);
              buf = buf.slice(i + 2);
              const data = chunk
                .split('\n')
                .filter((l) => l.startsWith('data: '))
                .map((l) => l.slice(6))
                .join('\n');
              if (!data) continue;
              try {
                handler.current(JSON.parse(data) as LectureEvent);
              } catch {
                // A malformed frame; skip it.
              }
            }
          }
        } catch {
          if (ctrl.signal.aborted) return;
        }
        await new Promise((r) => setTimeout(r, retry));
        retry = Math.min(retry * 2, 15_000);
      }
    }
    void run();
    return () => ctrl.abort();
  }, [lectureId, enabled]);
}
