// Motion pieces for ads at the pace of the references (formats.md → Pace): one idea per beat, background changing
// color, giant keyword, icon in a rounded tile, counters, notifications.
// Everything is centered and sized by the smaller frame dimension → works for 9:16, 4:5 and 1:1.
import { createContext, useContext } from "react";
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { fitText } from "@remotion/layout-utils";
import type { RemixiconComponentType } from "@remixicon/react";
import { FONT, FONT_MONO } from "../components/fonts";

// relative px: 1 = 1/1080 of the smaller dimension
export const useU = () => {
  const { width, height } = useVideoConfig();
  return Math.min(width, height) / 1080;
};

export const usePop = (delayFrames = 0, cfg = { damping: 13, stiffness: 220 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delayFrames, fps, config: cfg });
};

// Scale of the beat content (vertical gets +18%); giant words discount it when fitting the width.
export const ScaleCtx = createContext(1);

// Beat background: moving light + subtle grid; content enters with a "whip" (slide + blur), stays alive with
// continuous zoom/rotation and leaves with a whip in the last frames. `impact` = flash + shake on enter.
export const Beat: React.FC<{ color: string; children: React.ReactNode; entrance?: "whip" | "cut"; impact?: boolean; grid?: boolean; light?: string }> = ({ color, children, entrance = "whip", impact, grid = true, light = "rgba(255,255,255,0.10)" }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const u = Math.min(width, height) / 1080;
  const k = height > width * 1.3 ? 1.18 : 1;
  const enter = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const exit = interpolate(frame, [durationInFrames - 5, durationInFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
  const blur = (entrance === "whip" ? (1 - enter) * 18 : 0) + exit * 16;
  const alive = interpolate(frame, [0, durationInFrames], [1, 1.07]);
  const rot = interpolate(frame, [0, durationInFrames], [-0.6, 0.6]);
  const shake = impact ? Math.max(0, 1 - frame / 12) : 0;
  const tx = Math.sin(frame * 3.1) * 14 * u * shake;
  const ty = Math.cos(frame * 2.7) * 10 * u * shake;
  const lx = 50 + Math.sin(frame / 18) * 25;
  const ly = 40 + Math.cos(frame / 23) * 20;
  return (
    <AbsoluteFill style={{ background: color, overflow: "hidden" }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at ${lx}% ${ly}%, ${light}, transparent 55%)` }} />
      {grid && (
        <AbsoluteFill style={{ opacity: 0.07, backgroundImage: "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)", backgroundSize: `${120 * u}px ${120 * u}px`, color: "#fff", transform: `translateY(${(frame * 0.6) % (120 * u)}px)` }} />
      )}
      <AbsoluteFill
        style={{
          transform: `translate(${tx}px, ${ty + (entrance === "whip" ? (1 - enter) * 8 * height / 100 : 0) - exit * 6 * height / 100}px) scale(${k * alive}) rotate(${rot}deg)`,
          filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
          opacity: 1 - exit * 0.6,
          alignItems: "center",
          justifyContent: "center",
          fontFamily: FONT,
        }}
      >
        <ScaleCtx.Provider value={k}>{children}</ScaleCtx.Provider>
      </AbsoluteFill>
      {impact && <AbsoluteFill style={{ background: "#fff", opacity: interpolate(frame, [0, 5], [0.55, 0], { extrapolateRight: "clamp" }) }} />}
    </AbsoluteFill>
  );
};

// Font size that fits the width (measures the real text). `size` is the desired maximum.
const useFit = (text: string, size: number, weight: number, margin = 0.88) => {
  const { width } = useVideoConfig();
  const u = useU();
  const k = useContext(ScaleCtx);
  const max = (width * margin) / k;
  const { fontSize } = fitText({ text, withinWidth: max, fontFamily: FONT, fontWeight: String(weight), letterSpacing: "-0.045em" });
  return Math.min(size * u, fontSize);
};

// Giant word: letters cascade (each one jumps), scale punch, optional shake, always fits the width.
export const Giant: React.FC<{ text: string; size: number; color: string; delay?: number; shake?: boolean; weight?: number; glow?: string; underline?: string }> = ({ text, size, color, delay = 0, shake, weight = 900, glow, underline }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const u = useU();
  const fs = useFit(text, size, weight);
  const p = usePop(delay, { damping: 11, stiffness: 260 });
  const dx = shake ? Math.sin(frame * 2.3) * 7 * u * Math.max(0, 1 - (frame - delay) / 22) : 0;
  const stroke = interpolate(frame - delay, [6, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return (
    <div style={{ position: "relative", fontSize: fs, fontWeight: weight, color, letterSpacing: "-0.045em", lineHeight: 0.95, transform: `translateX(${dx}px) scale(${interpolate(p, [0, 1], [1.25, 1])})`, textShadow: glow ? `0 0 ${60 * u}px ${glow}` : undefined, whiteSpace: "nowrap" }}>
      {Array.from(text).map((ch, i) => {
        const l = spring({ frame: frame - delay - i * 1.5, fps, config: { damping: 12, stiffness: 300 } });
        return (
          <span key={i} style={{ display: "inline-block", opacity: l, transform: `translateY(${(1 - l) * 0.45 * fs}px) rotate(${(1 - l) * (i % 2 ? 8 : -8)}deg)`, whiteSpace: "pre" }}>
            {ch}
          </span>
        );
      })}
      {underline && (
        <div style={{ position: "absolute", left: "2%", right: "2%", bottom: -0.14 * fs, height: 0.085 * fs, borderRadius: fs, background: underline, transformOrigin: "left center", transform: `scaleX(${stroke}) rotate(-1deg)`, boxShadow: `0 0 ${0.15 * fs}px ${underline}` }} />
      )}
    </div>
  );
};

// Highlighter: the colored band sweeps behind the text.
export const Highlighter: React.FC<{ text: string; color: string; background: string; size?: number; delay?: number }> = ({ text, color, background, size = 54, delay = 0 }) => {
  const frame = useCurrentFrame();
  const u = useU();
  const p = usePop(delay);
  const v = interpolate(frame - delay, [2, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return (
    <div style={{ position: "relative", padding: `${6 * u}px ${22 * u}px`, fontSize: size * u, fontWeight: 800, color, opacity: p, whiteSpace: "nowrap", transform: `rotate(-1.5deg) translateY(${(1 - p) * 20 * u}px)` }}>
      <div style={{ position: "absolute", inset: 0, background, borderRadius: 10 * u, transformOrigin: "left center", transform: `scaleX(${v})` }} />
      <span style={{ position: "relative" }}>{text}</span>
    </div>
  );
};

// Sparkles (little stars) bursting around the center.
export const Sparkles: React.FC<{ delay: number; color: string; n?: number }> = ({ delay, color, n = 14 }) => {
  const frame = useCurrentFrame();
  const u = useU();
  const f = frame - delay;
  if (f < 0) return null;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
      {Array.from({ length: n }).map((_, i) => {
        const ang = (i / n) * Math.PI * 2 + random("b" + i) * 0.5;
        const dist = interpolate(f, [0, 20], [60, 380 + random("d" + i) * 200], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }) * u;
        const op = interpolate(f, [0, 4, 22], [0, 1, 0], { extrapolateRight: "clamp" });
        const sz = (14 + random("t" + i) * 18) * u;
        return <div key={i} style={{ position: "absolute", width: sz, height: sz, background: color, opacity: op, transform: `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist}px) rotate(45deg)`, borderRadius: 3 * u, boxShadow: `0 0 ${20 * u}px ${color}` }} />;
      })}
    </AbsoluteFill>
  );
};

// Film grain over the whole video.
export const Grain: React.FC<{ strength?: number }> = ({ strength = 0.07 }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: strength, mixBlendMode: "overlay" }}>
      <svg width="100%" height="100%">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={frame % 7} />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
};

export const Small: React.FC<{ text: string; color: string; size?: number; delay?: number; weight?: number }> = ({ text, color, size = 54, delay = 0, weight = 600 }) => {
  const u = useU();
  const p = usePop(delay);
  return <div style={{ fontSize: size * u, fontWeight: weight, color, letterSpacing: "-0.02em", opacity: p, transform: `translateY(${interpolate(p, [0, 1], [20 * u, 0])}px)`, whiteSpace: "nowrap" }}>{text}</div>;
};

// Icon inside a rounded tile.
export const IconTile: React.FC<{ Icon: RemixiconComponentType; size: number; background: string; color: string; delay?: number; border?: string }> = ({ Icon, size, background, color, delay = 0, border }) => {
  const u = useU();
  const p = usePop(delay, { damping: 12, stiffness: 240 });
  return (
    <div style={{ width: size * u, height: size * u, borderRadius: size * 0.26 * u, background, border, display: "grid", placeItems: "center", opacity: p, transform: `scale(${interpolate(p, [0, 1], [0.4, 1])}) rotate(${interpolate(p, [0, 1], [-12, 0])}deg)`, boxShadow: `0 ${20 * u}px ${50 * u}px rgba(0,0,0,0.18)` }}>
      <Icon size={size * 0.52 * u} color={color} />
    </div>
  );
};

// Red X drawn on top (the strokes grow).
export const Cross: React.FC<{ size: number; delay: number; color?: string }> = ({ size, delay, color = "#ff3b30" }) => {
  const frame = useCurrentFrame();
  const u = useU();
  const a = interpolate(frame - delay, [0, 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const b = interpolate(frame - delay, [4, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const L = size * 1.15 * u;
  const stroke = (p: number, rot: number) => (
    <div style={{ position: "absolute", left: "50%", top: "50%", width: L * p, height: 14 * u, borderRadius: 8 * u, background: color, transform: `translate(-50%, -50%) rotate(${rot}deg)`, boxShadow: `0 0 ${18 * u}px ${color}` }} />
  );
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {stroke(a, 45)}
      {stroke(b, -45)}
    </div>
  );
};

// Concentric rings pulsing (tension).
export const Rings: React.FC<{ color: string }> = ({ color }) => {
  const frame = useCurrentFrame();
  const u = useU();
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      {[0, 1, 2, 3].map((i) => {
        const f = ((frame + i * 9) % 36) / 36;
        return <div key={i} style={{ position: "absolute", width: (300 + f * 900) * u, height: (300 + f * 900) * u, borderRadius: "50%", border: `${4 * u}px solid ${color}`, opacity: (1 - f) * 0.5 }} />;
      })}
    </AbsoluteFill>
  );
};

// Particles falling (dollar signs, confetti).
export const Rain: React.FC<{ n: number; render: (i: number, size: number) => React.ReactNode; seed: string; speed?: number }> = ({ n, render, seed, speed = 1 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const u = useU();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: n }).map((_, i) => {
        const x = random(seed + i) * width;
        const sz = (40 + random(seed + "t" + i) * 70) * u;
        const v = (6 + random(seed + "v" + i) * 10) * u * speed;
        const y = -150 * u - random(seed + "y" + i) * height * 0.6 + frame * v;
        const rot = (random(seed + "r" + i) - 0.5) * 60 + frame * 2;
        return (
          <div key={i} style={{ position: "absolute", left: x, top: y, transform: `rotate(${rot}deg)`, opacity: 0.9 }}>
            {render(i, sz)}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// Money counter. `locale`/`currency` follow Intl (e.g. "en-US"/"USD", "pt-BR"/"BRL").
export const Counter: React.FC<{ from: number; to: number; frames: number; delay?: number; size: number; color: string; glow?: string; locale?: string; currency?: string }> = ({ from, to, frames, delay = 0, size, color, glow, locale = "en-US", currency = "USD" }) => {
  const frame = useCurrentFrame();
  const u = useU();
  const p = interpolate(frame - delay, [0, frames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const v = from + (to - from) * p;
  const pop = usePop(delay);
  const fmt = (n: number) => n.toLocaleString(locale, { style: "currency", currency });
  const fs = useFit(fmt(to), size, 900, 0.86);
  return (
    <div style={{ fontFamily: FONT, fontSize: fs, fontWeight: 900, color, letterSpacing: "-0.05em", fontVariantNumeric: "tabular-nums", opacity: pop, transform: `scale(${interpolate(pop, [0, 1], [0.6, 1])})`, textShadow: glow ? `0 0 ${70 * u}px ${glow}` : undefined, whiteSpace: "nowrap" }}>
      {fmt(v)}
    </div>
  );
};

export { FONT, FONT_MONO };

// Explosion: particles leave the center (or `origin`), with gravity, spin and shrinking. `render` draws each one.
export const Explosion: React.FC<{ delay: number; n?: number; seed: string; force?: number; origin?: [number, number]; render: (i: number, size: number) => React.ReactNode; size?: [number, number]; gravity?: number }> = ({ delay, n = 26, seed, force = 1, origin = [0.5, 0.5], render, size = [40, 90], gravity = 1 }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const u = useU();
  const f = frame - delay;
  if (f < 0 || f > 2.2 * fps) return null;
  const s = f / fps;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: n }).map((_, i) => {
        const ang = random(seed + "a" + i) * Math.PI * 2;
        const v = (900 + random(seed + "v" + i) * 1500) * u * force; // px/s
        const x = origin[0] * width + Math.cos(ang) * v * s * Math.exp(-s * 1.2);
        const y = origin[1] * height + Math.sin(ang) * v * s * Math.exp(-s * 1.2) + 1400 * u * gravity * s * s;
        const t = (size[0] + random(seed + "t" + i) * (size[1] - size[0])) * u;
        const rot = (random(seed + "r" + i) - 0.5) * 900 * s;
        const op = interpolate(s, [0, 0.05, 1.4, 2], [0, 1, 1, 0], { extrapolateRight: "clamp" });
        const sc = interpolate(s, [0, 0.12, 2], [0.3, 1.15, 0.7], { extrapolateRight: "clamp" });
        return (
          <div key={i} style={{ position: "absolute", left: x - t / 2, top: y - t / 2, width: t, height: t, opacity: op, transform: `rotate(${rot}deg) scale(${sc})` }}>
            {render(i, t)}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// Shockwave: ring that expands and fades.
export const Shockwave: React.FC<{ delay: number; color: string; thickness?: number }> = ({ delay, color, thickness = 26 }) => {
  const frame = useCurrentFrame();
  const u = useU();
  const f = frame - delay;
  if (f < 0 || f > 22) return null;
  const r = interpolate(f, [0, 22], [80, 1500], { easing: Easing.out(Easing.cubic) }) * u;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ width: r, height: r, borderRadius: "50%", border: `${thickness * u * (1 - f / 22)}px solid ${color}`, opacity: 1 - f / 22, boxShadow: `0 0 ${60 * u}px ${color}` }} />
    </AbsoluteFill>
  );
};

// Golden "3D" coin (gradient + rim) with a dollar sign.
export const Coin: React.FC<{ size: number }> = ({ size }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #fff6b0, #f7c531 45%, #c88a06 100%)", border: `${size * 0.07}px solid #a86f00`, display: "grid", placeItems: "center", color: "#8a5a00", fontWeight: 900, fontSize: size * 0.55, fontFamily: FONT, boxShadow: `0 ${size * 0.08}px ${size * 0.2}px rgba(0,0,0,0.35)` }}>$</div>
);

export const Confetti: React.FC<{ size: number; i: number; colors?: string[] }> = ({ size, i, colors = ["#0088ff", "#ffffff", "#22c55e", "#facc15", "#ff3b30"] }) => (
  <div style={{ width: size * 0.4, height: size * 0.7, borderRadius: size * 0.08, background: colors[i % colors.length] }} />
);

// Pulse on the music beat: 1 → 0 right after each onset.
export const pulseOnBeat = (t: number, onsets: number[], decay = 9) => {
  let last = -10;
  for (const o of onsets) {
    if (o <= t) last = o;
    else break;
  }
  return Math.exp(-(t - last) * decay);
};

// Green banknote (for "sale" explosions).
export const Bill: React.FC<{ size: number; i?: number }> = ({ size, i = 0 }) => (
  <div style={{ width: size * 1.6, height: size * 0.75, borderRadius: size * 0.08, background: i % 2 ? "linear-gradient(135deg, #2fbf71, #178a4c)" : "linear-gradient(135deg, #3ed183, #1d9a57)", border: `${size * 0.04}px solid #0f6b39`, display: "grid", placeItems: "center", color: "#e9ffef", fontWeight: 900, fontFamily: FONT, fontSize: size * 0.42, boxShadow: `0 ${size * 0.06}px ${size * 0.16}px rgba(0,0,0,0.3)` }}>
    <div style={{ width: size * 0.5, height: size * 0.5, borderRadius: "50%", border: `${size * 0.04}px solid rgba(255,255,255,0.6)`, display: "grid", placeItems: "center" }}>$</div>
  </div>
);

// Sales chart going up: card with grid and axis, the line draws from bottom to top; from its tip a green arrow shoots
// up and BURSTS into bills and coins (with shockwave, flash and the value). `tArrow` = frame of the burst (e.g. "sold!").
export const ChartArrow: React.FC<{ tLine?: number; tArrow: number; value?: string; width?: number; title?: string }> = ({ tLine = 0, tArrow, value = "+$3,480", width = 820, title = "Sales" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const u = useU();
  const W = width * u;
  const H = W * 0.56;
  const enter = spring({ frame: frame - tLine, fps, config: { damping: 14, stiffness: 180 } });
  const line = interpolate(frame - tLine, [4, Math.max(8, tArrow - tLine)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const pts: [number, number][] = [[0.04, 0.82], [0.18, 0.7], [0.3, 0.76], [0.44, 0.55], [0.56, 0.6], [0.7, 0.38], [0.82, 0.3], [0.94, 0.12]];
  const d = pts.map((p, k) => `${k ? "L" : "M"} ${p[0] * 100} ${p[1] * 100}`).join(" ");
  const tip = pts[pts.length - 1];
  const arrow = interpolate(frame - tArrow, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const valuePop = spring({ frame: frame - tArrow - 4, fps, config: { damping: 9, stiffness: 240 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ position: "relative", width: W, height: H, transform: `translateY(${(1 - enter) * 200 * u}px) scale(${0.8 + 0.2 * enter})`, opacity: enter }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: 34 * u, background: "#fff", boxShadow: `0 ${24 * u}px ${60 * u}px rgba(0,0,0,0.35)` }} />
        <div style={{ position: "absolute", left: 30 * u, top: 22 * u, fontFamily: FONT, fontWeight: 800, fontSize: 36 * u, color: "#0f1015" }}>{title}</div>
        <div style={{ position: "absolute", right: 30 * u, top: 26 * u, width: 120 * u, height: 26 * u, borderRadius: 13 * u, background: "#e6e8ee" }} />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", left: "6%", right: "12%", top: "22%", bottom: "8%", width: "82%", height: "70%", overflow: "visible" }}>
          {[20, 40, 60, 80].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="#e6e8ee" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />)}
          <path d={`${d} L ${tip[0] * 100} 100 L 4 100 Z`} fill="rgba(34,197,94,0.14)" style={{ clipPath: `inset(0 ${100 - line * 100}% 0 0)` }} />
          <path d={d} fill="none" stroke="#16a34a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - line} vectorEffect="non-scaling-stroke" style={{ strokeWidth: 7 * u }} />
        </svg>
        {/* arrow shooting from the tip */}
        {arrow > 0 && (
          <div style={{ position: "absolute", left: `${6 + tip[0] * 82}%`, top: `${22 + tip[1] * 70}%`, transform: `translate(-50%, -100%) translateY(${-arrow * 420 * u}px) scale(${0.6 + arrow * 1.2})`, opacity: 1 - Math.max(0, (arrow - 0.85) / 0.15) }}>
            <svg width={120 * u} height={200 * u} viewBox="0 0 60 100">
              <path d="M30 0 L60 38 L42 38 L42 100 L18 100 L18 38 L0 38 Z" fill="#22c55e" stroke="#0f6b39" strokeWidth="3" />
            </svg>
          </div>
        )}
        {/* value bursting */}
        <div style={{ position: "absolute", left: 10 * u, top: -120 * u, zIndex: 3, fontFamily: FONT, fontWeight: 900, fontSize: 96 * u, color: "#22c55e", WebkitTextStroke: `${8 * u}px #0f1015`, paintOrder: "stroke fill", transform: `scale(${valuePop}) rotate(${(1 - valuePop) * -14 - 4}deg)`, whiteSpace: "nowrap", filter: `drop-shadow(0 ${10 * u}px ${20 * u}px rgba(0,0,0,0.35))` }}>{value}</div>
      </div>
      <Shockwave delay={tArrow + 10} color="#22c55e" thickness={40} />
      {frame >= tArrow + 10 && frame < tArrow + 14 && <AbsoluteFill style={{ background: "#fff", opacity: 0.5 }} />}
      <Explosion delay={tArrow + 10} seed="chartBills" n={22} force={1.3} size={[50, 90]} origin={[0.72, 0.28]} render={(i, t) => <Bill size={t} i={i} />} />
      <Explosion delay={tArrow + 11} seed="chartCoins" n={18} force={1.1} size={[45, 85]} origin={[0.72, 0.28]} render={(_, t) => <Coin size={t} />} />
    </AbsoluteFill>
  );
};

// Virtual camera: zoom/pan by keyframes over the content. Each keyframe = { f: frame, s: zoom, x, y: point (frame px)
// that ends up in the CENTER of the screen }. Between keyframes: ease in-out; motion blur proportional to speed.
// E.g. zoom into the arrow and back out: [{f:0,s:1,x:540,y:960},{f:14,s:2.4,x:800,y:1150},{f:30,s:2.4,x:780,y:950},{f:42,s:1,x:540,y:960}]
export type CamKey = { f: number; s: number; x: number; y: number };
export const Camera: React.FC<{ keys: CamKey[]; children: React.ReactNode; blur?: number }> = ({ keys, children, blur = 10 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const at = (fr: number) => {
    const fs = keys.map((k) => k.f);
    const opt = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const, easing: Easing.inOut(Easing.cubic) };
    return { s: interpolate(fr, fs, keys.map((k) => k.s), opt), x: interpolate(fr, fs, keys.map((k) => k.x), opt), y: interpolate(fr, fs, keys.map((k) => k.y), opt) };
  };
  const c = at(frame);
  const p = at(frame - 1);
  const vel = Math.abs(c.s - p.s) * 3 + (Math.abs(c.x - p.x) + Math.abs(c.y - p.y)) / 250;
  // the content point (x,y) moves to the center as the zoom grows; at s=1 the scene stays in place
  const k = Math.min(1, Math.max(0, c.s - 1));
  const tx = (width / 2 - c.x * c.s) * k;
  const ty = (height / 2 - c.y * c.s) * k;
  const fx = (1 - k) * (width / 2) * (1 - c.s); // at s≈1 keeps the center
  const fy = (1 - k) * (height / 2) * (1 - c.s);
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ transformOrigin: "0 0", transform: `translate(${tx + fx}px, ${ty + fy}px) scale(${c.s})`, filter: vel > 0.12 ? `blur(${Math.min(blur, vel * blur)}px)` : undefined }}>
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
