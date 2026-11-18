import { createContext, useContext } from "react";
import { AbsoluteFill, Easing, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadSerif } from "@remotion/google-fonts/InstrumentSerif";
import { loadFont as loadManrope } from "@remotion/google-fonts/Manrope";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import type { Format } from "../components/formats";

// "Elegant brand" style: ink background with a soft light in the brand color, serif titles (Instrument Serif) with an
// italic accent in the highlight color, spaced Manrope labels, discreet Inter captions, transition only crossfade +
// blur, camera only moving forward. None of the beat kit (grid, confetti, shake, whip). Pieces used by elegant/Elegant.tsx
// and lesson/Lesson.tsx.

export const { fontFamily: SERIF } = loadSerif("normal", { weights: ["400"], subsets: ["latin", "latin-ext"] });
loadSerif("italic", { weights: ["400"], subsets: ["latin", "latin-ext"] });
export const { fontFamily: MANROPE } = loadManrope("normal", { weights: ["500", "600", "700"], subsets: ["latin", "latin-ext"] });
export const { fontFamily: INTER } = loadInter("normal", { weights: ["400", "500", "600"], subsets: ["latin", "latin-ext"] });

export const CROSSFADE = 12;
export const ease = Easing.bezier(0.16, 1, 0.3, 1);
export const progress = (frame: number, t0: number, dur: number) =>
  interpolate(frame - t0, [0, dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

export type { Format };
export const LAYOUT = {
  "9:16": { w: 1080, h: 1920, title: 92, titleY: 300, captionY: 1660, tablet: 0.9, tabletY: 1045, labelY: 210, quote: 128, bottom: 280, numbers: 160 },
  "4:5": { w: 1080, h: 1350, title: 84, titleY: 170, captionY: 1205, tablet: 0.9, tabletY: 770, labelY: 92, quote: 116, bottom: 160, numbers: 90 },
  "1:1": { w: 1080, h: 1080, title: 76, titleY: 110, captionY: 965, tablet: 0.86, tabletY: 610, labelY: 70, quote: 104, bottom: 100, numbers: 60 },
};

/** Value that may vary by format: a single value or { "9:16": x, "4:5": y, "1:1": z }. */
export type PerFormat<T> = T | Partial<Record<Format, T>>;
export function perFormat<T>(v: PerFormat<T> | undefined, f: Format, fallback: T): T {
  if (v === undefined || v === null) return fallback;
  if (typeof v === "object" && !Array.isArray(v) && ("9:16" in (v as object) || "4:5" in (v as object) || "1:1" in (v as object))) {
    return ((v as Partial<Record<Format, T>>)[f] ?? fallback) as T;
  }
  return v as T;
}

// ---------- brand theme ----------
// background = ink; primary = brand color (light blobs, cards); dark = deeper brand color; accent = highlight (italic
// words, labels); text = titles. Neutral default: override with script.json → theme.
export type Theme = { background: string; primary: string; dark: string; accent: string; text: string; logo: string; slug: string };
export const DEFAULT_THEME: Theme = { background: "#0E0F13", primary: "#33415C", dark: "#222B3D", accent: "#C8B48A", text: "#F3F1EC", logo: "logo.svg", slug: "" };
export const ThemeCtx = createContext<Theme>(DEFAULT_THEME);
export const useTheme = () => useContext(ThemeCtx);
export const file = (t: Theme, name: string) => staticFile(`${t.slug}/${name}`);

export function rgba(hex: string, a: number) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ---------- base ----------
export const Glow: React.FC = () => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const dx = Math.sin(frame / 70) * 80;
  const dy = Math.cos(frame / 90) * 60;
  return (
    <AbsoluteFill style={{ background: t.background, overflow: "hidden" }}>
      <div style={{ position: "absolute", width: 1500, height: 1500, left: -620 + dx, top: -560 + dy, borderRadius: "50%", background: `radial-gradient(circle, ${rgba(t.primary, 0.42)}, transparent 62%)` }} />
      <div style={{ position: "absolute", width: 1300, height: 1300, right: -620 - dx, bottom: -520 - dy, borderRadius: "50%", background: `radial-gradient(circle, ${rgba(t.accent, 0.18)}, transparent 62%)` }} />
    </AbsoluteFill>
  );
};

/** Scene with crossfade + blur on enter and exit (the only transition of the style). */
export const Scene: React.FC<{ children: React.ReactNode; exit?: boolean }> = ({ children, exit = true }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const enter = progress(frame, 0, CROSSFADE + 6);
  const out = exit ? interpolate(frame, [durationInFrames - CROSSFADE, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  const op = Math.min(enter, out);
  return <AbsoluteFill style={{ opacity: op, filter: `blur(${(1 - op) * 14}px)` }}>{children}</AbsoluteFill>;
};

const isVideo = (name: string) => /\.(mp4|mov|webm)$/i.test(name);

/** Full-screen photo or video, slow forward zoom and a gradient of the background color (text legibility). */
export const Media: React.FC<{ src: string; focus?: string; zoom?: [number, number]; darken?: number; blur?: number }> = ({ src, focus = "50% 50%", zoom, darken, blur = 0 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = useTheme();
  const video = isVideo(src);
  const [z0, z1] = zoom ?? (video ? [1.02, 1.08] : [1.0, 1.08]);
  const e = darken ?? (video ? 0.3 : 0.35);
  const s = interpolate(frame, [0, durationInFrames], [z0, z1]);
  const style: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", objectPosition: focus, transform: `scale(${s})`, transformOrigin: focus, filter: blur ? `blur(${blur}px) saturate(0.9)` : undefined };
  const g = video
    ? `linear-gradient(180deg, ${rgba(t.background, e + 0.2)} 0%, ${rgba(t.background, e * 0.5)} 40%, ${rgba(t.background, e)} 65%, ${rgba(t.background, 0.92)} 100%)`
    : `linear-gradient(180deg, ${rgba(t.background, e + 0.25)} 0%, ${rgba(t.background, e * 0.4)} 38%, ${rgba(t.background, e * 0.6)} 62%, ${rgba(t.background, 0.92)} 100%)`;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {video ? <OffthreadVideo src={file(t, src)} muted style={style} /> : <Img src={file(t, src)} style={style} />}
      <AbsoluteFill style={{ background: g }} />
    </AbsoluteFill>
  );
};

// ---------- typography ----------
/** Serif title; the part between *asterisks* is italic in the accent color. Each word rises through a mask. */
export const Title: React.FC<{ text: string; size: number; start: number; step?: number; width?: number }> = ({ text, size, start, step = 3, width = 940 }) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  let accent = false;
  const words = text.split(" ").map((w) => {
    if (w.startsWith("*")) accent = true;
    const item = { w: w.replace(/\*/g, ""), accent };
    if (/\*[.,!?:;]?$/.test(w)) accent = false;
    return item;
  });
  return (
    <div style={{ width, display: "flex", flexWrap: "wrap", justifyContent: "center", columnGap: size * 0.24, fontFamily: SERIF, fontSize: size, lineHeight: 1.04, letterSpacing: "-0.015em", color: t.text, textAlign: "center" }}>
      {words.map((p, i) => {
        const k = progress(frame, start + i * step, 22);
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", paddingBottom: size * 0.1, marginBottom: -size * 0.1 }}>
            <span style={{ display: "inline-block", transform: `translateY(${(1 - k) * 105}%)`, opacity: 0.2 + k * 0.8, fontStyle: p.accent ? "italic" : "normal", color: p.accent ? t.accent : undefined }}>{p.w}</span>
          </span>
        );
      })}
    </div>
  );
};

export const Label: React.FC<{ text: string; start: number; size?: number }> = ({ text, start, size = 24 }) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const p = progress(frame, start, 20);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, opacity: p, transform: `translateY(${(1 - p) * 10}px)` }}>
      <div style={{ width: 36 * p, height: 1.5, background: t.accent, opacity: 0.8 }} />
      <div style={{ fontFamily: MANROPE, fontWeight: 600, fontSize: size, letterSpacing: "0.28em", textTransform: "uppercase", color: t.accent, whiteSpace: "nowrap" }}>{text}</div>
      <div style={{ width: 36 * p, height: 1.5, background: t.accent, opacity: 0.8 }} />
    </div>
  );
};

export const Soft: React.FC<{ text: string; color?: string; size?: number; spaced?: boolean }> = ({ text, color = "rgba(236,234,238,0.72)", size = 40, spaced }) => {
  const frame = useCurrentFrame();
  const p = progress(frame, 0, 20);
  return <div style={{ fontFamily: spaced ? MANROPE : INTER, fontWeight: spaced ? 600 : 400, fontSize: size, color, opacity: p, transform: `translateY(${(1 - p) * 12}px)`, letterSpacing: spaced ? "0.22em" : "-0.005em", textTransform: spaced ? "uppercase" : undefined, whiteSpace: "nowrap" }}>{text}</div>;
};

export const Veil: React.FC<{ start: number }> = ({ start }) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const p = progress(frame, start, 24);
  return <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 45% at 50% 46%, ${rgba(t.background, 0.78)}, ${rgba(t.background, 0.35)} 70%, transparent)`, opacity: p }} />;
};

export const QuoteMark: React.FC<{ start: number }> = ({ start }) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const p = progress(frame, start, 24);
  return <div style={{ fontFamily: SERIF, fontSize: 180, lineHeight: 0.4, height: 70, color: t.accent, opacity: p * 0.7, transform: `translateY(${(1 - p) * 20}px)` }}>“</div>;
};

export type NumberItem = { n: string; label: string; italic?: boolean };
export const Numbers: React.FC<{ format: Format; items: NumberItem[]; marks: number[] }> = ({ format, items, marks }) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const vertical = format === "9:16";
  return (
    <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", gap: vertical ? 44 : 70, alignItems: "center" }}>
      {items.map((it, i) => {
        const p = progress(frame, marks[i], 24);
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", opacity: p, transform: `translateY(${(1 - p) * 24}px)`, filter: `blur(${(1 - p) * 8}px)` }}>
            <div style={{ fontFamily: SERIF, fontSize: vertical ? 190 : 150, lineHeight: 0.95, color: t.text, fontStyle: it.italic ?? i === items.length - 1 ? "italic" : "normal" }}>{it.n}</div>
            <div style={{ fontFamily: MANROPE, fontWeight: 600, fontSize: 24, letterSpacing: "0.26em", textTransform: "uppercase", color: t.accent, marginTop: 6 }}>{it.label}</div>
          </div>
        );
      })}
    </div>
  );
};

export const LogoIn: React.FC<{ height?: number }> = ({ height = 70 }) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const p = progress(frame, 4, 30);
  return <Img src={file(t, t.logo)} style={{ height, filter: `brightness(0) invert(1) blur(${(1 - p) * 8}px)`, opacity: p, transform: `scale(${0.96 + p * 0.04})` }} />;
};

// ---------- discreet captions (one sentence at a time) ----------
export type Word = { text: string; start: number; end: number };
// hide: word-index ranges without captions; display: { "<index>": "text to show instead" ("" hides the word);
// join: word-index ranges that must stay in the same chunk; off: no captions at all
export type CaptionConfig = { hide?: [number, number][]; display?: Record<string, string>; join?: [number, number][]; off?: boolean };

export function captionChunks(al: Word[], join: [number, number][] = []): number[][] {
  const inside = (i: number) => join.some(([a, b]) => i >= a && i < b);
  const out: number[][] = [];
  let current: number[] = [];
  al.forEach((w, i) => {
    current.push(i);
    if (!inside(i) && (/[.,:;!?]$/.test(w.text) || current.length >= 6)) { out.push(current); current = []; }
  });
  if (current.length) out.push(current);
  return out;
}

export const Caption: React.FC<{ y: number; words: Word[]; chunks: number[][]; cfg: CaptionConfig }> = ({ y, words, chunks, cfg }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (cfg.off) return null;
  const t = frame / fps;
  const chunk = chunks.find((b) => t >= words[b[0]].start - 0.08 && t <= words[b[b.length - 1]].end + 0.25);
  if (!chunk || (cfg.hide ?? []).some(([a, b]) => chunk[0] >= a && chunk[0] <= b)) return null;
  const p = progress(frame, (words[chunk[0]].start - 0.08) * fps, 8);
  const display = cfg.display ?? {};
  const text = chunk.map((i) => (String(i) in display ? display[String(i)] : words[i].text)).filter(Boolean).join(" ");
  return (
    <div style={{ position: "absolute", top: y, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: p }}>
      <div style={{ fontFamily: INTER, fontWeight: 500, fontSize: 38, color: "#FFFFFF", letterSpacing: "-0.005em", textShadow: "0 2px 18px rgba(0,0,0,0.7)", textAlign: "center", maxWidth: 900 }}>{text}</div>
    </div>
  );
};
