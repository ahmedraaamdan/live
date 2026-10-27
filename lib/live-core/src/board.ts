/**
 * The live whiteboard's document model, shared by the API (which stores and
 * relays ops) and the app (which draws them).
 *
 * A board is a list of pages; a page is a list of items in a fixed
 * 1600×900 (16:9) coordinate space, scaled to whatever screen shows it, so
 * every student sees exactly what the teacher drew, crisp at any size.
 *
 * The teacher's app sends ops; the API appends them (except the ephemeral
 * ones) and fans them out over the lecture's event stream. Anyone joining
 * late, or reviewing after class, replays the stored ops.
 */

export const BOARD_W = 1600;
export const BOARD_H = 900;

export type PenKind = "pen" | "marker" | "highlighter";
export type BoardBackground = "plain" | "grid" | "lined" | "dots" | "chalk";

interface Base {
  id: string;
  color: string;
}

export type BoardItem =
  | (Base & { t: "stroke"; pen: PenKind; width: number; /** x0,y0,x1,y1,… */ points: number[] })
  | (Base & { t: "line"; width: number; x1: number; y1: number; x2: number; y2: number; arrow?: boolean; ruler?: boolean })
  | (Base & { t: "rect" | "ellipse"; width: number; x: number; y: number; w: number; h: number })
  | (Base & { t: "text"; size: number; x: number; y: number; text: string })
  | (Base & {
      t: "graph";
      x: number;
      y: number;
      w: number;
      h: number;
      fns: Array<{ expr: string; color: string }>;
      xMin: number;
      xMax: number;
      yMin: number;
      yMax: number;
    })
  | (Base & { t: "table"; x: number; y: number; cellW: number; cellH: number; cells: string[][] });

export type BoardOp =
  | { op: "add"; page: number; item: BoardItem }
  | { op: "update"; page: number; item: BoardItem }
  | { op: "remove"; page: number; ids: string[] }
  | { op: "clear"; page: number }
  /** Go to (creating if needed) a page; optionally change its background. */
  | { op: "page"; page: number; bg?: BoardBackground }
  /** Show the board to students (on) or go back to the camera (off). */
  | { op: "mode"; on: boolean }
  // Ephemeral: relayed live, never stored.
  | { op: "draft"; page: number; item: BoardItem | null }
  | { op: "pointer"; x: number | null; y: number | null };

export const EPHEMERAL_OPS = new Set<BoardOp["op"]>(["draft", "pointer"]);

export interface BoardPage {
  items: BoardItem[];
  bg: BoardBackground;
}

export interface BoardState {
  pages: BoardPage[];
  page: number;
  on: boolean;
}

export function emptyBoard(): BoardState {
  return { pages: [{ items: [], bg: "grid" }], page: 0, on: false };
}

/** Applies durable ops (ephemeral ones are ignored). Returns a new state. */
export function applyBoardOps(state: BoardState, ops: BoardOp[]): BoardState {
  let s: BoardState = { ...state, pages: state.pages.slice() };
  const pageAt = (i: number) => {
    while (s.pages.length <= i) s.pages.push({ items: [], bg: s.pages[s.pages.length - 1]?.bg ?? "grid" });
    const p = s.pages[i]!;
    const copy = { ...p, items: p.items.slice() };
    s.pages[i] = copy;
    return copy;
  };
  for (const o of ops) {
    switch (o.op) {
      case "add":
        pageAt(o.page).items.push(o.item);
        break;
      case "update": {
        const p = pageAt(o.page);
        const i = p.items.findIndex((x) => x.id === o.item.id);
        if (i >= 0) p.items[i] = o.item;
        else p.items.push(o.item);
        break;
      }
      case "remove": {
        const p = pageAt(o.page);
        const ids = new Set(o.ids);
        p.items = p.items.filter((x) => !ids.has(x.id));
        break;
      }
      case "clear":
        pageAt(o.page).items = [];
        break;
      case "page": {
        const p = pageAt(o.page);
        if (o.bg) p.bg = o.bg;
        s = { ...s, page: o.page };
        break;
      }
      case "mode":
        s = { ...s, on: o.on };
        break;
      default:
        break;
    }
  }
  return s;
}
