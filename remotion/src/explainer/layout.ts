// SystemExplainer data model and the pure parts: table resolution, card sizes, the grid auto-layout, link routing
// through the gutters between cards (lines never cross a card in an auto-laid grid) and scene timing.

// ---------- data ----------

export type Column = { name: string; type?: string; pk?: boolean; fk?: string; note?: string };
export type Status = "new" | "changed" | "removed" | "kept";
export type TableDef = {
  id: string;
  name?: string; // shown name (default: id)
  icon?: string; // Remix icon name or kit alias (default: a table icon)
  columns?: Column[];
  status?: Status;
  note?: string; // one short line under the columns
  x?: number; // explicit top-left in the 1920x1080 frame (skips the auto-layout for this card)
  y?: number;
};
export type TableRef = string | (Partial<TableDef> & { id: string });
export type Link = { from: string; to: string; label?: string }; // "table" or "table.column"
export type Merge = { from: string[]; into: string };
type SceneBase = { seconds?: number; caption?: string | string[] };
export type IntroScene = SceneBase & { type: "intro"; title: string; subtitle?: string; kicker?: string; stats?: { value: string; label: string }[] };
export type TablesScene = SceneBase & { type: "tables"; title: string; tables: TableRef[]; links?: Link[]; autoLinks?: boolean; columns?: number };
export type BeforeAfterScene = SceneBase & {
  type: "beforeAfter";
  area: string;
  before: TableRef[];
  after: TableRef[];
  merges?: Merge[];
  links?: Link[];
  autoLinks?: boolean;
  columns?: number;
  turn?: number; // caption index where the "after" side starts (default 1 when there are 2+ captions)
};
export type SummaryScene = SceneBase & { type: "summary"; title: string; items: (string | { text: string; icon?: string })[] };
export type Scene = IntroScene | TablesScene | BeforeAfterScene | SummaryScene;

export type Labels = { before: string; after: string; new: string; changed: string; removed: string; kept: string; more: string };
export const DEFAULT_LABELS: Labels = { before: "BEFORE", after: "AFTER", new: "NEW", changed: "CHANGED", removed: "REMOVED", kept: "KEPT", more: "more" };

export type ExplainerData = {
  title?: string; // project name, top right of every scene
  theme?: Record<string, string>;
  labels?: Partial<Labels>;
  music?: { file: string; volume?: number; start?: number };
  maxRows?: number; // columns shown per card before "+ n more" (default 7)
  tables?: TableDef[]; // shared definitions, referenced by id from the scenes
  scenes: Scene[];
};

export function resolveTable(ref: TableRef, lib: Map<string, TableDef>): TableDef {
  if (typeof ref === "string") return lib.get(ref) ?? { id: ref };
  return { ...(lib.get(ref.id) ?? {}), ...ref } as TableDef;
}
export const tableLib = (data: ExplainerData) => new Map((data.tables ?? []).map((t) => [t.id, t]));

// ---------- card geometry (logical px, before the scene scale) ----------

export const HEAD = 62;
export const PADV = 10;
export const ROW = 42;
export const NOTE_H = 64;
export const PADX = 20;
export const BADGE_W = 52;
export const MONO_CHAR = 0.6; // advance of a monospace glyph, in em
const SANS_CHAR = 0.56; // rough average for Inter-like sans (overestimates a little on purpose)

export type CardGeom = {
  key: string;
  def: TableDef;
  x: number;
  y: number;
  s: number; // scale applied to the logical card
  W: number; // logical width
  H: number; // logical height
  w: number; // on-screen width (W * s)
  h: number;
  cols: Column[]; // columns shown
  more: number; // hidden columns
  showTypes: boolean;
  row: number;
  free: boolean; // explicit x/y
};

const visible = (def: TableDef, maxRows: number) => (def.columns ?? []).slice(0, (def.columns ?? []).length > maxRows ? Math.max(0, maxRows - 1) : maxRows);
function cardHeight(def: TableDef, maxRows: number) {
  const all = def.columns ?? [];
  if (maxRows === 0 || !all.length) return HEAD + (def.note && maxRows ? NOTE_H : 0);
  const shown = visible(def, maxRows).length + (all.length > maxRows ? 1 : 0);
  return HEAD + PADV * 2 + shown * ROW + (def.note ? NOTE_H : 0);
}
function cardWidth(def: TableDef, maxRows: number, showTypes: boolean, statusLabel: (s: Status) => string) {
  const name = (def.name ?? def.id).length * MONO_CHAR * 25;
  const badge = def.status ? 24 + statusLabel(def.status).length * 0.68 * 17 + 22 : 0;
  // flex gaps between the pieces are counted, plus a little slack so nothing is ellipsized
  let w = PADX + 28 + 12 + name + 12 + badge + PADX + 16;
  for (const c of visible(def, maxRows)) {
    const right = c.note ? 28 + c.note.length * SANS_CHAR * 21 : showTypes && c.type ? 28 + c.type.length * MONO_CHAR * 22 : 0;
    w = Math.max(w, PADX + BADGE_W + 14 + c.name.length * MONO_CHAR * 22 + right + PADX + 16);
  }
  return w;
}

export type Area = { x: number; y: number; w: number; h: number };
export type Board = { cards: CardGeom[]; s: number; gapX: number; gapY: number; rowTops: number[]; centerX: number };

/** Lays the cards in a grid inside `area` (rows balanced, last row centered, all cards one width), scaling the whole
 *  board down when it does not fit. Leaves half a gap around the board for the link channels. */
export function layoutGrid(defs: TableDef[], area: Area, o: { columns?: number; maxRows: number; gapX?: number; gapY?: number; minW?: number; maxW?: number; prefix: string; statusLabel: (s: Status) => string }): Board {
  const gapX = o.gapX ?? 110;
  const gapY = o.gapY ?? 86;
  const n = defs.length;
  const heights = defs.map((d) => cardHeight(d, o.maxRows));
  let best: { s: number; showTypes: boolean; W: number; c: number; rows: number } | null = null;
  for (const showTypes of [true, false]) {
    const W = Math.min(o.maxW ?? 560, Math.max(o.minW ?? 300, ...defs.map((d) => cardWidth(d, o.maxRows, showTypes, o.statusLabel))));
    const fitCols = Math.max(1, Math.floor(area.w / (W + gapX)));
    const rows = o.columns ? Math.ceil(n / o.columns) : Math.ceil(n / Math.min(n, fitCols));
    const c = o.columns ?? Math.ceil(n / rows);
    let boardH = (rows - 1) * gapY;
    for (let r = 0; r < rows; r++) boardH += Math.max(0, ...heights.slice(r * c, r * c + c));
    const boardW = c * W + (c - 1) * gapX;
    const s = Math.min(1, (area.w - gapX) / boardW, (area.h - gapY) / boardH);
    if (!best || s > best.s + 0.01) best = { s, showTypes, W, c, rows };
  }
  const { s, showTypes, W, c, rows } = best!;
  const rowH = Array.from({ length: rows }, (_, r) => Math.max(0, ...heights.slice(r * c, r * c + c)));
  const boardW = (c * W + (c - 1) * gapX) * s;
  const boardH = (rowH.reduce((a, b) => a + b, 0) + (rows - 1) * gapY) * s;
  const x0 = area.x + (area.w - boardW) / 2;
  const y0 = area.y + (area.h - boardH) / 2;
  const rowTops: number[] = [];
  let y = y0;
  for (let r = 0; r < rows; r++) {
    rowTops.push(y);
    y += (rowH[r] + gapY) * s;
  }
  const cards = defs.map((def, i): CardGeom => {
    const r = Math.floor(i / c);
    const inRow = Math.min(c, n - r * c);
    const offset = ((c - inRow) * (W + gapX) * s) / 2;
    const all = def.columns ?? [];
    const cols = o.maxRows === 0 ? [] : visible(def, o.maxRows);
    const free = def.x !== undefined && def.y !== undefined;
    const H = heights[i];
    return {
      key: o.prefix + def.id,
      def,
      x: free ? def.x! : x0 + offset + (i - r * c) * (W + gapX) * s,
      y: free ? def.y! : rowTops[r],
      s,
      W,
      H,
      w: W * s,
      h: H * s,
      cols,
      more: o.maxRows === 0 ? 0 : all.length - cols.length,
      showTypes,
      row: r,
      free,
    };
  });
  return { cards, s, gapX: gapX * s, gapY: gapY * s, rowTops, centerX: area.x + area.w / 2 };
}

// ---------- links ----------

export type Route = { d: string; p1: [number, number]; p2: [number, number]; label: [number, number] };

/** "orders.customer_id" → { table: "orders", column: "customer_id" } */
export const splitRef = (ref: string) => {
  const i = ref.indexOf(".");
  return i < 0 ? { table: ref, column: null } : { table: ref.slice(0, i), column: ref.slice(i + 1) };
};

/** y of a column row (or of the header when the column is not shown). */
export function attachY(g: CardGeom, column: string | null) {
  const i = column ? g.cols.findIndex((c) => c.name === column) : -1;
  return g.y + g.s * (i < 0 ? HEAD / 2 : HEAD + PADV + i * ROW + ROW / 2);
}

function rounded(points: [number, number][], r = 14) {
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1];
    const [x, y] = points[i];
    const [nx, ny] = points[i + 1];
    const l1 = Math.hypot(x - px, y - py);
    const l2 = Math.hypot(nx - x, ny - y);
    const k = Math.min(r, l1 / 2, l2 / 2);
    if (k < 0.5) {
      d += ` L ${x} ${y}`;
      continue;
    }
    const ax = x - ((x - px) / l1) * k;
    const ay = y - ((y - py) / l1) * k;
    const bx = x + ((nx - x) / l2) * k;
    const by = y + ((ny - y) / l2) * k;
    d += ` L ${ax} ${ay} Q ${x} ${y} ${bx} ${by}`;
  }
  const last = points[points.length - 1];
  return d + ` L ${last[0]} ${last[1]}`;
}

/** Label anchor: middle of the longest horizontal segment, else middle of the longest segment. */
function labelAt(points: [number, number][]): [number, number] {
  let best: [number, number] = [(points[0][0] + points[points.length - 1][0]) / 2, (points[0][1] + points[points.length - 1][1]) / 2];
  let len = -1;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const l = Math.abs(bx - ax) * (Math.abs(by - ay) < 1 ? 2 : 1) + Math.abs(by - ay);
    if (l > len) {
      len = l;
      best = [(ax + bx) / 2, (ay + by) / 2];
    }
  }
  return best;
}

/** Route from the FK side (a) to the referenced side (b). In an auto-laid board the path runs only through the gutters
 *  between cards: out of the side, along the gutter, along the channel between rows, into the other card's side.
 *  `lane` spreads parallel links a few px apart. */
export function route(a: CardGeom, colA: string | null, b: CardGeom, colB: string | null, board: Board, lane: number): Route {
  const ya = attachY(a, colA);
  const yb = attachY(b, colB);
  const acx = a.x + a.w / 2;
  const bcx = b.x + b.w / 2;
  if (a.free || b.free || (a.row === b.row && Math.abs(Math.abs(bcx - acx) - (a.w + board.gapX)) < 2)) {
    // neighbours in a row (or hand-placed cards): an S-curve between the facing sides
    const [l, r, yl, yr] = acx < bcx ? [a, b, ya, yb] : [b, a, yb, ya];
    const x1 = l.x + l.w;
    const x2 = r.x;
    const mx = (x1 + x2) / 2;
    const p1: [number, number] = acx < bcx ? [x1, yl] : [x2, yr];
    const p2: [number, number] = acx < bcx ? [x2, yr] : [x1, yl];
    return { d: `M ${x1} ${yl} C ${mx} ${yl}, ${mx} ${yr}, ${x2} ${yr}`, p1, p2, label: [mx, (yl + yr) / 2] };
  }
  const off = lane * 9;
  const sameCol = Math.abs(bcx - acx) < a.w / 2;
  const outerRight = acx > board.centerX;
  const aRight = sameCol ? outerRight : bcx > acx;
  const bRight = sameCol ? outerRight : !aRight;
  const half = board.gapX / 2;
  const gxA = (aRight ? a.x + a.w + half : a.x - half) + off;
  const gxB = (bRight ? b.x + b.w + half : b.x - half) + off;
  const pA: [number, number] = [aRight ? a.x + a.w : a.x, ya];
  const pB: [number, number] = [bRight ? b.x + b.w : b.x, yb];
  let pts: [number, number][];
  if (Math.abs(gxA - gxB) < 2) {
    pts = [pA, [gxA, ya], [gxA, yb], pB];
  } else {
    const rowTop = (r: number) => board.rowTops[r] ?? board.rowTops[0];
    const ch = (a.row === b.row ? rowTop(a.row) : rowTop(Math.max(a.row, b.row))) - board.gapY / 2 + off;
    pts = [pA, [gxA, ya], [gxA, ch], [gxB, ch], [gxB, yb], pB];
  }
  return { d: rounded(pts), p1: pA, p2: pB, label: labelAt(pts.slice(1, -1)) };
}

/** Links of a scene: explicit ones plus one per FK column whose target table is on the board (deduplicated). */
export function sceneLinks(cards: CardGeom[], explicit: Link[] | undefined, auto: boolean) {
  const byId = new Map(cards.map((c) => [c.def.id, c]));
  const out: { a: CardGeom; colA: string | null; b: CardGeom; colB: string | null; label?: string }[] = [];
  const seen = new Set<string>();
  const add = (from: string, to: string, label?: string) => {
    const f = splitRef(from);
    const t = splitRef(to);
    const a = byId.get(f.table);
    const b = byId.get(t.table);
    if (!a || !b || a === b) return;
    const k = `${f.table}.${f.column}>${t.table}.${t.column}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ a, colA: f.column, b, colB: t.column, label });
  };
  for (const l of explicit ?? []) add(l.from, l.to, l.label);
  if (auto) for (const c of cards) for (const col of c.def.columns ?? []) if (col.fk) add(`${c.def.id}.${col.name}`, col.fk);
  return out;
}

// ---------- timing ----------

export const captionsOf = (s: Scene) => (Array.isArray(s.caption) ? s.caption : s.caption ? [s.caption] : []);
/** Seconds to read a caption comfortably (no voice: the caption is the whole message). */
export const readSeconds = (text: string) => Math.min(5.6, Math.max(2.6, 1.3 + text.split(/\s+/).filter(Boolean).length * 0.3));
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export type Plan = {
  dur: number;
  captions: { text: string; from: number; to: number }[]; // scene-relative seconds
  turn: number; // beforeAfter: when the "after" side starts
  cards: number[]; // start of each card (tables: in order; beforeAfter: the after cards)
  before: number[]; // beforeAfter: start of each before card
  links: number; // when the links start drawing
};

const HOLD = 2.4; // seconds with everything on screen before the scene ends

/** Scene timing. Without `seconds` the scene lasts as long as its build + a hold, or its captions, whichever is longer;
 *  with `seconds` the build is compressed to fit. */
export function planScene(s: Scene, nLinks: number): Plan {
  const caps = captionsOf(s);
  const fixed = s.seconds;
  if (s.type === "intro" || s.type === "summary") {
    const build = s.type === "intro" ? 1.6 + (s.stats?.length ?? 0) * 0.5 : 1.0 + s.items.length * 0.45;
    const dur = fixed ?? Math.max(build + HOLD, sum(caps.map(readSeconds)), s.type === "intro" ? 4.5 : 0);
    return { dur, captions: spread(caps, 0, dur), turn: 0, cards: [], before: [], links: dur };
  }
  if (s.type === "tables") {
    const n = s.tables.length;
    const step = 0.7;
    const linkT = 0.5 + n * step + 0.5;
    const build = linkT + nLinks * 0.3 + 0.8;
    const dur = fixed ?? Math.max(build + HOLD, sum(caps.map(readSeconds)));
    const k = Math.min(1, (dur - HOLD * 0.6) / build);
    return { dur, captions: spread(caps, 0, dur), turn: 0, cards: s.tables.map((_, i) => (0.5 + i * step) * k), before: [], links: linkT * k };
  }
  // beforeAfter
  const nb = s.before.length;
  const na = s.after.length;
  const ti = Math.min(caps.length, s.turn ?? (caps.length >= 2 ? 1 : 0));
  const pre = caps.slice(0, ti);
  const post = caps.slice(ti);
  const beforeBuild = 0.4 + nb * 0.3 + 0.6;
  let turn = Math.max(beforeBuild + 0.6, sum(pre.map(readSeconds)));
  const step = 1.15;
  const afterBuild = 0.6 + na * step + 0.3 + nLinks * 0.3 + 0.8;
  let dur = turn + Math.max(afterBuild + HOLD, sum(post.map(readSeconds)));
  let k = 1;
  if (fixed) {
    k = Math.min(1, fixed / dur);
    turn *= k;
    dur = fixed;
  }
  const cards = s.after.map((_, i) => turn + (0.6 + i * step) * k);
  return {
    dur,
    captions: [...spread(pre, 0, turn), ...spread(post, pre.length ? turn : 0, dur)],
    turn,
    cards,
    before: s.before.map((_, i) => (0.4 + i * 0.3) * k),
    links: turn + (0.6 + na * step + 0.3) * k,
  };
}

function spread(caps: string[], from: number, to: number) {
  const w = caps.map(readSeconds);
  const total = sum(w) || 1;
  let t = from;
  return caps.map((text, i) => {
    const d = ((to - from) * w[i]) / total;
    const c = { text, from: t, to: t + d };
    t += d;
    return c;
  });
}
