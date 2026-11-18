// SystemExplainer: internal explainer of a system / database architecture, from data (public/<slug>/explainer.json).
// 16:9, no voice, big caption bar, low music. Database tables assemble as cards (columns cascading in, PK/FK badges),
// relationship lines draw between them through the gutters, "before → after" scenes send the old tables flying into
// the new ones. Data model, auto-layout, routing and timing: ./layout.ts. Example: examples/example-coffee/system-explainer.
import React, { useEffect, useMemo, useState } from "react";
import { AbsoluteFill, Audio, CalculateMetadataFunction, Easing, Sequence, continueRender, delayRender, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { RiArrowRightLine, RiCheckLine, RiTable2 } from "@remixicon/react";
import { FPS, PLACEHOLDER_SECONDS } from "../components/formats";
import { fetchJson } from "../components/theme";
import { Placeholder } from "../components/Placeholder";
import { DEFAULT_AD_THEME, AdTheme, Headline, getFont, hasFile, icon, mediaPath } from "../videos/kit";
import {
  Area,
  BeforeAfterScene,
  Board,
  CardGeom,
  DEFAULT_LABELS,
  ExplainerData,
  HEAD,
  IntroScene,
  Labels,
  PADV,
  PADX,
  Plan,
  ROW,
  BADGE_W,
  NOTE_H,
  Scene,
  Status,
  SummaryScene,
  TablesScene,
  layoutGrid,
  planScene,
  resolveTable,
  route,
  sceneLinks,
  tableLib,
} from "./layout";

const W = 1920;
const H = 1080;

// ---------- theme ----------

/** Ad theme + a monospace font and the status/key colors. Colors in hex. */
export type ExplainerTheme = AdTheme & { mono: string; card: string; pk: string; fk: string; new: string; changed: string; removed: string };
const withExplainerTheme = (t?: Record<string, string>): ExplainerTheme => {
  const base = { ...DEFAULT_AD_THEME, background: "#0c0d10", surface: "#15171c", ...(t ?? {}) } as AdTheme & Record<string, string>;
  return {
    ...base,
    mono: t?.mono ?? "JetBrains Mono",
    card: t?.card ?? base.surface,
    pk: t?.pk ?? base.highlight,
    fk: t?.fk ?? "#5eead4",
    new: t?.new ?? "#4ade80",
    changed: t?.changed ?? "#fbbf24",
    removed: t?.removed ?? "#f87171",
  };
};
/** hex → rgba; anything that is not hex is returned as is. */
const alpha = (c: string, a: number) => {
  const h = c.replace("#", "");
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(h)) return c;
  const n = parseInt(h.length === 3 ? h.split("").map((x) => x + x).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

type Fonts = { display: string; body: string; mono: string };
function useFonts(theme: ExplainerTheme): Fonts {
  const list = [getFont(theme.display), getFont(theme.body), getFont(theme.mono)];
  const [handle] = useState(() => delayRender("explainer fonts"));
  useEffect(() => {
    Promise.all(list.map((f) => f.done)).then(() => continueRender(handle));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle]);
  return { display: `"${list[0].family}", sans-serif`, body: `"${list[1].family}", sans-serif`, mono: `"${list[2].family}", monospace` };
}

// ---------- metadata ----------

type Props = { slug: string; data?: ExplainerData; plans?: Plan[] };

const linkCount = (s: Scene, data: ExplainerData) => {
  if (s.type !== "tables" && s.type !== "beforeAfter") return 0;
  const lib = tableLib(data);
  const defs = (s.type === "tables" ? s.tables : s.after).map((r) => resolveTable(r, lib));
  const fake = defs.map((def) => ({ def }) as CardGeom);
  return sceneLinks(fake, s.links, s.autoLinks !== false).length;
};

export const calculateSystemExplainerMetadata: CalculateMetadataFunction<Props> = async ({ props }) => {
  const data = props.slug ? await fetchJson<ExplainerData>(staticFile(`${props.slug}/explainer.json`)) : null;
  if (!data?.scenes?.length) return { durationInFrames: PLACEHOLDER_SECONDS * FPS, width: W, height: H, props };
  const plans = data.scenes.map((s) => planScene(s, linkCount(s, data)));
  const total = plans.reduce((a, p) => a + p.dur, 0);
  return { durationInFrames: Math.ceil(total * FPS), width: W, height: H, props: { ...props, data, plans } };
};

// ---------- helpers ----------

const ease = Easing.bezier(0.33, 0, 0.2, 1);
const prog = (t: number, start: number, dur: number) => interpolate(t, [start, start + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

type Ctx = { th: ExplainerTheme; f: Fonts; labels: Labels; data: ExplainerData; maxRows: number; chapter: number; chapters: number };

/** "text with *emphasis* and `code`" */
const Rich: React.FC<{ text: string; ctx: Ctx }> = ({ text, ctx }) => (
  <>
    {text.split(/(\*[^*]+\*|`[^`]+`)/g).filter(Boolean).map((p, i) =>
      p.startsWith("*") ? (
        <span key={i} style={{ color: ctx.th.highlight }}>{p.slice(1, -1)}</span>
      ) : p.startsWith("`") ? (
        <span key={i} style={{ fontFamily: ctx.f.mono, fontSize: "0.9em", color: ctx.th.pk, background: alpha(ctx.th.pk, 0.13), padding: "0 0.25em", borderRadius: 6 }}>{p.slice(1, -1)}</span>
      ) : (
        <span key={i}>{p}</span>
      ),
    )}
  </>
);

const statusColor = (th: ExplainerTheme, s?: Status) => (s === "new" ? th.new : s === "changed" ? th.changed : s === "removed" ? th.removed : s === "kept" ? th.textDim : th.accent);

// ---------- frame ----------

export const SystemExplainer: React.FC<Props> = ({ slug, data, plans }) => {
  const th = withExplainerTheme(data?.theme);
  const f = useFonts(th);
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  if (!data?.scenes?.length || !plans) return <Placeholder title="SystemExplainer" hint={`No data: put explainer.json in public/${slug || "<slug>"}/ (see examples/example-coffee/system-explainer).`} />;
  const labels = { ...DEFAULT_LABELS, ...(data.labels ?? {}) };
  const starts: number[] = [];
  plans.reduce((t, p) => (starts.push(t), t + p.dur), 0);
  const fr = (s: number) => Math.round(s * fps);
  const chapters = data.scenes.filter((s) => s.type !== "intro").length;
  let ch = 0;
  const music = data.music?.file ? mediaPath(slug, data.music.file) : null;
  const vol = (x: number) => (data.music?.volume ?? 0.15) * Math.min(interpolate(x, [0, fps], [0, 1], { extrapolateRight: "clamp" }), interpolate(x, [durationInFrames - 1.5 * fps, durationInFrames], [1, 0], { extrapolateLeft: "clamp" }));
  return (
    <AbsoluteFill style={{ background: th.background, fontFamily: f.body, overflow: "hidden" }}>
      <Backdrop th={th} />
      {data.scenes.map((s, i) => {
        const chapter = s.type === "intro" ? 0 : ++ch;
        const from = fr(starts[i]);
        const dur = Math.max(1, fr(starts[i] + plans[i].dur) - from);
        return (
          <Sequence key={i} from={from} durationInFrames={dur}>
            <SceneView s={s} plan={plans[i]} ctx={{ th, f, labels, data, maxRows: data.maxRows ?? 7, chapter, chapters }} />
          </Sequence>
        );
      })}
      <Captions plans={plans} starts={starts} th={th} f={f} data={data} labels={labels} />
      <div style={{ position: "absolute", left: 0, bottom: 0, height: 5, width: `${(frame / durationInFrames) * 100}%`, background: th.accent, opacity: 0.85 }} />
      {music && hasFile(music) && <Audio src={staticFile(music)} startFrom={fr(data.music?.start ?? 0)} volume={vol} />}
    </AbsoluteFill>
  );
};

const Backdrop: React.FC<{ th: ExplainerTheme }> = ({ th }) => (
  <AbsoluteFill style={{ background: `radial-gradient(1200px 700px at 72% 18%, ${alpha(th.accent, 0.1)}, transparent 62%), ${th.background}` }}>
    <AbsoluteFill style={{ backgroundImage: `linear-gradient(${alpha(th.text, 0.03)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(th.text, 0.03)} 1px, transparent 1px)`, backgroundSize: "48px 48px" }} />
  </AbsoluteFill>
);

const SceneView: React.FC<{ s: Scene; plan: Plan; ctx: Ctx }> = ({ s, plan, ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const fade = Math.min(prog(t, 0, 0.35), 1 - prog(t, plan.dur - 0.3, 0.3));
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      {s.type === "intro" ? <Intro s={s} t={t} ctx={ctx} /> : s.type === "tables" ? <Tables s={s} plan={plan} t={t} ctx={ctx} /> : s.type === "beforeAfter" ? <BeforeAfter s={s} plan={plan} t={t} ctx={ctx} /> : <Summary s={s} t={t} ctx={ctx} />}
    </AbsoluteFill>
  );
};

const Header: React.FC<{ title: string; part?: string; t: number; ctx: Ctx }> = ({ title, part, t, ctx }) => {
  const p = prog(t, 0.05, 0.5);
  const { th, f } = ctx;
  return (
    <div style={{ position: "absolute", left: 70, right: 70, top: 40, height: 72, display: "flex", alignItems: "center", gap: 22, opacity: p, transform: `translateY(${(1 - p) * -10}px)` }}>
      <div style={{ fontFamily: f.mono, fontSize: 26, fontWeight: 600, color: th.highlight, border: `1.5px solid ${alpha(th.highlight, 0.45)}`, borderRadius: 10, padding: "5px 14px" }}>{String(ctx.chapter).padStart(2, "0")}</div>
      <div style={{ fontFamily: f.display, fontSize: 46, fontWeight: 700, color: th.text, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{title}</div>
      {part ? <div style={{ fontSize: 28, fontWeight: 500, color: th.textDim, whiteSpace: "nowrap" }}>· {part}</div> : null}
      <div style={{ flex: 1 }} />
      {ctx.data.title ? <div style={{ fontSize: 24, fontWeight: 500, color: th.textDim, whiteSpace: "nowrap" }}>{ctx.data.title}</div> : null}
      <div style={{ fontFamily: f.mono, fontSize: 22, color: th.textDim }}>
        {ctx.chapter}/{ctx.chapters}
      </div>
    </div>
  );
};

const Captions: React.FC<{ plans: Plan[]; starts: number[]; th: ExplainerTheme; f: Fonts; data: ExplainerData; labels: Labels }> = ({ plans, starts, th, f, data, labels }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const all = plans.flatMap((p, i) => p.captions.map((c) => ({ ...c, from: c.from + starts[i], to: c.to + starts[i] })));
  const cur = all.find((c) => t >= c.from && t < c.to);
  if (!cur) return null;
  const a = prog(t, cur.from, 0.3) * (1 - prog(t, cur.to - 0.25, 0.25));
  const len = cur.text.replace(/[*`]/g, "").length;
  const size = len > 120 ? 36 : len > 90 ? 40 : 46;
  const ctx = { th, f, labels, data, maxRows: 0, chapter: 0, chapters: 0 };
  return (
    <div style={{ position: "absolute", left: 70, right: 70, top: 906, height: 130, borderRadius: 20, background: alpha(th.surface, 0.94), border: `1.5px solid ${alpha(th.text, 0.08)}`, boxShadow: "0 12px 40px rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 56px", opacity: a, transform: `translateY(${(1 - a) * 8}px)` }}>
      <div style={{ position: "absolute", left: 0, top: 26, bottom: 26, width: 6, borderRadius: 3, background: th.accent }} />
      <div style={{ textAlign: "center", fontSize: size, fontWeight: 600, lineHeight: 1.25, color: th.text, letterSpacing: "-0.01em" }}>
        <Rich text={cur.text} ctx={ctx} />
      </div>
    </div>
  );
};

// ---------- table card ----------

const Card: React.FC<{ g: CardGeom; t: number; start: number; ctx: Ctx; glow?: number; dim?: number; strike?: number }> = ({ g, t, start, ctx, glow = 0, dim = 0, strike }) => {
  const { th, f, labels } = ctx;
  const p = prog(t, start, 0.5);
  if (p <= 0) return null;
  const st = g.def.status;
  const sc = statusColor(th, st);
  const kept = st === "kept";
  const removed = strike ?? (st === "removed" ? 1 : 0);
  const I = g.def.icon ? icon(g.def.icon) : RiTable2;
  const name = g.def.name ?? g.def.id;
  const headSize = Math.min(25, Math.floor((g.W - PADX * 2 - 42 - (st ? 120 : 0)) / (0.6 * name.length)));
  return (
    <div style={{ position: "absolute", left: g.x, top: g.y, width: g.w, height: g.h, opacity: p * (1 - 0.5 * dim) * (kept ? 0.7 : 1) * (1 - 0.35 * removed), transform: `translateY(${(1 - p) * 16}px) scale(${0.96 + 0.04 * p})` }}>
      <div
        style={{
          width: g.W,
          height: g.H,
          transform: `scale(${g.s})`,
          transformOrigin: "top left",
          borderRadius: 16,
          background: th.card,
          border: kept ? `2px dashed ${alpha(th.text, 0.25)}` : `1.5px solid ${glow > 0 ? alpha(th.accent, 0.35 + 0.6 * glow) : alpha(th.text, 0.1)}`,
          boxShadow: `0 12px 34px rgba(0,0,0,0.42)${glow > 0 ? `, 0 0 ${28 * glow}px ${alpha(th.accent, 0.45 * glow)}` : ""}`,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div style={{ height: HEAD, display: "flex", alignItems: "center", gap: 12, padding: `0 ${PADX}px`, background: kept ? "transparent" : `linear-gradient(90deg, ${alpha(sc, 0.3)}, ${alpha(sc, 0.06)})`, borderBottom: g.cols.length || g.def.note ? `1px solid ${alpha(th.text, 0.09)}` : "none" }}>
          <I size={28} color={kept ? th.textDim : sc} style={{ flexShrink: 0 }} />
          <div style={{ fontFamily: f.mono, fontWeight: 600, fontSize: headSize, color: th.text, whiteSpace: "nowrap", position: "relative" }}>
            {name}
            {removed > 0 ? <div style={{ position: "absolute", left: -2, top: "52%", height: 3, width: `${removed * 104}%`, background: th.removed, borderRadius: 2 }} /> : null}
          </div>
          <div style={{ flex: 1 }} />
          {st ? (
            <div style={{ flexShrink: 0, fontSize: 17, fontWeight: 700, letterSpacing: "0.08em", color: kept ? th.textDim : sc, border: `1.5px solid ${alpha(kept ? th.textDim : sc, 0.6)}`, borderRadius: 8, padding: "3px 10px" }}>{labels[st]}</div>
          ) : null}
        </div>
        {g.cols.length ? (
          <div style={{ padding: `${PADV}px ${PADX}px` }}>
            {g.cols.map((c, i) => {
              const pc = prog(t, start + 0.22 + i * 0.07, 0.3);
              const right = c.note ?? (g.showTypes ? c.type : undefined);
              return (
                <div key={c.name + i} style={{ height: ROW, display: "flex", alignItems: "center", gap: 14, opacity: pc, transform: `translateX(${(1 - pc) * 10}px)` }}>
                  <div
                    style={{
                      width: BADGE_W,
                      flexShrink: 0,
                      textAlign: "center",
                      fontFamily: f.mono,
                      fontSize: 17,
                      fontWeight: 700,
                      borderRadius: 6,
                      padding: "2px 0",
                      color: c.pk ? th.ink : c.fk ? th.fk : alpha(th.text, 0.25),
                      background: c.pk ? th.pk : "transparent",
                      border: c.fk && !c.pk ? `1.5px solid ${th.fk}` : "1.5px solid transparent",
                    }}
                  >
                    {c.pk ? "PK" : c.fk ? "FK" : "··"}
                  </div>
                  <div style={{ fontFamily: f.mono, fontSize: 22, fontWeight: c.pk ? 600 : 500, color: th.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{c.name}</div>
                  <div style={{ flex: 1 }} />
                  {right ? (
                    <div style={{ flexShrink: 0, whiteSpace: "nowrap", fontFamily: c.note ? f.body : f.mono, fontSize: c.note ? 21 : 22, fontWeight: c.note ? 600 : 400, color: c.note ? th.changed : th.textDim }}>{right}</div>
                  ) : null}
                </div>
              );
            })}
            {g.more > 0 ? (
              <div style={{ height: ROW, display: "flex", alignItems: "center", paddingLeft: BADGE_W + 14, fontFamily: f.mono, fontSize: 22, color: th.textDim, opacity: prog(t, start + 0.3 + g.cols.length * 0.07, 0.3) }}>
                + {g.more} {labels.more}
              </div>
            ) : null}
          </div>
        ) : null}
        {g.def.note && g.cols.length ? (
          <div style={{ position: "absolute", left: PADX, right: PADX, bottom: 10, height: NOTE_H - 14, display: "flex", alignItems: "center", fontSize: 22, lineHeight: 1.22, fontWeight: 500, color: th.textDim, borderTop: `1px solid ${alpha(th.text, 0.07)}`, paddingTop: 6, opacity: prog(t, start + 0.5, 0.4) }}>
            {g.def.note}
          </div>
        ) : null}
      </div>
    </div>
  );
};

// ---------- links ----------

const Links: React.FC<{ board: Board; cards: CardGeom[]; s: TablesScene | BeforeAfterScene; t: number; start: number; ctx: Ctx }> = ({ board, cards, s, t, start, ctx }) => {
  const { th, f } = ctx;
  const links = sceneLinks(cards, s.links, s.autoLinks !== false);
  const routes = links.map((l, i) => ({ l, r: route(l.a, l.colA, l.b, l.colB, board, (i % 3) - 1) }));
  return (
    <>
      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
        {routes.map(({ r }, i) => {
          const p = prog(t, start + i * 0.3, 0.8);
          if (p <= 0) return null;
          return (
            <g key={i}>
              <path d={r.d} fill="none" stroke={th.fk} strokeWidth={3} strokeOpacity={0.8} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={r.p1[0]} cy={r.p1[1]} r={6.5} fill={th.fk} opacity={Math.min(1, p * 4)} />
              <circle cx={r.p2[0]} cy={r.p2[1]} r={7} fill={th.background} stroke={th.fk} strokeWidth={3} opacity={p > 0.96 ? 1 : 0} />
            </g>
          );
        })}
      </svg>
      {routes.map(({ l, r }, i) =>
        l.label ? (
          <div key={i} style={{ position: "absolute", left: r.label[0], top: r.label[1], transform: "translate(-50%, -50%)", opacity: prog(t, start + i * 0.3 + 0.6, 0.3), fontFamily: f.body, fontSize: 20, fontWeight: 600, color: th.fk, background: th.background, border: `1.5px solid ${alpha(th.fk, 0.5)}`, borderRadius: 8, padding: "2px 10px", whiteSpace: "nowrap" }}>
            {l.label}
          </div>
        ) : null,
      )}
    </>
  );
};

// ---------- scenes ----------

const statusLabel = (ctx: Ctx) => (s: Status) => ctx.labels[s];

const Tables: React.FC<{ s: TablesScene; plan: Plan; t: number; ctx: Ctx }> = ({ s, plan, t, ctx }) => {
  const lib = tableLib(ctx.data);
  const defs = s.tables.map((r) => resolveTable(r, lib));
  const board = useMemo(() => layoutGrid(defs, { x: 70, y: 140, w: 1780, h: 750 }, { columns: s.columns, maxRows: ctx.maxRows, prefix: "t:", statusLabel: statusLabel(ctx) }), [s, ctx.maxRows]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <Header title={s.title} t={t} ctx={ctx} />
      <Links board={board} cards={board.cards} s={s} t={t} start={plan.links} ctx={ctx} />
      {board.cards.map((g, i) => (
        <Card key={g.key} g={g} t={t} start={plan.cards[i]} ctx={ctx} />
      ))}
    </>
  );
};

const LEFT: Area = { x: 60, y: 176, w: 560, h: 712 };
const RIGHT: Area = { x: 690, y: 176, w: 1180, h: 712 };
const DIVIDER_X = 650;

const BeforeAfter: React.FC<{ s: BeforeAfterScene; plan: Plan; t: number; ctx: Ctx }> = ({ s, plan, t, ctx }) => {
  const { th } = ctx;
  const lib = tableLib(ctx.data);
  const before = s.before.map((r) => resolveTable(r, lib));
  const after = s.after.map((r) => ({ status: "new" as Status, ...resolveTable(r, lib) }));
  const { left, right } = useMemo(() => {
    const opts = { columns: 1, gapX: 40, gapY: 26, maxW: 540, statusLabel: statusLabel(ctx) };
    let l = layoutGrid(before, LEFT, { ...opts, maxRows: ctx.maxRows, prefix: "b:" });
    if (l.s < 0.82) l = layoutGrid(before, LEFT, { ...opts, maxRows: 0, prefix: "b:" }); // too many: header-only chips
    const r = layoutGrid(after, RIGHT, { columns: s.columns, maxRows: ctx.maxRows, prefix: "a:", statusLabel: statusLabel(ctx) });
    return { left: l, right: r };
  }, [s, ctx.maxRows]); // eslint-disable-line react-hooks/exhaustive-deps
  const afterById = new Map(right.cards.map((g, i) => [g.def.id, { g, i }]));
  const beforeById = new Map(left.cards.map((g) => [g.def.id, g]));
  // ghosts: each merge sends its sources flying into the target just before the target assembles
  const ghosts = (s.merges ?? []).flatMap((m) => {
    const tgt = afterById.get(m.into);
    if (!tgt) return [];
    return m.from.map((id, j) => ({ src: beforeById.get(id), tgt: tgt.g, at: plan.cards[tgt.i] - 0.6 + j * 0.08 })).filter((x) => x.src);
  });
  const glowOf = (id: string) => Math.max(0, ...ghosts.filter((gh) => gh.src!.def.id === id).map((gh) => prog(t, gh.at - 0.3, 0.25) * (1 - prog(t, gh.at + 0.5, 0.5))));
  const doneOf = (id: string) => {
    const mine = ghosts.filter((gh) => gh.src!.def.id === id);
    return mine.length ? prog(t, Math.max(...mine.map((gh) => gh.at)) + 0.7, 0.5) : 0;
  };
  const div = prog(t, plan.turn - 0.2, 0.6);
  const lab = (x: number, text: string, p: number, color: string) => (
    <div style={{ position: "absolute", left: x, top: 128, fontSize: 24, fontWeight: 700, letterSpacing: "0.16em", color, opacity: p }}>{text}</div>
  );
  return (
    <>
      <Header title={s.area} part={`${ctx.labels.before.toLowerCase()} → ${ctx.labels.after.toLowerCase()}`} t={t} ctx={ctx} />
      {lab(LEFT.x + 10, ctx.labels.before, prog(t, 0.2, 0.4), th.textDim)}
      {lab(RIGHT.x + 10, ctx.labels.after, div, th.new)}
      <div style={{ position: "absolute", left: DIVIDER_X, top: 140, width: 1.5, height: 740, background: alpha(th.text, 0.1), opacity: div }} />
      <div style={{ position: "absolute", left: DIVIDER_X - 22, top: 488, width: 44, height: 44, borderRadius: 22, background: th.background, border: `1.5px solid ${alpha(th.new, 0.6)}`, display: "grid", placeItems: "center", opacity: div }}>
        <RiArrowRightLine size={26} color={th.new} />
      </div>
      {left.cards.map((g, i) => (
        <Card key={g.key} g={g} t={t} start={plan.before[i]} ctx={ctx} glow={glowOf(g.def.id)} dim={doneOf(g.def.id)} strike={g.def.status === "removed" ? prog(t, plan.turn, 0.5) : undefined} />
      ))}
      <Links board={right} cards={right.cards} s={s} t={t} start={plan.links} ctx={ctx} />
      {right.cards.map((g, i) => (
        <Card key={g.key} g={g} t={t} start={plan.cards[i]} ctx={ctx} />
      ))}
      {ghosts.map((gh, k) => {
        const p = prog(t, gh.at, 0.7);
        if (p <= 0 || p >= 1) return null;
        const src = gh.src!;
        const x0 = src.x + 14 * src.s;
        const y0 = src.y + 8 * src.s;
        const x1 = gh.tgt.x + 14 * gh.tgt.s;
        const y1 = gh.tgt.y + 8 * gh.tgt.s;
        return (
          <div
            key={k}
            style={{
              position: "absolute",
              left: x0 + (x1 - x0) * p,
              top: y0 + (y1 - y0) * p - Math.sin(Math.PI * p) * 70,
              height: 48,
              padding: "0 18px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              borderRadius: 12,
              background: alpha(th.accent, 0.32),
              border: `1.5px solid ${th.accent}`,
              fontFamily: ctx.f.mono,
              fontSize: 22,
              fontWeight: 600,
              color: th.text,
              whiteSpace: "nowrap",
              opacity: interpolate(p, [0, 0.15, 0.75, 1], [0, 0.95, 0.9, 0]),
              transform: `scale(${1 - 0.2 * p})`,
              transformOrigin: "left top",
              boxShadow: `0 10px 30px ${alpha(th.accent, 0.3)}`,
            }}
          >
            <RiTable2 size={22} color={th.text} />
            {src.def.name ?? src.def.id}
          </div>
        );
      })}
    </>
  );
};

const Intro: React.FC<{ s: IntroScene; t: number; ctx: Ctx }> = ({ s, t, ctx }) => {
  const { th, f } = ctx;
  const p0 = prog(t, 0.1, 0.7);
  const p1 = prog(t, 0.6, 0.7);
  const stats = s.stats ?? [];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: s.caption ? 200 : 40 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26, width: 1600 }}>
        {s.kicker ? <div style={{ fontFamily: f.mono, fontSize: 28, fontWeight: 600, letterSpacing: "0.12em", color: th.highlight, opacity: p0 }}>{s.kicker}</div> : null}
        <Headline text={s.title} font={f.display} color={th.text} em={th.highlight} max={112} weight={700} delay={4} margin={0.8} lineHeight={1.05} />
        {s.subtitle ? <div style={{ fontSize: 42, fontWeight: 500, color: th.textDim, textAlign: "center", lineHeight: 1.3, opacity: p1, transform: `translateY(${(1 - p1) * 12}px)` }}><Rich text={s.subtitle} ctx={ctx} /></div> : null}
        {stats.length ? (
          <div style={{ display: "flex", gap: 36, marginTop: 40 }}>
            {stats.map((st, i) => {
              const p = prog(t, 1.1 + i * 0.45, 0.6);
              return (
                <div key={i} style={{ width: 400, height: 200, borderRadius: 18, background: th.card, border: `1.5px solid ${alpha(th.text, 0.1)}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: p, transform: `translateY(${(1 - p) * 18}px)` }}>
                  <div style={{ fontFamily: f.mono, fontSize: st.value.length > 7 ? 54 : 68, fontWeight: 600, color: th.highlight, whiteSpace: "nowrap" }}>{st.value}</div>
                  <div style={{ fontSize: 30, fontWeight: 500, color: th.text, marginTop: 6 }}>{st.label}</div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

const Summary: React.FC<{ s: SummaryScene; t: number; ctx: Ctx }> = ({ s, t, ctx }) => {
  const { th } = ctx;
  const two = s.items.length > 4;
  return (
    <>
      <Header title={s.title} t={t} ctx={ctx} />
      <div style={{ position: "absolute", left: 120, right: 120, top: 170, height: 700, display: "grid", gridTemplateColumns: two ? "1fr 1fr" : "1fr", alignContent: "center", columnGap: 60, rowGap: 30 }}>
        {s.items.map((it, i) => {
          const item = typeof it === "string" ? { text: it } : it;
          const I = item.icon ? icon(item.icon) : RiCheckLine;
          const p = prog(t, 0.6 + i * 0.45, 0.5);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 26, padding: "22px 30px", borderRadius: 18, background: th.card, border: `1.5px solid ${alpha(th.text, 0.08)}`, opacity: p, transform: `translateX(${(1 - p) * -18}px)` }}>
              <div style={{ width: 58, height: 58, borderRadius: 29, flexShrink: 0, background: alpha(th.new, 0.16), border: `1.5px solid ${alpha(th.new, 0.55)}`, display: "grid", placeItems: "center" }}>
                <I size={30} color={th.new} />
              </div>
              <div style={{ fontSize: two ? 32 : 38, fontWeight: 600, color: th.text, lineHeight: 1.25 }}>
                <Rich text={item.text} ctx={ctx} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};
