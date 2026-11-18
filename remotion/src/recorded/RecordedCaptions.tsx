import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Edl, Edit, EdlWord, Theme } from "./types";
import { fonts } from "./fonts";
import { EXPO } from "./Media";

// Chunks of up to `max` words, breaking on punctuation and NEVER crossing a cut (segment of the edl).
function chunks(edl: Edl, max: number, hide: [number, number][]): EdlWord[][] {
  const hidden = (i: number) => hide.some(([a, b]) => i >= a && i <= b);
  const segmentOf = (w: EdlWord) => edl.segments.findIndex((sg) => w.start >= sg.start - 0.01 && w.start < sg.end);
  const out: EdlWord[][] = [];
  let current: EdlWord[] = [];
  for (const w of edl.words) {
    if (hidden(w.i)) { if (current.length) out.push(current); current = []; continue; }
    if (current.length && segmentOf(current[0]) !== segmentOf(w)) { out.push(current); current = []; }
    current.push(w);
    if (current.length >= max || /[.,!?:;…]$/.test(w.text)) { out.push(current); current = []; }
  }
  if (current.length) out.push(current);
  return out;
}

type Props = { edl: Edl; cfg: NonNullable<Edit["captions"]>; theme: Theme; y: number; width: number };

export const RecordedCaptions: React.FC<Props> = ({ edl, cfg, theme, y, width }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const style = cfg.style ?? "editorial";
  if (style === "none") return null;
  const max = cfg.max ?? (style === "editorial" ? 3 : style === "impact" ? 2 : 4);
  const list = chunks(edl, max, cfg.hide ?? []);
  // the chunk stays until the next one starts (or 0.35 s after its last word) — one leaves before the other enters
  const i = list.findIndex((b, k) => {
    const next = k + 1 < list.length ? list[k + 1][0].start : Infinity;
    return t >= b[0].start - 0.04 && t < Math.min(next - 0.04, b[b.length - 1].end + 0.35);
  });
  if (i < 0) return null;
  const chunk = list[i];
  const F = fonts(theme);
  const highlights = new Set(cfg.highlights ?? []);
  const clean = (s: string) => (cfg.style === "mono" ? s : s.replace(/[.,;:]$/, ""));

  if (style === "editorial") {
    // short sentence in a tight black box, small type — discreet, reads like a "movie subtitle"
    const size = cfg.size ?? Math.round(width * 0.036);
    const p = interpolate(t, [chunk[0].start - 0.04, chunk[0].start + 0.16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return (
      <div style={{ position: "absolute", left: 0, right: 0, top: y, display: "flex", justifyContent: "center", transform: "translateY(-50%)", opacity: p }}>
        <div style={{ background: "rgba(0,0,0,0.88)", padding: `${size * 0.18}px ${size * 0.4}px`, fontFamily: F.sans, fontWeight: 500, fontSize: size,
          color: "#fff", letterSpacing: "-0.005em", lineHeight: 1.2 }}>
          {chunk.map((w, k) => (
            <span key={k} style={{ color: highlights.has(w.i) ? theme.accent : undefined, fontFamily: highlights.has(w.i) ? F.serif : undefined,
              fontSize: highlights.has(w.i) ? size * 1.15 : undefined }}>{(k ? " " : "") + clean(w.text)}</span>
          ))}
        </div>
      </div>
    );
  }

  if (style === "impact") {
    // fast-paced ad: 1–2 big uppercase words; the spoken one turns accent and pops in
    const size = cfg.size ?? Math.round(width * 0.085);
    return (
      <div style={{ position: "absolute", left: width * 0.05, right: width * 0.05, top: y, transform: "translateY(-50%)", display: "flex",
        flexWrap: "wrap", justifyContent: "center", gap: "0 0.34em", fontFamily: F.sans, fontWeight: 800, fontSize: size, lineHeight: 1.05,
        letterSpacing: "-0.02em", textTransform: "uppercase", color: "#fff",
        textShadow: "0 4px 16px rgba(0,0,0,0.6), 0 0 3px rgba(0,0,0,0.9)" }}>
        {chunk.map((w, k) => {
          const pop = interpolate(t, [w.start - 0.03, w.start + 0.05, w.start + 0.14], [0.6, 1.07, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const speaking = t >= w.start - 0.03 && t < (chunk[k + 1]?.start ?? Infinity);
          return (
            <span key={k} style={{ display: "inline-block", transform: `scale(${t >= w.start - 0.03 ? pop : 1})`,
              opacity: t >= w.start - 0.03 ? 1 : 0.4, color: speaking || highlights.has(w.i) ? theme.accent : undefined }}>
              {w.text.replace(/^["'“‘(]+|[.,;:!?…"'”’)]+$/g, "")}
            </span>
          );
        })}
      </div>
    );
  }

  // mono and minimal: word by word; the word being spoken lights up (accent in mono), the next ones wait dimmed
  const mono = style === "mono";
  const size = cfg.size ?? Math.round(width * (mono ? 0.046 : 0.06));
  return (
    <div style={{ position: "absolute", left: width * 0.07, right: width * 0.07, top: y, transform: "translateY(-50%)", display: "flex",
      flexWrap: "wrap", justifyContent: "center", gap: `0 ${mono ? "0.6em" : "0.28em"}`, fontFamily: mono ? F.mono : F.sans,
      fontWeight: mono ? 700 : 600, fontSize: size, lineHeight: 1.2, letterSpacing: mono ? 0 : "-0.015em",
      textShadow: "0 2px 10px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.6)" }}>
      {chunk.map((w, k) => {
        const p = interpolate(t, [w.start - 0.03, w.start + 0.12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EXPO });
        const speaking = t >= w.start && t < (chunk[k + 1]?.start ?? w.end + 0.2);
        const color = highlights.has(w.i) || (mono && speaking) ? theme.accent : "#fff";
        return (
          <span key={k} style={{ color, opacity: 0.35 + 0.65 * p, transform: `translateY(${(1 - p) * 6}px)`, display: "inline-block",
            filter: mono ? undefined : `blur(${(1 - p) * 3}px)` }}>{clean(w.text)}</span>
        );
      })}
    </div>
  );
};
