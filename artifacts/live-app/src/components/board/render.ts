/**
 * Draws a board page onto a 2D canvas, in board units (BOARD_W × BOARD_H);
 * the caller sets the scale. Pure drawing: no state, no events.
 */
import { BOARD_H, BOARD_W, type BoardBackground, type BoardItem, type BoardPage } from '@workspace/live-core';
import { compile } from './math';

/** Board "paper" colours. The board is its own surface (like real paper), outside light/dark theming. */
export const PAPER: Record<BoardBackground, { bg: string; line: string; ink: string }> = {
  plain: { bg: '#ffffff', line: '#e2e8f0', ink: '#0f172a' },
  grid: { bg: '#ffffff', line: '#e6ebf2', ink: '#0f172a' },
  lined: { bg: '#fffdf7', line: '#d9e3f0', ink: '#0f172a' },
  dots: { bg: '#ffffff', line: '#cbd5e1', ink: '#0f172a' },
  chalk: { bg: '#17302a', line: '#24453c', ink: '#f8fafc' },
};

/** Pixels per centimetre on the board's ruler (a 1600-wide board ≈ 40 cm across). */
export const PX_PER_CM = 40;

const FONT = '"Cairo Variable", Cairo, system-ui, sans-serif';
const NUM_FONT = '"Space Grotesk Variable", "Space Grotesk", system-ui, sans-serif';
const isArabic = (s: string) => /[؀-ۿ]/.test(s);

export function drawBackground(ctx: CanvasRenderingContext2D, bg: BoardBackground) {
  const p = PAPER[bg];
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, BOARD_W, BOARD_H);
  ctx.strokeStyle = p.line;
  ctx.fillStyle = p.line;
  ctx.lineWidth = 1;
  if (bg === 'grid' || bg === 'chalk') {
    ctx.beginPath();
    for (let x = 0; x <= BOARD_W; x += PX_PER_CM) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, BOARD_H);
    }
    for (let y = 0; y <= BOARD_H; y += PX_PER_CM) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(BOARD_W, y + 0.5);
    }
    ctx.stroke();
  } else if (bg === 'lined') {
    ctx.beginPath();
    for (let y = 60; y <= BOARD_H; y += 50) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(BOARD_W, y + 0.5);
    }
    ctx.stroke();
  } else if (bg === 'dots') {
    for (let x = PX_PER_CM; x < BOARD_W; x += PX_PER_CM) for (let y = PX_PER_CM; y < BOARD_H; y += PX_PER_CM) ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
  }
}

function strokePath(ctx: CanvasRenderingContext2D, pts: number[]) {
  ctx.beginPath();
  if (pts.length < 4) {
    ctx.arc(pts[0] ?? 0, pts[1] ?? 0, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
    return;
  }
  ctx.moveTo(pts[0]!, pts[1]!);
  // Quadratic curves through midpoints: smooth ink from sparse samples.
  for (let i = 2; i < pts.length - 2; i += 2) {
    const mx = (pts[i]! + pts[i + 2]!) / 2;
    const my = (pts[i + 1]! + pts[i + 3]!) / 2;
    ctx.quadraticCurveTo(pts[i]!, pts[i + 1]!, mx, my);
  }
  ctx.lineTo(pts[pts.length - 2]!, pts[pts.length - 1]!);
  ctx.stroke();
}

function arrowHead(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, size: number) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - size * Math.cos(a - 0.45), y2 - size * Math.sin(a - 0.45));
  ctx.lineTo(x2 - size * Math.cos(a + 0.45), y2 - size * Math.sin(a + 0.45));
  ctx.closePath();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
}

export function lineMeasure(x1: number, y1: number, x2: number, y2: number) {
  const len = Math.hypot(x2 - x1, y2 - y1) / PX_PER_CM;
  let deg = (Math.atan2(-(y2 - y1), x2 - x1) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return { cm: len, deg };
}

function pill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  ctx.font = `600 20px ${NUM_FONT}`;
  const w = ctx.measureText(text).width + 20;
  ctx.fillStyle = 'rgba(15,23,42,.85)';
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - 16, w, 32, 16);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.save();
  ctx.direction = 'rtl';
  ctx.fillText(text, x, y + 1);
  ctx.restore();
}

function drawRuler(ctx: CanvasRenderingContext2D, it: Extract<BoardItem, { t: 'line' }>) {
  const { x1, y1, x2, y2 } = it;
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 1) return;
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  // Tick marks every half centimetre, like a real ruler.
  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let d = 0, i = 0; d <= len + 0.1; d += PX_PER_CM / 2, i++) {
    const tick = i % 2 === 0 ? 14 : 8;
    const px = x1 + ux * d;
    const py = y1 + uy * d;
    ctx.moveTo(px, py);
    ctx.lineTo(px - uy * tick, py + ux * tick);
  }
  ctx.stroke();
  ctx.restore();
  const m = lineMeasure(x1, y1, x2, y2);
  pill(ctx, `${m.cm.toFixed(1)} سم · ${Math.round(m.deg)}°`, (x1 + x2) / 2 + uy * 34, (y1 + y2) / 2 - ux * 34);
}

function niceStep(range: number) {
  const raw = range / 10;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p;
}

function drawGraph(ctx: CanvasRenderingContext2D, g: Extract<BoardItem, { t: 'graph' }>, ink: string) {
  const { x, y, w, h, xMin, xMax, yMin, yMax } = g;
  const sx = (v: number) => x + ((v - xMin) / (xMax - xMin)) * w;
  const sy = (v: number) => y + h - ((v - yMin) / (yMax - yMin)) * h;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,.92)';
  ctx.fillRect(x, y, w, h);
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  // Grid
  const xs = niceStep(xMax - xMin);
  const ys = niceStep(yMax - yMin);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let v = Math.ceil(xMin / xs) * xs; v <= xMax; v += xs) {
    ctx.moveTo(sx(v), y);
    ctx.lineTo(sx(v), y + h);
  }
  for (let v = Math.ceil(yMin / ys) * ys; v <= yMax; v += ys) {
    ctx.moveTo(x, sy(v));
    ctx.lineTo(x + w, sy(v));
  }
  ctx.stroke();
  // Axes and labels
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const ax = Math.min(Math.max(sx(0), x), x + w);
  const ay = Math.min(Math.max(sy(0), y), y + h);
  ctx.moveTo(x, ay);
  ctx.lineTo(x + w, ay);
  ctx.moveTo(ax, y);
  ctx.lineTo(ax, y + h);
  ctx.stroke();
  ctx.fillStyle = '#475569';
  ctx.font = `500 15px ${NUM_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const fmt = (v: number) => String(Math.round(v * 100) / 100);
  for (let v = Math.ceil(xMin / xs) * xs; v <= xMax; v += xs) if (Math.abs(v) > xs / 2) ctx.fillText(fmt(v), sx(v), Math.min(ay + 6, y + h - 18));
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let v = Math.ceil(yMin / ys) * ys; v <= yMax; v += ys) if (Math.abs(v) > ys / 2) ctx.fillText(fmt(v), Math.max(ax - 6, x + 30), sy(v));
  // Curves: sampled per pixel, broken at gaps and asymptotes.
  for (const f of g.fns) {
    const { fn } = compile(f.expr);
    if (!fn) continue;
    ctx.strokeStyle = f.color;
    ctx.lineWidth = 3.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let pen = false;
    let prev = NaN;
    for (let px = 0; px <= w; px += 1) {
      const xv = xMin + (px / w) * (xMax - xMin);
      const yv = fn(xv);
      const ok = Number.isFinite(yv) && Math.abs(yv - (Number.isFinite(prev) ? prev : yv)) < (yMax - yMin) * 2;
      if (!ok) {
        pen = false;
      } else if (!pen) {
        ctx.moveTo(x + px, sy(yv));
        pen = true;
      } else ctx.lineTo(x + px, sy(yv));
      prev = yv;
    }
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);
  // Legend
  ctx.font = `600 18px ${NUM_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  g.fns.forEach((f, i) => {
    ctx.fillStyle = f.color;
    ctx.fillText(`y = ${f.expr}`, x + 10, y + 8 + i * 24);
  });
  void ink;
}

function drawTable(ctx: CanvasRenderingContext2D, t: Extract<BoardItem, { t: 'table' }>, ink: string) {
  const rows = t.cells.length;
  const cols = t.cells[0]?.length ?? 0;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.fillRect(t.x, t.y, cols * t.cellW, rows * t.cellH);
  ctx.fillStyle = 'rgba(37,99,235,.10)';
  ctx.fillRect(t.x, t.y, cols * t.cellW, t.cellH);
  ctx.strokeStyle = t.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let r = 0; r <= rows; r++) {
    ctx.moveTo(t.x, t.y + r * t.cellH);
    ctx.lineTo(t.x + cols * t.cellW, t.y + r * t.cellH);
  }
  for (let c = 0; c <= cols; c++) {
    ctx.moveTo(t.x + c * t.cellW, t.y);
    ctx.lineTo(t.x + c * t.cellW, t.y + rows * t.cellH);
  }
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#0f172a';
  t.cells.forEach((row, r) =>
    row.forEach((text, c) => {
      if (!text) return;
      ctx.font = `${r === 0 ? 700 : 500} ${Math.min(26, t.cellH * 0.45)}px ${isArabic(text) ? FONT : NUM_FONT}`;
      // Columns run right-to-left: the first column is on the right, as in an Arabic notebook.
      const cx = t.x + (cols - c - 0.5) * t.cellW;
      ctx.fillText(text, cx, t.y + (r + 0.5) * t.cellH, t.cellW - 10);
    }),
  );
  ctx.restore();
  void ink;
}

export function drawItem(ctx: CanvasRenderingContext2D, it: BoardItem, ink: string) {
  ctx.save();
  ctx.strokeStyle = it.color;
  ctx.fillStyle = it.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (it.t) {
    case 'stroke':
      ctx.lineWidth = it.pen === 'highlighter' ? it.width * 4 : it.pen === 'marker' ? it.width * 2 : it.width;
      if (it.pen === 'highlighter') {
        ctx.globalAlpha = 0.32;
        ctx.lineCap = 'butt';
      }
      strokePath(ctx, it.points);
      break;
    case 'line':
      ctx.lineWidth = it.width;
      ctx.beginPath();
      ctx.moveTo(it.x1, it.y1);
      ctx.lineTo(it.x2, it.y2);
      ctx.stroke();
      if (it.arrow) arrowHead(ctx, it.x1, it.y1, it.x2, it.y2, 10 + it.width * 3);
      if (it.ruler) drawRuler(ctx, it);
      break;
    case 'rect':
      ctx.lineWidth = it.width;
      ctx.strokeRect(it.x, it.y, it.w, it.h);
      break;
    case 'ellipse':
      ctx.lineWidth = it.width;
      ctx.beginPath();
      ctx.ellipse(it.x + it.w / 2, it.y + it.h / 2, Math.abs(it.w / 2), Math.abs(it.h / 2), 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'text': {
      const ar = isArabic(it.text);
      ctx.font = `600 ${it.size}px ${ar ? FONT : NUM_FONT}`;
      ctx.textBaseline = 'top';
      ctx.textAlign = ar ? 'right' : 'left';
      ctx.direction = ar ? 'rtl' : 'ltr';
      it.text.split('\n').forEach((line, i) => ctx.fillText(line, it.x, it.y + i * it.size * 1.35));
      break;
    }
    case 'graph':
      drawGraph(ctx, it, ink);
      break;
    case 'table':
      drawTable(ctx, it, ink);
      break;
  }
  ctx.restore();
}

export function drawPage(ctx: CanvasRenderingContext2D, page: BoardPage, extra: BoardItem[] = []) {
  // The page is RTL and canvases inherit it, which would print "-4" as "4-".
  // Numbers and formulas are LTR; Arabic text items switch to RTL themselves.
  ctx.direction = 'ltr';
  drawBackground(ctx, page.bg);
  const ink = PAPER[page.bg].ink;
  for (const it of page.items) drawItem(ctx, it, ink);
  for (const it of extra) drawItem(ctx, it, ink);
}

/** Bounding box in board units, for hit-testing and selection. */
export function bounds(it: BoardItem): { x: number; y: number; w: number; h: number } {
  switch (it.t) {
    case 'stroke': {
      let x0 = Infinity,
        y0 = Infinity,
        x1 = -Infinity,
        y1 = -Infinity;
      for (let i = 0; i < it.points.length; i += 2) {
        x0 = Math.min(x0, it.points[i]!);
        x1 = Math.max(x1, it.points[i]!);
        y0 = Math.min(y0, it.points[i + 1]!);
        y1 = Math.max(y1, it.points[i + 1]!);
      }
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }
    case 'line':
      return { x: Math.min(it.x1, it.x2), y: Math.min(it.y1, it.y2), w: Math.abs(it.x2 - it.x1), h: Math.abs(it.y2 - it.y1) };
    case 'rect':
    case 'ellipse':
    case 'graph':
      return { x: Math.min(it.x, it.x + it.w), y: Math.min(it.y, it.y + it.h), w: Math.abs(it.w), h: Math.abs(it.h) };
    case 'text': {
      const lines = it.text.split('\n');
      const w = Math.max(...lines.map((l) => l.length)) * it.size * 0.55;
      const ar = isArabic(it.text);
      return { x: ar ? it.x - w : it.x, y: it.y, w, h: lines.length * it.size * 1.35 };
    }
    case 'table':
      return { x: it.x, y: it.y, w: (it.cells[0]?.length ?? 0) * it.cellW, h: it.cells.length * it.cellH };
  }
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2)) : 0;
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** Does a point (within r) touch the item? Strokes and lines test their path; the rest, their box. */
export function hits(it: BoardItem, x: number, y: number, r: number): boolean {
  if (it.t === 'stroke') {
    const pts = it.points;
    if (pts.length < 4) return Math.hypot(x - pts[0]!, y - pts[1]!) <= r + it.width;
    for (let i = 0; i < pts.length - 2; i += 2) if (distToSegment(x, y, pts[i]!, pts[i + 1]!, pts[i + 2]!, pts[i + 3]!) <= r + it.width) return true;
    return false;
  }
  if (it.t === 'line') return distToSegment(x, y, it.x1, it.y1, it.x2, it.y2) <= r + it.width;
  const b = bounds(it);
  return x >= b.x - r && x <= b.x + b.w + r && y >= b.y - r && y <= b.y + b.h + r;
}

/** Moves an item by (dx, dy). */
export function translate(it: BoardItem, dx: number, dy: number): BoardItem {
  switch (it.t) {
    case 'stroke':
      return { ...it, points: it.points.map((v, i) => Math.round((v + (i % 2 ? dy : dx)) * 10) / 10) };
    case 'line':
      return { ...it, x1: it.x1 + dx, y1: it.y1 + dy, x2: it.x2 + dx, y2: it.y2 + dy };
    default:
      return { ...it, x: it.x + dx, y: it.y + dy };
  }
}
