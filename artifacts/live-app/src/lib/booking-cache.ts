import type { QueryClient } from '@tanstack/react-query';
import type { BookResult, LectureDTO } from '@workspace/live-core';
import { api } from './api';
const inflight = new Map<string, Promise<BookResult>>();
/** One click sequence creates one request, even before React updates the disabled button. */
export function requestBooking(id: string, userId: string, phone?: string) {
 const key = `${userId}:${id}`;
 const current = inflight.get(key); if (current) return current;
 const promise = api<BookResult>(`/lectures/${id}/book`, phone ? { body: { phone } } : { method: 'POST' }).finally(() => { if (inflight.get(key) === promise) inflight.delete(key); });
 inflight.set(key, promise); return promise;
}
export async function cacheConfirmedBooking(qc: QueryClient, lecture: LectureDTO, booking: { id: string; status: 'confirmed' }) {
 const matches = (query: { queryKey: readonly unknown[] }) => (query.queryKey[0] === 'lecture' && query.queryKey[1] === lecture.id) || query.queryKey[0] === 'public-lecture';
 await qc.cancelQueries({ predicate: matches });
 const update = (old: LectureDTO | undefined) => old?.id === lecture.id ? { ...old, booking: { id: booking.id, status: booking.status } } : old;
 qc.setQueriesData<LectureDTO>({ predicate: matches }, update);
 qc.setQueryData<LectureDTO>(['lecture', lecture.id], { ...lecture, booking: { id: booking.id, status: booking.status } });
 for (const key of ['student-home', 'lectures', 'feed']) void qc.invalidateQueries({ queryKey: [key] });
 void qc.invalidateQueries({ queryKey: ['lecture', lecture.id] });
}
