// "Editorial" motion on the music beat: photos with a live camera that reframes every 2 beats and takes a light punch
// on each beat; transitions locked to the beat (zoom, side whip, iOS card swipe); light crossing on the transition;
// particles; giant marquee stepping per beat; shine over a cut-out image; frosted glass; springs without bounce.
// Everything is driven by the beat grid of the track.
//
// usage: <BeatGrid anchor={s} period={s} drop={s}> ... </BeatGrid> inside <CameraMotionBlur> (the motion blur
// sub-samples need their own clock). `anchor` = one measured beat (seconds of the VIDEO), `drop` = from when the
// motion gets strong (before that a beat counts 35%).
import { createContext, useContext } from "react";
import { AbsoluteFill, Easing, Img, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useU } from "./beats";

type GridT = { anchor: number; period: number; drop: number; s: number; intensity: number };
const GridCtx = createContext<GridT>({ anchor: 0, period: 0.5, drop: 0, s: 0, intensity: 1 });

// `intensity` (0–1) softens the beat punch for calm brands (clinic, spa).
export const BeatGrid: React.FC<{ anchor: number; period: number; drop: number; intensity?: number; children: React.ReactNode }> = ({ anchor, period, drop, intensity = 1, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <GridCtx.Provider value={{ anchor, period, drop, s: frame / fps, intensity }}>{children}</GridCtx.Provider>;
};

export const useBeat = () => {
  const g = useContext(GridCtx);
  const k = Math.floor((g.s - g.anchor) / g.period);
  const tb = g.anchor + k * g.period;
  const strength = tb >= g.drop - 0.02 ? 1 : 0.35;
  const age = g.s - tb;
  return { k, age, strength, afterDrop: g.s >= g.drop - 0.02, punch: Math.exp(-age * 9) * strength * g.intensity, s: g.s, anchor: g.anchor, period: g.period };
};

// frame of the nearest beat (to snap scene changes), if it is within `tol` frames
export const onBeat = (fr: number, fps: number, anchor: number, period: number, tol = 8) => {
  const k = Math.round((fr / fps - anchor) / period);
  const fb = Math.round((anchor + k * period) * fps);
  return Math.abs(fb - fr) <= tol ? fb : fr;
};

export const EXPO = Easing.bezier(0.16, 1, 0.3, 1);
export const TR = 14; // transition frames between photos
export type TransitionType = "zoom" | "whip" | "swipe";
export type Kb = { s: [number, number]; x: [number, number]; y: [number, number]; focus: string };

const FRAMINGS = [
  { s: 1, x: 0, y: 0, r: 0 },
  { s: 1.1, x: -2.5, y: -1.5, r: -0.8 },
  { s: 1.04, x: 2, y: 1, r: 0.6 },
  { s: 1.13, x: 1, y: -2.5, r: 0 },
];

// Photo: Ken Burns + reframing every 2 beats + punch per beat; zoom/whip/swipe entrances and exits.
// `filter`: extra color correction for the photo (e.g. "contrast(1.1) saturate(1.1)").
// `every` = reframe every N beats (1 = most dynamic); `punch` = zoom strength on the beat.
export const Photo: React.FC<{ src: string; kb: Kb; enter: TransitionType | null; exit: TransitionType | null; square: boolean; filter?: string; every?: number; punch?: number }> = ({ src, kb, enter, exit, square, filter = "", every = 2, punch = 0.028 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const u = useU();
  const b = useBeat();
  const p = interpolate(frame, [0, durationInFrames], [0, 1], { easing: Easing.inOut(Easing.sin) });
  const e = enter ? interpolate(frame, [0, TR], [0, 1], { extrapolateRight: "clamp", easing: EXPO }) : 1;
  const ex = exit ? interpolate(frame, [durationInFrames - TR, durationInFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) }) : 0;
  let rf = FRAMINGS[0];
  if (b.afterDrop) {
    const kk = Math.floor(b.k / every);
    const m = EXPO(Math.min(1, Math.max(0, (b.s - (b.anchor + kk * every * b.period)) / (every === 1 ? 0.22 : 0.28))));
    const A = FRAMINGS[(((kk - 1) % 4) + 4) % 4];
    const B = FRAMINGS[((kk % 4) + 4) % 4];
    rf = { s: A.s + (B.s - A.s) * m, x: A.x + (B.x - A.x) * m, y: A.y + (B.y - A.y) * m, r: A.r + (B.r - A.r) * m };
  }
  let sc = interpolate(p, [0, 1], kb.s) * rf.s * (1 + punch * b.punch);
  const tx = interpolate(p, [0, 1], kb.x) + rf.x;
  const ty = interpolate(p, [0, 1], kb.y) + rf.y;
  let blur = 0;
  let radius = 0;
  let dark = 0;
  let shift = "";
  if (enter === "zoom") { sc *= 1 + (1 - e) * 0.16; blur += (1 - e) * 22; }
  if (enter === "whip") shift += ` translateX(${(1 - e) * 100}%)`;
  if (enter === "swipe") { shift += ` translateY(${(1 - e) * 100}%) scale(${0.9 + 0.1 * e})`; radius = (1 - e) * 70 * u; }
  if (exit === "zoom") { sc *= 1 + ex * 0.1; blur += ex * 14; }
  if (exit === "whip") { shift += ` translateX(${-ex * 40}%)`; dark = ex * 0.5; }
  if (exit === "swipe") { shift += ` scale(${1 - ex * 0.1})`; radius = Math.max(radius, ex * 70 * u); dark = ex * 0.55; }
  return (
    <AbsoluteFill style={{ opacity: enter === "zoom" ? e : 1, overflow: "hidden", transform: shift || undefined, borderRadius: radius, boxShadow: enter === "swipe" && e < 1 ? `0 ${-20 * u}px ${60 * u}px rgba(0,0,0,0.5)` : undefined }}>
      <Img src={staticFile(src)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: square ? kb.focus : "50% 50%", transform: `scale(${sc}) translate(${tx}%, ${ty}%) rotate(${rf.r}deg)`, filter: `${blur > 0.3 ? `blur(${blur}px) ` : ""}${filter} brightness(${(1 + 0.06 * b.punch) * (1 - dark)})` }} />
    </AbsoluteFill>
  );
};

// Light crossing the screen on a photo change.
export const LightSweep: React.FC<{ side: boolean; color?: string }> = ({ side, color = "255,200,110" }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const k = frame / durationInFrames;
  const x = interpolate(k, [0, 1], side ? [-40, 140] : [140, -40]);
  const op = interpolate(k, [0, 0.5, 1], [0, 0.75, 0], { easing: Easing.inOut(Easing.sin) });
  return <AbsoluteFill style={{ mixBlendMode: "screen", opacity: op, background: `radial-gradient(ellipse 55% 80% at ${x}% 40%, rgba(${color},0.9), rgba(${color},0.35) 40%, transparent 70%)` }} />;
};

export const LightPulse: React.FC<{ color?: string; strength?: number }> = ({ color = "255,214,140", strength = 0.2 }) => {
  const b = useBeat();
  return <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 40%, rgba(${color},0.55), transparent 65%)`, opacity: b.punch * strength, mixBlendMode: "screen" }} />;
};

// Light particles rising, twinkling, livelier on the beat.
export const Dust: React.FC<{ color?: string; glow?: string; n?: number; mode?: "screen" | "normal" }> = ({ color = "#ffd98a", glow = "rgba(255,200,110,0.55)", n = 42, mode = "screen" }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const u = useU();
  const b = useBeat();
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: mode }}>
      {Array.from({ length: n }).map((_, i) => {
        const sz = (3 + random("pt" + i) * 9) * u;
        const vel = 0.6 + random("pv" + i) * 1.6;
        const x = random("px" + i) * width + Math.sin((frame + i * 17) / (30 + i)) * 40 * u;
        const y = (((random("py" + i) * (height + 100) - frame * vel * u) % (height + 100)) + height + 100) % (height + 100) - 50;
        const op = Math.min(1, 0.35 + 0.35 * Math.sin((frame + i * 11) / 7) + b.punch * 0.5);
        return <div key={i} style={{ position: "absolute", left: x, top: y, width: sz, height: sz, borderRadius: "50%", background: color, opacity: op, boxShadow: `0 0 ${sz * 3}px ${sz}px ${glow}`, transform: `scale(${1 + b.punch * 0.6})` }} />;
      })}
    </AbsoluteFill>
  );
};

// Giant outlined marquee moving one step per beat.
export const Marquee: React.FC<{ text: string; square: boolean; font: string; stroke?: string; fill?: string; weight?: number; italic?: boolean; top?: number }> = ({ text, square, font, stroke = "rgba(255,236,190,0.55)", fill = "rgba(255,236,190,0.08)", weight = 800, italic, top }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const u = useU();
  const b = useBeat();
  const step = (b.k + EXPO(Math.min(1, b.age / 0.3))) * 70 * u;
  const op = interpolate(frame, [0, 8, durationInFrames - 8, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const size = (square ? 150 : 230) * u;
  return (
    <AbsoluteFill style={{ top: (top ?? (square ? 30 : 150)) * u, height: size * 1.25, overflow: "hidden", opacity: op * 0.85, pointerEvents: "none" }}>
      <div style={{ whiteSpace: "nowrap", fontFamily: font, fontWeight: weight, fontStyle: italic ? "italic" : undefined, fontSize: size, letterSpacing: "-0.03em", lineHeight: 1.1, color: "transparent", WebkitTextStroke: `${2 * u}px ${stroke}`, transform: `translateX(${-(step % (size * 4))}px)` }}>
        {Array.from({ length: 8 }).map((_, i) => <span key={i} style={{ marginRight: 60 * u, color: i % 2 ? "transparent" : fill }}>{text}</span>)}
      </div>
    </AbsoluteFill>
  );
};

// Shine sweeping over a cut-out image (masked by its alpha).
export const Shine: React.FC<{ src: string; delay: number; period?: number }> = ({ src, delay, period = 50 }) => {
  const frame = useCurrentFrame();
  const fl = frame - delay;
  if (fl < 0) return null;
  const x = interpolate(fl % period, [0, period * 0.6], [-40, 140], { extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
  const mask = { WebkitMaskImage: `url(${src})`, maskImage: `url(${src})`, WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center" } as React.CSSProperties;
  return <div style={{ position: "absolute", inset: 0, ...mask, background: `linear-gradient(110deg, transparent ${x - 14}%, rgba(255,250,230,0.85) ${x}%, transparent ${x + 14}%)`, mixBlendMode: "screen" }} />;
};

// iOS frosted glass (dark by default; `light` for light photos).
export const glass = (u: number, light = false): React.CSSProperties => ({
  background: light ? "linear-gradient(160deg, rgba(255,252,246,0.72), rgba(255,248,236,0.5))" : "linear-gradient(160deg, rgba(255,255,255,0.18), rgba(255,255,255,0.06))",
  backdropFilter: `blur(${28 * u}px) saturate(160%)`,
  WebkitBackdropFilter: `blur(${28 * u}px) saturate(160%)`,
  border: `${1.5 * u}px solid ${light ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.22)"}`,
  boxShadow: `0 ${30 * u}px ${80 * u}px rgba(0,0,0,${light ? 0.22 : 0.45}), inset 0 ${1 * u}px 0 rgba(255,255,255,0.4)`,
  borderRadius: 44 * u,
});

// "Apple" spring: no bounce.
export const useSoftSpring = (delay: number, stiffness = 110) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: 22, stiffness, mass: 0.9 } });
};
export const softSpring = (f: number, stiffness = 120) => spring({ frame: f, fps: 30, config: { damping: 22, stiffness, mass: 0.9 } });

// Words appearing one by one (rise and come out of the blur).
export const Reveal: React.FC<{ text: string; delay: number; step?: number; style: React.CSSProperties }> = ({ text, delay, step = 3, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", columnGap: "0.28em", ...style }}>
      {text.split(" ").map((w, i) => {
        const p = spring({ frame: frame - delay - i * step, fps, config: { damping: 22, stiffness: 100 } });
        return <span key={i} style={{ display: "inline-block", opacity: p, transform: `translateY(${(1 - p) * 0.5}em)`, filter: p < 0.98 ? `blur(${(1 - p) * 12}px)` : undefined }}>{w}</span>;
      })}
    </div>
  );
};

// Exit of the interface layers: rises slightly and blurs in the last frames.
export const useExit = (frames = 10) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return interpolate(frame, [durationInFrames - frames, durationInFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
};

// Diagonal light beam crossing the screen every 2 beats after the drop (fast).
export const Sweep: React.FC<{ color?: string }> = ({ color = "255,214,140" }) => {
  const b = useBeat();
  if (!b.afterDrop || ((b.k % 2) + 2) % 2 !== 0) return null;
  const k = b.age / 0.3;
  if (k > 1) return null;
  const x = interpolate(k, [0, 1], [-40, 140], { easing: Easing.inOut(Easing.cubic) });
  return <AbsoluteFill style={{ mixBlendMode: "screen", pointerEvents: "none", background: `linear-gradient(115deg, transparent ${x - 12}%, rgba(${color},0.35) ${x - 3}%, rgba(${color},0.6) ${x}%, rgba(${color},0.35) ${x + 3}%, transparent ${x + 12}%)` }} />;
};

// Thin frame inside the margin that lights up and "breathes" on the beat.
export const BeatFrame: React.FC<{ square: boolean; color?: string }> = ({ square, color = "226,189,98" }) => {
  const u = useU();
  const b = useBeat();
  const m = (square ? 22 : 36) * u * (1 - 0.25 * b.punch);
  return <AbsoluteFill style={{ inset: m, border: `${2 * u}px solid rgba(${color},${0.25 + 0.55 * b.punch})`, borderRadius: 30 * u, boxShadow: `0 0 ${30 * u * b.punch}px rgba(${color},${0.5 * b.punch})`, pointerEvents: "none" }} />;
};
