import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { VOTE_MIN_LIVE_SECONDS, type LectureDTO, type LectureVotes } from '@workspace/live-core';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { toast } from '@/ui';

/** "92%" of likes, or null below 3 votes (too few to mean anything). */
export function approvalPct(v: Pick<LectureVotes, 'likes' | 'dislikes'>): number | null {
  const n = v.likes + v.dislikes;
  return n >= 3 ? Math.round((v.likes / n) * 100) : null;
}

/** Like / dislike. Disabled with a hint until the student has watched enough. */
export function VoteBar({ lecture, dark, className }: { lecture: LectureDTO; dark?: boolean; className?: string }) {
  const qc = useQueryClient();
  const v = lecture.votes;
  const vote = useMutation({
    mutationFn: (value: -1 | 0 | 1) => api<LectureVotes>(`/lectures/${lecture.id}/vote`, { body: { value } }),
    onMutate: (value) => {
      // Optimistic: the tap should feel instant.
      qc.setQueryData<LectureDTO>(['lecture', lecture.id], (old) => {
        if (!old) return old;
        const o = old.votes;
        const likes = o.likes - (o.mine === 1 ? 1 : 0) + (value === 1 ? 1 : 0);
        const dislikes = o.dislikes - (o.mine === -1 ? 1 : 0) + (value === -1 ? 1 : 0);
        return { ...old, votes: { ...o, likes, dislikes, mine: value } };
      });
    },
    onError: (e) => {
      toast(errorMessage(e));
      qc.invalidateQueries({ queryKey: ['lecture', lecture.id] });
    },
    onSuccess: (r) => qc.setQueryData<LectureDTO>(['lecture', lecture.id], (old) => (old ? { ...old, votes: { ...old.votes, ...r } } : old)),
  });
  const btn = (on: boolean, tone: 'up' | 'down') =>
    cn(
      'state-layer press inline-flex h-10 items-center gap-2 rounded-full px-4 text-label-lg transition-colors disabled:opacity-40 [&_svg]:size-5',
      on
        ? tone === 'up'
          ? 'bg-success-container text-on-success-container'
          : 'bg-error-container text-on-error-container'
        : dark
          ? 'bg-white/10 text-on-stage'
          : 'bg-surface-container-high text-on-surface',
    );
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <button type="button" className={btn(v.mine === 1, 'up')} disabled={!v.canVote} onClick={() => vote.mutate(v.mine === 1 ? 0 : 1)} aria-pressed={v.mine === 1} aria-label="عجبتني">
        <ThumbsUp className={v.mine === 1 ? 'fill-current' : ''} /> <span className="font-num">{v.likes}</span>
      </button>
      <button type="button" className={btn(v.mine === -1, 'down')} disabled={!v.canVote} onClick={() => vote.mutate(v.mine === -1 ? 0 : -1)} aria-pressed={v.mine === -1} aria-label="معجبتنيش">
        <ThumbsDown className={v.mine === -1 ? 'fill-current' : ''} /> <span className="font-num">{v.dislikes}</span>
      </button>
      {!v.canVote && <span className={cn('text-body-sm', dark ? 'text-on-stage/60' : 'text-on-surface-variant')}>تقدر تقيّم بعد {Math.round(VOTE_MIN_LIVE_SECONDS / 60)} دقايق مشاهدة</span>}
    </div>
  );
}
