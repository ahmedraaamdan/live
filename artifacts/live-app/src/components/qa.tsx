import { useState } from 'react';
import { CheckCircle2, CornerDownLeft, MessageCircleQuestion, Pin, Send } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import type { MessageDTO } from '@workspace/live-core';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtTime } from '@/lib/format';
import { Avatar, Badge, IconButton, toast } from '@/ui';

/** Questions with their answers nested under them; comments flow in between. */
export function threadMessages(messages: MessageDTO[]) {
  const answers = new Map<string, MessageDTO[]>();
  for (const m of messages) if (m.kind === 'answer' && m.parentId) answers.set(m.parentId, [...(answers.get(m.parentId) ?? []), m]);
  const top = messages.filter((m) => m.kind !== 'answer' || !m.parentId);
  const pinned = top.filter((m) => m.pinned);
  return { top: [...pinned, ...top.filter((m) => !m.pinned)], answers };
}

export function MessageItem({
  m,
  answers = [],
  host,
  dark,
  onReply,
  onUpdate,
}: {
  m: MessageDTO;
  answers?: MessageDTO[];
  host?: boolean;
  dark?: boolean;
  onReply?: (m: MessageDTO) => void;
  onUpdate?: (m: MessageDTO) => void;
}) {
  const patch = useMutation({
    mutationFn: (body: { answered?: boolean; pinned?: boolean }) => api<MessageDTO>(`/messages/${m.id}`, { method: 'PATCH', body }),
    onSuccess: (x) => onUpdate?.(x),
  });
  const isQuestion = m.kind === 'question';
  const fromTeacher = m.author.role === 'teacher';
  return (
    <div className={cn('flex gap-3 py-3', m.pinned && 'rounded-md px-3', m.pinned && (dark ? 'bg-white/8' : 'bg-secondary-container/50'))}>
      <Avatar name={m.author.name} src={m.author.avatarUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('text-title-sm', dark && 'text-on-stage')}>{m.author.name}</span>
          {fromTeacher && <Badge tone="primary">المدرس</Badge>}
          {isQuestion && (
            <Badge tone={m.answered ? 'success' : 'warning'}>
              {m.answered ? <CheckCircle2 /> : <MessageCircleQuestion />}
              {m.answered ? 'اتجاوب' : 'سؤال'}
            </Badge>
          )}
          {m.pinned && <Pin className={cn('size-4', dark ? 'text-on-stage/70' : 'text-secondary')} aria-label="مثبّت" />}
          <span className={cn('font-num text-body-sm', dark ? 'text-on-stage/50' : 'text-on-surface-variant')}>{fmtTime(m.createdAt)}</span>
        </div>
        <p className={cn('mt-0.5 text-body-md whitespace-pre-wrap break-words', dark ? 'text-on-stage/90' : 'text-on-surface')}>{m.body}</p>
        {answers.map((a) => (
          <div key={a.id} className={cn('mt-2 rounded-md border-s-4 border-primary px-3 py-2', dark ? 'bg-white/8' : 'bg-primary-container/40')}>
            <p className={cn('text-label-md', dark ? 'text-on-stage/70' : 'text-on-primary-container')}>رد المدرس</p>
            <p className={cn('text-body-md whitespace-pre-wrap', dark ? 'text-on-stage' : 'text-on-surface')}>{a.body}</p>
          </div>
        ))}
        {host && isQuestion && (
          <div className="mt-1 flex gap-1">
            <button type="button" onClick={() => onReply?.(m)} className={cn('state-layer inline-flex h-8 items-center gap-1 rounded-full px-3 text-label-md', dark ? 'text-on-stage/80' : 'text-secondary')}>
              <CornerDownLeft className="size-4" /> رد
            </button>
            <button type="button" onClick={() => patch.mutate({ answered: !m.answered })} className={cn('state-layer inline-flex h-8 items-center gap-1 rounded-full px-3 text-label-md', dark ? 'text-on-stage/80' : 'text-on-surface-variant')}>
              <CheckCircle2 className="size-4" /> {m.answered ? 'لسه' : 'جاوبته شفهي'}
            </button>
            <button type="button" onClick={() => patch.mutate({ pinned: !m.pinned })} className={cn('state-layer inline-flex h-8 items-center gap-1 rounded-full px-3 text-label-md', dark ? 'text-on-stage/80' : 'text-on-surface-variant')}>
              <Pin className="size-4" /> {m.pinned ? 'شيل التثبيت' : 'ثبّت'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Composer: students ask (question) or comment; the teacher replies to a selected question. */
export function Composer({
  lectureId,
  host,
  replyTo,
  onClearReply,
  onSent,
  dark,
}: {
  lectureId: string;
  host?: boolean;
  replyTo?: MessageDTO | null;
  onClearReply?: () => void;
  onSent?: (m: MessageDTO) => void;
  dark?: boolean;
}) {
  const [body, setBody] = useState('');
  const [asQuestion, setAsQuestion] = useState(true);
  const send = useMutation({
    mutationFn: () => api<MessageDTO>(`/lectures/${lectureId}/messages`, { body: { body, kind: asQuestion ? 'question' : 'comment', parentId: replyTo?.id } }),
    onSuccess: (m) => {
      setBody('');
      onClearReply?.();
      onSent?.(m);
    },
    onError: (e) => toast(errorMessage(e)),
  });
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (body.trim()) send.mutate();
      }}
    >
      {replyTo && (
        <div className={cn('flex items-center gap-2 rounded-md px-3 py-2 text-body-sm', dark ? 'bg-white/10 text-on-stage/80' : 'bg-surface-container-high text-on-surface-variant')}>
          <CornerDownLeft className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">بترد على: {replyTo.body}</span>
          <button type="button" className="text-label-md underline" onClick={onClearReply}>
            إلغاء
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (body.trim()) send.mutate();
            }
          }}
          rows={1}
          maxLength={1000}
          placeholder={host ? (replyTo ? 'اكتب ردّك…' : 'اكتب تعليق للطلاب…') : asQuestion ? 'اسأل المدرس…' : 'اكتب تعليق…'}
          className={cn(
            'max-h-32 min-h-12 flex-1 resize-none rounded-lg border border-transparent px-4 py-3 text-body-md outline-none focus:border-secondary',
            dark ? 'bg-white/10 text-on-stage placeholder:text-on-stage/50' : 'bg-surface-container-high text-on-surface placeholder:text-on-surface-variant/70',
          )}
          aria-label="الرسالة"
        />
        <IconButton label="ابعت" type="submit" variant="filled" size="md" className="size-12" disabled={!body.trim() || send.isPending}>
          <Send className="-scale-x-100" />
        </IconButton>
      </div>
      {!host && (
        <label className={cn('flex items-center gap-2 text-body-sm', dark ? 'text-on-stage/70' : 'text-on-surface-variant')}>
          <input type="checkbox" checked={asQuestion} onChange={(e) => setAsQuestion(e.target.checked)} className="size-4 accent-[var(--primary)]" />
          ده سؤال للمدرس
        </label>
      )}
    </form>
  );
}
