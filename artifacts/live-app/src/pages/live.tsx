import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  CircleStop,
  PenLine,
  Eye,
  Mic,
  MicOff,
  MessagesSquare,
  MonitorUp,
  Radio,
  Share2,
  Video,
  VideoOff,
  Volume2,
  WifiOff,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LocalVideoTrack, RemoteVideoTrack } from 'livekit-client';
import { HEARTBEAT_SECONDS, LIVE_OPEN_MINUTES_BEFORE, type LectureDTO, type LectureEvent, type LiveTokenDTO, type MessageDTO } from '@workspace/live-core';
import { Confetti, Countdown, ShareLectureSheet, useNow } from '@/components/bits';
import { useBoard } from '@/components/board/sync';
import { Whiteboard } from '@/components/board/whiteboard';
import { Composer, MessageItem, threadMessages } from '@/components/qa';
import { VoteBar } from '@/components/vote';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtClock } from '@/lib/format';
import { useLiveRoom, useLocalPreview } from '@/lib/live';
import { useMe } from '@/lib/session';
import { useLectureEvents } from '@/lib/sse';
import { Avatar, Banner, Button, IconButton, LiveBadge, PageSpinner, Segmented, Sheet, Spinner, toast } from '@/ui';

export function LiveRoom({ id }: { id: string }) {
  const me = useMe();
  const qc = useQueryClient();
  const lecture = useQuery({ queryKey: ['lecture', id], queryFn: () => api<LectureDTO>(`/lectures/${id}`) });
  const l = lecture.data;
  const host = Boolean(l && l.teacher.id === me.user.id);

  // Live feed: status flips, questions, viewer count, votes.
  const [messages, setMessages] = useState<MessageDTO[]>([]);
  const [viewers, setViewers] = useState(0);
  const board = useBoard(id, host);
  const msgs = useQuery({ queryKey: ['messages', id], queryFn: () => api<MessageDTO[]>(`/lectures/${id}/messages`), enabled: Boolean(l) });
  useEffect(() => {
    if (msgs.data) setMessages(msgs.data);
  }, [msgs.data]);
  const upsert = (m: MessageDTO) => setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur.map((x) => (x.id === m.id ? m : x)) : [...cur, m]));
  useLectureEvents(
    id,
    (e: LectureEvent) => {
      if (e.type === 'message' || e.type === 'message_update') upsert(e.message);
      else if (e.type === 'viewers') setViewers(e.count);
      else if (e.type === 'status') qc.setQueryData<LectureDTO>(['lecture', id], (old) => (old ? { ...old, status: e.status, liveStartedAt: e.liveStartedAt, liveEndedAt: e.liveEndedAt } : old));
      else if (e.type === 'board') board.receive(e.ops);
      else if (e.type === 'votes') qc.setQueryData<LectureDTO>(['lecture', id], (old) => (old ? { ...old, votes: { ...old.votes, likes: e.likes, dislikes: e.dislikes } } : old));
    },
    Boolean(l),
  );

  if (lecture.isPending) return <PageSpinner />;
  if (!l)
    return (
      <div className="grid min-h-dvh place-items-center bg-stage px-6 text-on-stage">
        <Banner tone="error">{errorMessage(lecture.error)}</Banner>
      </div>
    );
  return host ? (
    <Studio l={l} messages={messages} viewers={viewers} upsert={upsert} board={board} />
  ) : (
    <Viewer l={l} messages={messages} viewers={viewers} upsert={upsert} board={board} />
  );
}

interface RoomProps {
  l: LectureDTO;
  messages: MessageDTO[];
  viewers: number;
  upsert: (m: MessageDTO) => void;
  board: ReturnType<typeof useBoard>;
}

// ---------------------------------------------------------------- shared pieces

function TrackView({ track, className, mirror }: { track: LocalVideoTrack | RemoteVideoTrack | null; className?: string; mirror?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !track) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);
  return <video ref={ref} autoPlay playsInline muted={mirror} className={cn('size-full bg-black object-contain', mirror && '-scale-x-100', className)} />;
}

function StreamView({ stream, className }: { stream: MediaStream | null; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted className={cn('size-full -scale-x-100 bg-black object-cover', className)} />;
}

function Elapsed({ since }: { since: string | null }) {
  const now = useNow();
  if (!since) return null;
  return (
    <span className="font-num text-label-lg text-on-stage/90" dir="ltr">
      {fmtClock((now - new Date(since).getTime()) / 1000)}
    </span>
  );
}

function TopOverlay({ l, viewers, onBack, extra }: { l: LectureDTO; viewers: number; onBack: () => void; extra?: React.ReactNode }) {
  return (
    <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 bg-linear-to-b from-black/70 to-transparent px-2 pt-[calc(var(--safe-top)+0.5rem)] pb-6 text-on-stage">
      <IconButton label="رجوع" variant="stage" onClick={onBack}>
        <ArrowRight />
      </IconButton>
      <div className="min-w-0 flex-1">
        <p className="truncate text-title-md">{l.title}</p>
        <p className="truncate text-body-sm text-on-stage/70">{l.teacher.name}</p>
      </div>
      {l.status === 'live' && (
        <div className="flex items-center gap-2">
          <LiveBadge />
          <Elapsed since={l.liveStartedAt} />
          <span className="inline-flex items-center gap-1 rounded-full bg-white/12 px-2.5 py-1 text-label-md backdrop-blur">
            <Eye className="size-4" /> <span className="font-num">{viewers}</span>
          </span>
        </div>
      )}
      {extra}
    </div>
  );
}

function QaPanel({ l, messages, host, upsert, header }: { l: LectureDTO; messages: MessageDTO[]; host: boolean; upsert: (m: MessageDTO) => void; header?: React.ReactNode }) {
  const [filter, setFilter] = useState<'all' | 'open'>('all');
  const [replyTo, setReplyTo] = useState<MessageDTO | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const { top, answers } = threadMessages(messages);
  const shown = filter === 'open' ? top.filter((m) => m.kind === 'question' && !m.answered) : top;
  const openCount = top.filter((m) => m.kind === 'question' && !m.answered).length;
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-stage-panel text-on-stage">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <MessagesSquare className="size-5 text-on-stage/70" />
        <p className="flex-1 text-title-md">الأسئلة والتعليقات</p>
        {host && (
          <Segmented
            size="sm"
            className="bg-white/10 [&_[aria-checked=true]]:bg-white [&_[aria-checked=true]]:text-black [&_button]:text-on-stage/80"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'الكل' },
              { value: 'open', label: `من غير رد${openCount ? ` (${openCount})` : ''}` },
            ]}
          />
        )}
      </div>
      {header}
      <div ref={list} className="min-h-0 flex-1 divide-y divide-white/5 overflow-y-auto px-4">
        {shown.length === 0 && (
          <p className="py-10 text-center text-body-md text-on-stage/50">{host ? 'أسئلة الطلاب هتظهر هنا أول بأول.' : 'عندك سؤال؟ اكتبه تحت والمدرس هيشوفه.'}</p>
        )}
        {shown.map((m) => (
          <MessageItem key={m.id} m={m} answers={answers.get(m.id)} host={host} dark onReply={setReplyTo} onUpdate={upsert} />
        ))}
      </div>
      <div className="border-t border-white/10 p-3 pb-[calc(var(--safe-bottom)+0.75rem)]">
        <Composer lectureId={l.id} host={host} replyTo={replyTo} onClearReply={() => setReplyTo(null)} onSent={upsert} dark />
      </div>
    </div>
  );
}

function NotConfiguredNote() {
  return (
    <div className="absolute inset-x-3 bottom-24 z-10 rounded-md bg-black/60 p-3 text-body-sm text-on-stage/85 backdrop-blur md:inset-x-auto md:start-3 md:max-w-sm">
      البث الحقيقي محتاج إعداد LiveKit على السيرفر (LIVEKIT_URL و LIVEKIT_API_KEY). دلوقتي بتشوف معاينة الكاميرا عندك بس، والأسئلة والحضور شغالين عادي.
    </div>
  );
}

// ---------------------------------------------------------------- teacher

function Studio({ l, messages, viewers, upsert, board }: RoomProps) {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [share, setShare] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [panel, setPanel] = useState(true);
  const live = l.status === 'live';
  const ended = l.status === 'ended';

  const token = useQuery({
    queryKey: ['live-token', l.id, live],
    queryFn: () => api<LiveTokenDTO>(`/lectures/${l.id}/live/token`, { method: 'POST' }),
    enabled: live,
    staleTime: Infinity,
  });
  const configured = token.data?.configured ?? true;
  const room = useLiveRoom({ url: live ? (token.data?.url ?? null) : null, token: live ? (token.data?.token ?? null) : null, host: true });
  // Before going live (or without LiveKit) the camera is a local preview only.
  const preview = useLocalPreview(!ended && (!live || !configured));

  const start = useMutation({
    mutationFn: () => api<LectureDTO>(`/lectures/${l.id}/live/start`, { method: 'POST' }),
    onSuccess: (x) => {
      qc.setQueryData(['lecture', l.id], x);
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 3500);
    },
    onError: (e) => toast(errorMessage(e)),
  });
  const end = useMutation({
    mutationFn: () => api<LectureDTO>(`/lectures/${l.id}/live/end`, { method: 'POST' }),
    onSuccess: (x) => {
      void room.disconnect();
      qc.setQueryData(['lecture', l.id], x);
      setConfirmEnd(false);
    },
    onError: (e) => toast(errorMessage(e)),
  });
  const tooEarly = new Date(l.startsAt).getTime() - Date.now() > LIVE_OPEN_MINUTES_BEFORE * 60_000;
  const boardOn = board.state.on;
  const [boardCanvas, setBoardCanvas] = useState<HTMLCanvasElement | null>(null);
  const { publishCanvas, status: roomStatus } = room;
  // The board goes out as a video track too, so the recording has it.
  useEffect(() => {
    if (!boardOn || !boardCanvas || roomStatus !== 'connected') return;
    let undo: (() => void) | undefined;
    let cancelled = false;
    void publishCanvas(boardCanvas).then((u) => (cancelled ? u() : (undo = u)));
    return () => {
      cancelled = true;
      undo?.();
    };
  }, [boardOn, boardCanvas, roomStatus, publishCanvas]);

  if (ended) {
    const questions = messages.filter((m) => m.kind === 'question');
    return (
      <div className="grid min-h-dvh place-items-center bg-stage px-6 text-center text-on-stage">
        <div className="max-w-md">
          <div className="mx-auto grid size-20 animate-pop place-items-center rounded-full bg-white/10">
            <CircleStop className="size-10" />
          </div>
          <h1 className="mt-6 text-headline-lg">البث خلص. شغل عالي 👏</h1>
          <p className="mt-2 text-body-lg text-on-stage/70">
            <span className="font-num">{questions.length}</span> سؤال · {questions.filter((q) => !q.answered).length > 0 ? `${questions.filter((q) => !q.answered).length} لسه من غير رد` : 'كل الأسئلة اتجاوبت'}
          </p>
          <p className="mt-1 text-body-md text-on-stage/60">التسجيل بيتجهّز، والطلاب هيوصلهم إشعار أول ما يبقى جاهز.</p>
          <div className="mt-8 flex flex-col gap-3">
            <Button size="lg" block onClick={() => navigate(`/lectures/${l.id}`, { replace: true })}>
              نزّل واجب ورد على الأسئلة
            </Button>
            <Button size="lg" variant="neutral" block className="bg-white/10 text-on-stage" onClick={() => navigate('/t', { replace: true })}>
              الرئيسية
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const mainTrack = room.screen ?? room.camera;
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-stage lg:flex-row">
      {celebrate && <Confetti />}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <TopOverlay
          l={l}
          viewers={viewers}
          onBack={() => navigate(`/lectures/${l.id}`)}
          extra={
            <IconButton label="ابعت اللينك" variant="stage" onClick={() => setShare(true)}>
              <Share2 />
            </IconButton>
          }
        />
        <div className="relative min-h-0 flex-1">
          {boardOn ? (
            <div className="flex size-full flex-col pt-[calc(var(--safe-top)+4.5rem)]">
              <Whiteboard state={board.state} editable onOps={board.send} onCanvas={setBoardCanvas} className="flex-1" />
            </div>
          ) : live && configured && mainTrack ? (
            <TrackView track={mainTrack} mirror={!room.screen} />
          ) : preview.stream ? (
            <StreamView stream={preview.stream} />
          ) : (
            <div className="grid size-full place-items-center text-on-stage/60">
              {preview.error ? <p className="max-w-xs text-center text-body-md">{preview.error}</p> : <Spinner className="size-8" />}
            </div>
          )}
          {!boardOn && live && configured && room.screen && room.camera && (
            <div className="absolute end-3 bottom-24 h-28 w-40 overflow-hidden rounded-md shadow-e4 ring-2 ring-white/20 md:h-36 md:w-56">
              <TrackView track={room.camera} mirror />
            </div>
          )}
          {boardOn && (live && configured ? room.camera : preview.stream) && (
            <div className="absolute end-3 top-[calc(var(--safe-top)+5rem)] z-10 h-20 w-32 overflow-hidden rounded-md shadow-e4 ring-2 ring-white/20 md:h-28 md:w-44">
              {live && configured ? <TrackView track={room.camera} mirror /> : <StreamView stream={preview.stream} />}
            </div>
          )}
          {live && !configured && !boardOn && <NotConfiguredNote />}
          {room.status === 'reconnecting' && (
            <div className="absolute inset-x-0 top-24 z-10 mx-auto flex w-fit items-center gap-2 rounded-full bg-warning px-4 py-2 text-label-lg text-on-warning">
              <WifiOff className="size-4" /> النت بيقطع… بنحاول نرجّع البث
            </div>
          )}
          {!live && !boardOn && (
            <div className="absolute inset-0 grid place-items-center bg-black/40 px-6 text-center text-on-stage">
              <div>
                <p className="text-body-lg text-on-stage/80">{l.seatsTaken} طالب حاجز</p>
                {tooEarly ? (
                  <p className="mt-2 text-title-lg">
                    زرار البث بيفتح قبل الميعاد بـ{LIVE_OPEN_MINUTES_BEFORE} دقيقة · <Countdown to={l.startsAt} />
                  </p>
                ) : (
                  <p className="mt-2 text-headline-sm">جاهز؟ الطلاب مستنيينك 🎬</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Controls: the thumb zone. */}
        <div className="flex items-center justify-center gap-3 bg-stage px-4 py-3 pb-[calc(var(--safe-bottom)+0.75rem)] lg:pb-4">
          <IconButton label={room.micOn ? 'اقفل المايك' : 'افتح المايك'} variant={room.micOn || !live || !configured ? 'stage' : 'stage-danger'} size="lg" onClick={room.toggleMic} disabled={!live || !configured}>
            {room.micOn || !live || !configured ? <Mic /> : <MicOff />}
          </IconButton>
          <IconButton label={room.camOn ? 'اقفل الكاميرا' : 'افتح الكاميرا'} variant={room.camOn || !live || !configured ? 'stage' : 'stage-danger'} size="lg" onClick={room.toggleCam} disabled={!live || !configured}>
            {room.camOn || !live || !configured ? <Video /> : <VideoOff />}
          </IconButton>
          <IconButton label="شارك الشاشة" variant={room.screenOn ? 'stage-active' : 'stage'} size="lg" onClick={room.toggleScreen} disabled={!live || !configured} className="hidden md:inline-grid">
            <MonitorUp />
          </IconButton>
          <IconButton label={boardOn ? 'ارجع للكاميرا' : 'السبورة'} variant={boardOn ? 'stage-active' : 'stage'} size="lg" onClick={() => board.send([{ op: 'mode', on: !boardOn }])}>
            <PenLine />
          </IconButton>
          <IconButton label="الأسئلة" variant={panel ? 'stage-active' : 'stage'} size="lg" onClick={() => setPanel(!panel)} className="lg:hidden">
            <MessagesSquare />
          </IconButton>
          {live ? (
            <Button variant="danger" size="lg" onClick={() => setConfirmEnd(true)}>
              <CircleStop /> إنهاء
            </Button>
          ) : (
            <Button variant="live" size="lg" loading={start.isPending} disabled={tooEarly} onClick={() => start.mutate()}>
              <Radio /> ابدأ البث
            </Button>
          )}
        </div>
      </div>

      {panel && (
        <div className="flex h-[42dvh] min-h-0 flex-col border-white/10 lg:h-auto lg:w-[380px] lg:shrink-0 lg:border-s">
          <QaPanel l={l} messages={messages} host upsert={upsert} />
        </div>
      )}

      <ShareLectureSheet open={share} onOpenChange={setShare} code={l.code} title={l.title} />
      <Sheet
        open={confirmEnd}
        onOpenChange={setConfirmEnd}
        title="تنهي البث؟"
        description="الطلاب هيخرجوا والتسجيل هيتحفظ. مينفعش ترجع تفتح نفس البث تاني."
        footer={
          <>
            <Button variant="danger" block loading={end.isPending} onClick={() => end.mutate()}>
              أيوه، انهي البث
            </Button>
            <Button variant="outlined" block onClick={() => setConfirmEnd(false)}>
              كمّل
            </Button>
          </>
        }
      >
        <span />
      </Sheet>
    </div>
  );
}

// ---------------------------------------------------------------- student

function Viewer({ l, messages, viewers, upsert, board }: RoomProps) {
  const [, navigate] = useLocation();
  const live = l.status === 'live';
  const [panel, setPanel] = useState<'qa' | 'none'>('qa');
  const token = useQuery({
    queryKey: ['live-token', l.id, live],
    queryFn: () => api<LiveTokenDTO>(`/lectures/${l.id}/live/token`, { method: 'POST' }),
    enabled: live,
    staleTime: Infinity,
    retry: false,
  });
  const configured = token.data?.configured ?? true;
  const room = useLiveRoom({ url: token.data?.url ?? null, token: token.data?.token ?? null, host: false });

  // Attendance: a heartbeat while the class is live and the screen is visible.
  useEffect(() => {
    if (!live) return;
    const beat = () => {
      if (document.visibilityState === 'visible') void api(`/lectures/${l.id}/heartbeat`, { body: { mode: 'live' } }).catch(() => undefined);
    };
    beat();
    const t = setInterval(beat, HEARTBEAT_SECONDS * 1000);
    return () => clearInterval(t);
  }, [live, l.id]);

  if (token.error)
    return (
      <div className="grid min-h-dvh place-items-center bg-stage px-6 text-on-stage">
        <div className="max-w-sm text-center">
          <Banner tone="error">{errorMessage(token.error)}</Banner>
          <Button className="mt-6" onClick={() => navigate(`/l/${l.code}`)}>
            افتح صفحة الحجز
          </Button>
        </div>
      </div>
    );

  if (l.status === 'ended')
    return (
      <div className="grid min-h-dvh place-items-center bg-stage px-6 text-center text-on-stage">
        <div className="max-w-md">
          <h1 className="text-headline-lg">الحصة خلصت 👋</h1>
          <p className="mt-2 text-body-lg text-on-stage/70">الحصة عجبتك؟ تقييمك بيساعد زمايلك يلاقوا أحسن الحصص.</p>
          <VoteBar lecture={l} dark className="mt-6 justify-center" />
          <div className="mt-8 flex flex-col gap-3">
            <Button size="lg" block onClick={() => navigate(`/lectures/${l.id}`, { replace: true })}>
              الواجب والتسجيل
            </Button>
            <Button size="lg" variant="neutral" block className="bg-white/10 text-on-stage" onClick={() => navigate('/s', { replace: true })}>
              الرئيسية
            </Button>
          </div>
        </div>
      </div>
    );

  const mainTrack = room.screen ?? room.camera;
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-stage lg:flex-row">
      <div className="relative flex min-h-0 min-w-0 flex-col lg:flex-1">
        <TopOverlay
          l={l}
          viewers={viewers}
          onBack={() => navigate(`/lectures/${l.id}`)}
          extra={
            <IconButton label="الأسئلة" variant="stage" className="lg:hidden" onClick={() => setPanel(panel === 'qa' ? 'none' : 'qa')}>
              <MessagesSquare />
            </IconButton>
          }
        />
        <div className={cn('relative w-full bg-black', panel === 'qa' && !board.state.on ? 'aspect-video lg:aspect-auto lg:min-h-0 lg:flex-1' : 'min-h-0 flex-1', panel === 'qa' && board.state.on && 'max-lg:h-[52dvh] max-lg:flex-none')}>
          {live && board.state.on ? (
            <div className="flex size-full flex-col pt-[calc(var(--safe-top)+4rem)]">
              <Whiteboard state={board.state} remoteDraft={board.draft} pointer={board.pointer} className="flex-1" />
              {configured && room.camera && (
                <div className="absolute end-3 top-[calc(var(--safe-top)+4.5rem)] h-16 w-28 overflow-hidden rounded-md shadow-e4 ring-2 ring-white/20 md:h-24 md:w-40">
                  <TrackView track={room.camera} />
                </div>
              )}
            </div>
          ) : !live ? (
            <div className="grid size-full place-items-center px-6 text-center text-on-stage">
              <div>
                <Avatar name={l.teacher.name} src={l.teacher.avatarUrl} size="xl" className="mx-auto animate-float" />
                <p className="mt-4 text-title-lg">البث هيبدأ بعد</p>
                <Countdown to={l.startsAt} className="mt-1 block text-display-sm" />
                <p className="mt-2 text-body-md text-on-stage/60">خليك هنا، الصفحة هتفتح البث لوحدها أول ما {l.teacher.name.split(' ').slice(0, 2).join(' ')} يبدأ.</p>
              </div>
            </div>
          ) : !configured ? (
            <div className="grid size-full place-items-center px-6 text-center text-on-stage/70">
              <p className="max-w-sm text-body-md">الفيديو مش متاح في بيئة التطوير (LiveKit مش متضبط). الأسئلة وتسجيل الحضور شغالين.</p>
            </div>
          ) : mainTrack ? (
            <TrackView track={mainTrack} />
          ) : (
            <div className="grid size-full place-items-center text-on-stage/70">
              <div className="flex flex-col items-center gap-3">
                <Spinner className="size-8" />
                <p className="text-body-md">{room.status === 'connected' ? (room.hostPresent ? 'المدرس قافل الكاميرا' : 'مستنيين المدرس يدخل…') : 'بنوصّلك بالبث…'}</p>
              </div>
            </div>
          )}
          {live && configured && !board.state.on && room.screen && room.camera && (
            <div className="absolute end-3 bottom-3 h-24 w-36 overflow-hidden rounded-md shadow-e4 ring-2 ring-white/20 md:h-32 md:w-48">
              <TrackView track={room.camera} />
            </div>
          )}
          {room.audioBlocked && (
            <button type="button" onClick={room.startAudio} className="press absolute inset-x-0 bottom-4 z-10 mx-auto flex w-fit items-center gap-2 rounded-full bg-white px-5 py-3 text-label-lg text-black shadow-e4">
              <Volume2 className="size-5" /> دوس عشان تسمع الصوت
            </button>
          )}
          {room.status === 'reconnecting' && (
            <div className="absolute inset-x-0 top-20 z-10 mx-auto flex w-fit items-center gap-2 rounded-full bg-warning px-4 py-2 text-label-lg text-on-warning">
              <WifiOff className="size-4" /> النت ضعيف… بنرجّع البث
            </div>
          )}
        </div>
        {live && (
          <div className="hidden items-center gap-3 border-t border-white/10 px-4 py-3 lg:flex">
            <VoteBar lecture={l} dark />
          </div>
        )}
      </div>
      {panel === 'qa' && (
        <div className="flex min-h-0 flex-1 flex-col lg:w-[380px] lg:flex-none lg:shrink-0 lg:border-s lg:border-white/10">
          <QaPanel
            l={l}
            messages={messages}
            host={false}
            upsert={upsert}
            header={
              live ? (
                <div className="border-b border-white/10 px-4 py-2 lg:hidden">
                  <VoteBar lecture={l} dark />
                </div>
              ) : undefined
            }
          />
        </div>
      )}
    </div>
  );
}
