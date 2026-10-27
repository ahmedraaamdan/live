import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Circle,
  Download,
  Eraser,
  Hand,
  Highlighter,
  LineChart,
  Minus,
  Pen,
  Plus,
  Redo2,
  Ruler,
  Square,
  Table2,
  Trash2,
  Type,
  Undo2,
  Wand2,
  Zap,
} from 'lucide-react';
import { BOARD_H, BOARD_W, type BoardBackground, type BoardItem, type BoardOp, type BoardState, type PenKind } from '@workspace/live-core';
import { cn } from '@/lib/cn';
import { Banner, Button, Sheet, TextArea, TextField, toast } from '@/ui';
import { compile } from './math';
import { bounds, drawPage, hits, lineMeasure, PAPER, translate } from './render';

type Tool = PenKind | 'eraser' | 'ruler' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'text' | 'move' | 'laser';

/** Board inks: fixed, like real markers (the board is paper, outside light/dark theming). */
const INKS = ['#0f172a', '#ffffff', '#e11d48', '#2563eb', '#16a34a', '#ea580c', '#7c3aed', '#0891b2'];
const WIDTHS = [3, 6, 12];
const BGS: Array<{ v: BoardBackground; label: string }> = [
  { v: 'grid', label: 'مربعات' },
  { v: 'lined', label: 'سطور' },
  { v: 'dots', label: 'نقط' },
  { v: 'plain', label: 'سادة' },
  { v: 'chalk', label: 'سبورة' },
];

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Snaps a line to the nearest 15° when it's within 4° of it: straight lines without trying. */
function snap(x1: number, y1: number, x2: number, y2: number) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const a = Math.atan2(y2 - y1, x2 - x1);
  const step = Math.PI / 12;
  const near = Math.round(a / step) * step;
  if (Math.abs(a - near) < (4 * Math.PI) / 180) return { x2: r1(x1 + len * Math.cos(near)), y2: r1(y1 + len * Math.sin(near)) };
  return { x2: r1(x2), y2: r1(y2) };
}

type DialogState =
  | null
  | { kind: 'text'; x: number; y: number; edit?: Extract<BoardItem, { t: 'text' }> }
  | { kind: 'graph' }
  | { kind: 'table' }
  | { kind: 'cell'; table: Extract<BoardItem, { t: 'table' }>; r: number; c: number };

interface History {
  undo: BoardOp[];
  redo: BoardOp[];
}

/**
 * The live whiteboard. Read-only for students (with the teacher's live
 * draft and laser pointer); full toolbar for the teacher.
 */
export function Whiteboard({
  state,
  editable,
  onOps,
  remoteDraft,
  pointer,
  onCanvas,
  className,
  pageOverride,
}: {
  state: BoardState;
  editable?: boolean;
  onOps?: (ops: BoardOp[]) => void;
  remoteDraft?: { page: number; item: BoardItem | null };
  pointer?: { x: number; y: number } | null;
  onCanvas?: (c: HTMLCanvasElement | null) => void;
  className?: string;
  /** Review mode: show this page instead of the teacher's current one. */
  pageOverride?: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(0.5);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(INKS[0]!);
  const [width, setWidth] = useState(WIDTHS[0]!);
  const [draft, setDraft] = useState<BoardItem | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [localPointer, setLocalPointer] = useState<{ x: number; y: number } | null>(null);
  const [history, setHistory] = useState<History[]>([]);
  const [future, setFuture] = useState<History[]>([]);
  const [dialog, setDialog] = useState<DialogState>(null);
  const gesture = useRef<{ x0: number; y0: number; pts: number[]; erased: BoardItem[]; moving?: BoardItem; moved?: boolean; lastSend: number } | null>(null);

  const pageIndex = pageOverride ?? state.page;
  const page = state.pages[pageIndex] ?? { items: [], bg: 'grid' as BoardBackground };
  const ink = PAPER[page.bg].ink;

  // When switching to the chalkboard, a navy pen would vanish: flip to white (and back).
  useEffect(() => {
    if (page.bg === 'chalk' && color === INKS[0]) setColor(INKS[1]!);
    if (page.bg !== 'chalk' && color === INKS[1]) setColor(INKS[0]!);
  }, [page.bg]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fit 1600×900 into the container (contain).
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const s = Math.min(el.clientWidth / BOARD_W, el.clientHeight / BOARD_H || Infinity);
      setScale(Number.isFinite(s) && s > 0 ? s : el.clientWidth / BOARD_W);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    onCanvas?.(canvas.current);
    return () => onCanvas?.(null);
  }, [onCanvas]);

  // Draw.
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(BOARD_W * scale * dpr);
    const h = Math.round(BOARD_H * scale * dpr);
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const ctx = c.getContext('2d')!;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    const items = page.items.filter((it) => !hidden.has(it.id));
    const extra: BoardItem[] = [];
    if (draft) extra.push(draft);
    if (remoteDraft?.item && remoteDraft.page === pageIndex) extra.push(remoteDraft.item);
    drawPage(ctx, { ...page, items }, extra);
    if (editable && selected) {
      const it = (draft && draft.id === selected ? draft : page.items.find((x) => x.id === selected)) ?? null;
      if (it) {
        const b = bounds(it);
        ctx.save();
        ctx.setLineDash([8, 6]);
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2;
        ctx.strokeRect(b.x - 8, b.y - 8, b.w + 16, b.h + 16);
        ctx.restore();
      }
    }
    // A plain line shows its length while being drawn (the ruler always does).
    if (draft?.t === 'line' && !draft.ruler) {
      const m = lineMeasure(draft.x1, draft.y1, draft.x2, draft.y2);
      ctx.save();
      ctx.font = '600 20px "Space Grotesk Variable", sans-serif';
      ctx.fillStyle = ink;
      ctx.fillText(`${m.cm.toFixed(1)} سم`, (draft.x1 + draft.x2) / 2 + 12, (draft.y1 + draft.y2) / 2 - 12);
      ctx.restore();
    }
  }, [page, draft, remoteDraft, hidden, scale, selected, editable, pageIndex, ink]);

  const emit = useCallback((ops: BoardOp[], undo?: BoardOp[]) => {
    onOps?.(ops);
    if (undo) {
      setHistory((h) => [...h.slice(-99), { redo: ops, undo }]);
      setFuture([]);
    }
  }, [onOps]);

  const toBoard = (e: React.PointerEvent) => {
    const rect = canvas.current!.getBoundingClientRect();
    return { x: r1((e.clientX - rect.left) / scale), y: r1((e.clientY - rect.top) / scale) };
  };
  const topHit = (x: number, y: number) => [...page.items].reverse().find((it) => hits(it, x, y, 10));

  const shapeFrom = (x0: number, y0: number, x: number, y: number, id = 'draft'): BoardItem | null => {
    if (tool === 'line' || tool === 'arrow' || tool === 'ruler') {
      const s = snap(x0, y0, x, y);
      return { id, t: 'line', color, width: tool === 'ruler' ? Math.max(2, width / 2) : width, x1: x0, y1: y0, x2: s.x2, y2: s.y2, arrow: tool === 'arrow', ruler: tool === 'ruler' };
    }
    if (tool === 'rect' || tool === 'ellipse') return { id, t: tool, color, width, x: x0, y: y0, w: r1(x - x0), h: r1(y - y0) };
    return null;
  };

  const onDown = (e: React.PointerEvent) => {
    if (!editable) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    const { x, y } = toBoard(e);
    gesture.current = { x0: x, y0: y, pts: [x, y], erased: [], lastSend: 0 };
    if (tool === 'text') {
      setDialog({ kind: 'text', x, y });
      gesture.current = null;
    } else if (tool === 'move') {
      const it = topHit(x, y);
      setSelected(it?.id ?? null);
      if (it) gesture.current.moving = it;
    } else if (tool === 'laser') {
      setLocalPointer({ x, y });
      emit([{ op: 'pointer', x, y }]);
    } else if (tool === 'eraser') {
      eraseAt(x, y);
    }
  };

  const eraseAt = (x: number, y: number) => {
    const g = gesture.current!;
    const hit = page.items.filter((it) => !hidden.has(it.id) && hits(it, x, y, 14));
    if (!hit.length) return;
    g.erased.push(...hit);
    setHidden((h) => new Set([...h, ...hit.map((i) => i.id)]));
  };

  const onMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!editable || !g) return;
    const { x, y } = toBoard(e);
    const now = performance.now();
    const live = now - g.lastSend > 50;
    if (tool === 'pen' || tool === 'marker' || tool === 'highlighter') {
      const lx = g.pts[g.pts.length - 2]!;
      const ly = g.pts[g.pts.length - 1]!;
      if (Math.hypot(x - lx, y - ly) < 2) return;
      g.pts.push(x, y);
      const item: BoardItem = { id: 'draft', t: 'stroke', pen: tool, color, width, points: g.pts.slice() };
      setDraft(item);
      if (live) {
        g.lastSend = now;
        emit([{ op: 'draft', page: state.page, item }]);
      }
    } else if (tool === 'eraser') {
      eraseAt(x, y);
    } else if (tool === 'move' && g.moving) {
      g.moved = true;
      const item = translate(g.moving, x - g.x0, y - g.y0);
      setHidden(new Set([g.moving.id]));
      setDraft(item);
      if (live) {
        g.lastSend = now;
        emit([{ op: 'draft', page: state.page, item }]);
      }
    } else if (tool === 'laser') {
      setLocalPointer({ x, y });
      if (live) {
        g.lastSend = now;
        emit([{ op: 'pointer', x, y }]);
      }
    } else {
      const item = shapeFrom(g.x0, g.y0, x, y);
      setDraft(item);
      if (item && live) {
        g.lastSend = now;
        emit([{ op: 'draft', page: state.page, item }]);
      }
    }
  };

  const onUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    gesture.current = null;
    if (!editable || !g) return;
    const { x, y } = toBoard(e);
    const p = state.page;
    if (tool === 'pen' || tool === 'marker' || tool === 'highlighter') {
      const item: BoardItem = { id: uid(), t: 'stroke', pen: tool, color, width, points: g.pts };
      emit([{ op: 'add', page: p, item }, { op: 'draft', page: p, item: null }], [{ op: 'remove', page: p, ids: [item.id] }]);
    } else if (tool === 'eraser') {
      if (g.erased.length) {
        const ids = [...new Set(g.erased.map((i) => i.id))];
        emit([{ op: 'remove', page: p, ids }], g.erased.map((item) => ({ op: 'add', page: p, item }) as BoardOp));
      }
      setHidden(new Set());
    } else if (tool === 'move' && g.moving) {
      setHidden(new Set());
      if (g.moved) {
        const item = translate(g.moving, x - g.x0, y - g.y0);
        emit([{ op: 'update', page: p, item }, { op: 'draft', page: p, item: null }], [{ op: 'update', page: p, item: g.moving }]);
      } else if (g.moving.t === 'table') {
        const t = g.moving;
        const cols = t.cells[0]?.length ?? 0;
        const c = cols - 1 - Math.floor((x - t.x) / t.cellW);
        const r = Math.floor((y - t.y) / t.cellH);
        if (r >= 0 && c >= 0 && r < t.cells.length && c < cols) setDialog({ kind: 'cell', table: t, r, c });
      } else if (g.moving.t === 'text') {
        setDialog({ kind: 'text', x: g.moving.x, y: g.moving.y, edit: g.moving });
      }
    } else if (tool === 'laser') {
      setLocalPointer(null);
      emit([{ op: 'pointer', x: null, y: null }]);
    } else {
      const item = shapeFrom(g.x0, g.y0, x, y, uid());
      if (item && Math.max(bounds(item).w, bounds(item).h) > 4) emit([{ op: 'add', page: p, item }, { op: 'draft', page: p, item: null }], [{ op: 'remove', page: p, ids: [item.id] }]);
      else emit([{ op: 'draft', page: p, item: null }]);
    }
    setDraft(null);
  };

  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    onOps?.(last.undo);
    setHistory((h) => h.slice(0, -1));
    setFuture((f) => [...f, last]);
  };
  const redo = () => {
    const next = future[future.length - 1];
    if (!next) return;
    onOps?.(next.redo);
    setFuture((f) => f.slice(0, -1));
    setHistory((h) => [...h, next]);
  };

  // Keyboard: Ctrl+Z / Ctrl+Shift+Z, Delete for the selection.
  useEffect(() => {
    if (!editable) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,textarea')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected) deleteSelected();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const deleteSelected = () => {
    const it = page.items.find((x) => x.id === selected);
    if (!it) return;
    emit([{ op: 'remove', page: state.page, ids: [it.id] }], [{ op: 'add', page: state.page, item: it }]);
    setSelected(null);
  };

  const download = () => {
    const off = document.createElement('canvas');
    off.width = BOARD_W;
    off.height = BOARD_H;
    drawPage(off.getContext('2d')!, page);
    const a = document.createElement('a');
    a.href = off.toDataURL('image/png');
    a.download = `board-${pageIndex + 1}.png`;
    a.click();
  };

  const cursor = editable ? (tool === 'move' ? 'grab' : tool === 'text' ? 'text' : tool === 'laser' ? 'none' : 'crosshair') : 'default';
  const shownPointer = editable ? localPointer : pointer;

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div ref={wrap} className="relative grid min-h-0 flex-1 place-items-center overflow-hidden">
        <div className="relative shadow-e3" style={{ width: BOARD_W * scale, height: BOARD_H * scale }}>
          <canvas
            ref={canvas}
            className="block size-full rounded-sm"
            style={{ touchAction: editable ? 'none' : 'auto', cursor }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            aria-label="السبورة"
            role="img"
          />
          {shownPointer && (
            <span
              className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-live shadow-[0_0_16px_6px_rgb(225_29_72_/_0.6)]"
              style={{ left: shownPointer.x * scale, top: shownPointer.y * scale }}
              aria-hidden="true"
            />
          )}
          {editable && selected && (
            <Button size="sm" variant="danger" className="absolute top-2 left-2" onClick={deleteSelected}>
              <Trash2 /> امسح
            </Button>
          )}
        </div>
      </div>

      {editable ? (
        <Toolbar>
          <ToolGroup>
            <ToolBtn on={tool === 'pen'} onClick={() => setTool('pen')} label="قلم">
              <Pen />
            </ToolBtn>
            <ToolBtn on={tool === 'marker'} onClick={() => setTool('marker')} label="ماركر">
              <Wand2 />
            </ToolBtn>
            <ToolBtn on={tool === 'highlighter'} onClick={() => setTool('highlighter')} label="هايلايتر">
              <Highlighter />
            </ToolBtn>
            <ToolBtn on={tool === 'eraser'} onClick={() => setTool('eraser')} label="ممحاة">
              <Eraser />
            </ToolBtn>
          </ToolGroup>
          <ToolGroup>
            <ToolBtn on={tool === 'ruler'} onClick={() => setTool('ruler')} label="مسطرة">
              <Ruler />
            </ToolBtn>
            <ToolBtn on={tool === 'line'} onClick={() => setTool('line')} label="خط">
              <Minus />
            </ToolBtn>
            <ToolBtn on={tool === 'arrow'} onClick={() => setTool('arrow')} label="سهم">
              <ArrowUpRight />
            </ToolBtn>
            <ToolBtn on={tool === 'rect'} onClick={() => setTool('rect')} label="مستطيل">
              <Square />
            </ToolBtn>
            <ToolBtn on={tool === 'ellipse'} onClick={() => setTool('ellipse')} label="دايرة">
              <Circle />
            </ToolBtn>
          </ToolGroup>
          <ToolGroup>
            <ToolBtn on={tool === 'text'} onClick={() => setTool('text')} label="كتابة">
              <Type />
            </ToolBtn>
            <ToolBtn onClick={() => setDialog({ kind: 'graph' })} label="رسم بياني">
              <LineChart />
            </ToolBtn>
            <ToolBtn onClick={() => setDialog({ kind: 'table' })} label="جدول">
              <Table2 />
            </ToolBtn>
            <ToolBtn on={tool === 'move'} onClick={() => setTool('move')} label="تحريك وتعديل">
              <Hand />
            </ToolBtn>
            <ToolBtn on={tool === 'laser'} onClick={() => setTool('laser')} label="مؤشر ليزر">
              <Zap />
            </ToolBtn>
          </ToolGroup>
          <ToolGroup>
            {INKS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`لون ${c}`}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className={cn('size-7 shrink-0 rounded-full ring-offset-2 ring-offset-stage transition-transform', color === c ? 'scale-110 ring-2 ring-white' : 'ring-1 ring-white/25')}
                style={{ background: c }}
              />
            ))}
          </ToolGroup>
          <ToolGroup>
            {WIDTHS.map((w) => (
              <ToolBtn key={w} on={width === w} onClick={() => setWidth(w)} label={`سُمك ${w}`}>
                <span className="rounded-full bg-current" style={{ width: w + 3, height: w + 3 }} />
              </ToolBtn>
            ))}
          </ToolGroup>
          <ToolGroup>
            <ToolBtn onClick={undo} label="تراجع" disabled={!history.length}>
              <Undo2 />
            </ToolBtn>
            <ToolBtn onClick={redo} label="إعادة" disabled={!future.length}>
              <Redo2 />
            </ToolBtn>
            <ToolBtn
              onClick={() => {
                if (!page.items.length) return;
                emit([{ op: 'clear', page: state.page }], page.items.map((item) => ({ op: 'add', page: state.page, item }) as BoardOp));
                toast('اتمسحت الصفحة', { action: { label: 'تراجع', onClick: undo } });
              }}
              label="امسح الصفحة"
            >
              <Trash2 />
            </ToolBtn>
          </ToolGroup>
          <ToolGroup>
            <select
              value={page.bg}
              onChange={(e) => emit([{ op: 'page', page: state.page, bg: e.target.value as BoardBackground }])}
              className="h-10 rounded-full bg-white/10 px-3 text-label-md text-on-stage outline-none"
              aria-label="خلفية الصفحة"
            >
              {BGS.map((b) => (
                <option key={b.v} value={b.v} className="text-black">
                  {b.label}
                </option>
              ))}
            </select>
            <ToolBtn onClick={() => state.page > 0 && emit([{ op: 'page', page: state.page - 1 }])} label="الصفحة اللي فاتت" disabled={state.page === 0}>
              <ChevronRight />
            </ToolBtn>
            <span className="min-w-12 text-center font-num text-label-lg text-on-stage">
              {state.page + 1}/{state.pages.length}
            </span>
            <ToolBtn onClick={() => emit([{ op: 'page', page: state.page + 1 }])} label={state.page + 1 < state.pages.length ? 'الصفحة الجاية' : 'صفحة جديدة'}>
              {state.page + 1 < state.pages.length ? <ChevronLeft /> : <Plus />}
            </ToolBtn>
          </ToolGroup>
        </Toolbar>
      ) : (
        <div className="flex items-center justify-end gap-2 px-3 py-2">
          <button type="button" onClick={download} className="state-layer inline-flex h-9 items-center gap-1.5 rounded-full bg-white/10 px-3 text-label-md text-on-stage">
            <Download className="size-4" /> حمّل الصفحة
          </button>
        </div>
      )}

      {editable && <BoardDialogs dialog={dialog} setDialog={setDialog} color={color} page={state.page} emit={emit} bg={page.bg} />}
    </div>
  );
}

function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="scrollbar-none flex items-center gap-1 overflow-x-auto border-t border-white/10 bg-stage-panel px-2 py-2" role="toolbar" aria-label="أدوات السبورة">
      {children}
    </div>
  );
}

function ToolGroup({ children }: { children: ReactNode }) {
  return <div className="flex shrink-0 items-center gap-1 border-e border-white/10 px-1.5 last:border-0">{children}</div>;
}

function ToolBtn({ on, onClick, label, children, disabled }: { on?: boolean; onClick: () => void; label: string; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={on}
      disabled={disabled}
      className={cn('state-layer grid size-10 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-30 [&_svg]:size-5', on ? 'bg-white text-black' : 'text-on-stage')}
    >
      {children}
    </button>
  );
}

const FN_COLORS = ['#e11d48', '#2563eb', '#16a34a'];

function BoardDialogs({
  dialog,
  setDialog,
  color,
  page,
  emit,
  bg,
}: {
  dialog: DialogState;
  setDialog: (d: DialogState) => void;
  color: string;
  page: number;
  emit: (ops: BoardOp[], undo?: BoardOp[]) => void;
  bg: BoardBackground;
}) {
  const [text, setText] = useState('');
  const [size, setSize] = useState(36);
  const [fns, setFns] = useState(['x^2 - 4', '', '']);
  const [range, setRange] = useState({ xMin: '-5', xMax: '5', yMin: '-5', yMax: '10' });
  const [dims, setDims] = useState({ rows: '4', cols: '3' });
  const [cell, setCell] = useState('');

  useEffect(() => {
    if (dialog?.kind === 'text') setText(dialog.edit?.text ?? '');
    if (dialog?.kind === 'cell') setCell(dialog.table.cells[dialog.r]?.[dialog.c] ?? '');
  }, [dialog]);

  const close = () => setDialog(null);
  const errors = fns.map((f) => (f.trim() ? compile(f).error : null));

  return (
    <>
      <Sheet
        open={dialog?.kind === 'text'}
        onOpenChange={(o) => !o && close()}
        title={dialog?.kind === 'text' && dialog.edit ? 'عدّل الكتابة' : 'اكتب على السبورة'}
        footer={
          <Button
            block
            disabled={!text.trim()}
            onClick={() => {
              if (dialog?.kind !== 'text') return;
              if (dialog.edit) {
                const item = { ...dialog.edit, text };
                emit([{ op: 'update', page, item }], [{ op: 'update', page, item: dialog.edit }]);
              } else {
                const item: BoardItem = { id: uid(), t: 'text', color, size, x: dialog.x, y: dialog.y, text };
                emit([{ op: 'add', page, item }], [{ op: 'remove', page, ids: [item.id] }]);
              }
              close();
            }}
          >
            حط على السبورة
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <TextArea value={text} onChange={(e) => setText(e.target.value)} rows={3} autoFocus aria-label="النص" placeholder="قانون أوم: V = I × R" />
          {!(dialog?.kind === 'text' && dialog.edit) && (
            <div className="flex gap-2">
              {[24, 36, 56].map((s) => (
                <Button key={s} size="sm" variant={size === s ? 'tonal' : 'outlined'} onClick={() => setSize(s)}>
                  {s === 24 ? 'صغير' : s === 36 ? 'متوسط' : 'كبير'}
                </Button>
              ))}
            </div>
          )}
        </div>
      </Sheet>

      <Sheet
        open={dialog?.kind === 'graph'}
        onOpenChange={(o) => !o && close()}
        title="رسم بياني"
        description="اكتب الدالة زي ما بتكتبها في الكشكول: x^2 - 3x + 2، sin(x)، 2(x+1)، √x"
        footer={
          <Button
            block
            disabled={!fns.some((f) => f.trim()) || errors.some(Boolean)}
            onClick={() => {
              const r = { xMin: Number(range.xMin), xMax: Number(range.xMax), yMin: Number(range.yMin), yMax: Number(range.yMax) };
              if (!(r.xMax > r.xMin) || !(r.yMax > r.yMin)) {
                toast('المدى مش مظبوط');
                return;
              }
              const item: BoardItem = {
                id: uid(),
                t: 'graph',
                color,
                x: 440,
                y: 150,
                w: 720,
                h: 600,
                fns: fns.map((expr, i) => ({ expr: expr.trim(), color: FN_COLORS[i]! })).filter((f) => f.expr),
                ...r,
              };
              emit([{ op: 'add', page, item }], [{ op: 'remove', page, ids: [item.id] }]);
              close();
            }}
          >
            ارسم
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          {fns.map((f, i) => (
            <TextField
              key={i}
              label={`y${i + 1} =`}
              ltr
              value={f}
              onChange={(e) => setFns(fns.map((x, j) => (j === i ? e.target.value : x)))}
              error={errors[i]}
              placeholder={i === 0 ? 'x^2 - 4' : 'اختياري'}
              className="font-num"
              style={{ borderInlineStart: `4px solid ${FN_COLORS[i]}` }}
            />
          ))}
          <div className="grid grid-cols-4 gap-2">
            {(['xMin', 'xMax', 'yMin', 'yMax'] as const).map((k) => (
              <TextField key={k} label={k} type="number" ltr value={range[k]} onChange={(e) => setRange({ ...range, [k]: e.target.value })} className="font-num" />
            ))}
          </div>
          <Banner tone="info">بعد الرسم: أداة «تحريك» تنقل الرسم لأي مكان، والممحاة تشيله.</Banner>
        </div>
      </Sheet>

      <Sheet
        open={dialog?.kind === 'table'}
        onOpenChange={(o) => !o && close()}
        title="جدول"
        description="بعد ما يتحط، دوس على أي خانة بأداة «تحريك» عشان تكتب فيها."
        footer={
          <Button
            block
            onClick={() => {
              const rows = Math.min(10, Math.max(1, Number(dims.rows) || 3));
              const cols = Math.min(8, Math.max(1, Number(dims.cols) || 3));
              const cellW = Math.min(200, Math.floor(1400 / cols));
              const cellH = Math.min(64, Math.floor(760 / rows));
              const item: BoardItem = {
                id: uid(),
                t: 'table',
                color: bg === 'chalk' ? '#94a3b8' : '#334155',
                x: Math.round((BOARD_W - cols * cellW) / 2),
                y: Math.round((BOARD_H - rows * cellH) / 2),
                cellW,
                cellH,
                cells: Array.from({ length: rows }, () => Array.from({ length: cols }, () => '')),
              };
              emit([{ op: 'add', page, item }], [{ op: 'remove', page, ids: [item.id] }]);
              close();
            }}
          >
            حط الجدول
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <TextField label="صفوف" type="number" ltr value={dims.rows} onChange={(e) => setDims({ ...dims, rows: e.target.value })} />
          <TextField label="أعمدة" type="number" ltr value={dims.cols} onChange={(e) => setDims({ ...dims, cols: e.target.value })} />
        </div>
      </Sheet>

      <Sheet
        open={dialog?.kind === 'cell'}
        onOpenChange={(o) => !o && close()}
        title="اكتب في الخانة"
        footer={
          <Button
            block
            onClick={() => {
              if (dialog?.kind !== 'cell') return;
              const t = dialog.table;
              const cells = t.cells.map((row, r) => row.map((v, c) => (r === dialog.r && c === dialog.c ? cell : v)));
              emit([{ op: 'update', page, item: { ...t, cells } }], [{ op: 'update', page, item: t }]);
              close();
            }}
          >
            تمام
          </Button>
        }
      >
        <TextField value={cell} onChange={(e) => setCell(e.target.value)} autoFocus aria-label="الخانة" />
      </Sheet>
    </>
  );
}

