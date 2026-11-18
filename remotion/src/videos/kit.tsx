// Shared pieces of the data-driven ad templates (MotionAd, RetailOffers, AppShowcase): brand theme with fonts,
// the music beat grid (beats.json or a fixed BPM), scene timing, text that fits the width, icons and media checks.
import { useEffect, useState } from "react";
import { Easing, continueRender, delayRender, getStaticFiles, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { fitText } from "@remotion/layout-utils";
import * as Remix from "@remixicon/react";
import type { RemixiconComponentType } from "@remixicon/react";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadFraunces } from "@remotion/google-fonts/Fraunces";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadDMSans } from "@remotion/google-fonts/DMSans";
import { loadFont as loadSpaceGrotesk } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadInstrumentSerif } from "@remotion/google-fonts/InstrumentSerif";
import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadBricolage } from "@remotion/google-fonts/BricolageGrotesque";
import { loadFont as loadJetBrainsMono } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadPlexMono } from "@remotion/google-fonts/IBMPlexMono";
import { DEFAULT_THEME, Theme, fetchJson } from "../components/theme";
import type { Word } from "../components/Captions";

// ---------- theme ----------

/** Theme of the ad templates: the shared brand Theme + a light paper color, an ink color and two Google fonts. */
export type AdTheme = Theme & {
  light: string; // light background (cream/paper)
  ink: string; // text on light backgrounds
  display: string; // headings / prices (font name, see FONTS)
  body: string; // small text
};
export const DEFAULT_AD_THEME: AdTheme = { ...DEFAULT_THEME, light: "#f2f1ee", ink: "#0b0c0f", display: "Inter", body: "Inter" };
export const withAdTheme = (t?: Partial<AdTheme>): AdTheme => ({ ...DEFAULT_AD_THEME, ...(t ?? {}) });

/** Named backgrounds a scene can ask for; anything else is taken as a CSS color. */
export type BgName = "dark" | "accent" | "light" | "highlight";
export const bgColor = (theme: AdTheme, bg: string): string =>
  bg === "dark" ? theme.background : bg === "accent" ? theme.accent : bg === "light" ? theme.light : bg === "highlight" ? theme.highlight : bg;

function luminance(color: string) {
  const h = color.replace("#", "");
  if (!/^[0-9a-f]{3,6}$/i.test(h)) return 0;
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
export const isLight = (color: string) => luminance(color) > 0.4;

/** Foreground (text) and emphasis colors that read well on a background. */
export function onBg(theme: AdTheme, bg: string): { fg: string; em: string; dim: string } {
  const c = bgColor(theme, bg);
  if (bg === "dark") return { fg: theme.light, em: theme.highlight, dim: "rgba(255,255,255,0.62)" };
  if (bg === "accent") return { fg: theme.light, em: theme.ink, dim: "rgba(255,255,255,0.75)" };
  if (bg === "light") return { fg: theme.ink, em: theme.accent, dim: "rgba(0,0,0,0.55)" };
  return isLight(c) ? { fg: theme.ink, em: theme.ink, dim: "rgba(0,0,0,0.58)" } : { fg: "#ffffff", em: theme.highlight, dim: "rgba(255,255,255,0.7)" };
}

// ---------- fonts ----------

type Loaded = { fontFamily: string; waitUntilDone: () => Promise<unknown> };
const L: ("latin" | "latin-ext")[] = ["latin", "latin-ext"];
/** Fonts a theme can name. Add one: import its loader from @remotion/google-fonts and list the weights it has. */
const FONTS: Record<string, () => Loaded> = {
  Inter: () => loadInter("normal", { weights: ["400", "500", "600", "700", "800", "900"], subsets: L }),
  Fraunces: () => loadFraunces("normal", { weights: ["400", "500", "600", "700", "800", "900"], subsets: L }),
  Anton: () => loadAnton("normal", { weights: ["400"], subsets: L }),
  "DM Sans": () => loadDMSans("normal", { weights: ["400", "500", "600", "700", "800", "900"], subsets: L }),
  "Space Grotesk": () => loadSpaceGrotesk("normal", { weights: ["400", "500", "600", "700"], subsets: L }),
  "Instrument Serif": () => loadInstrumentSerif("normal", { weights: ["400"], subsets: L }),
  "Playfair Display": () => loadPlayfair("normal", { weights: ["400", "500", "600", "700", "800", "900"], subsets: L }),
  Poppins: () => loadPoppins("normal", { weights: ["400", "500", "600", "700", "800", "900"], subsets: L }),
  Montserrat: () => loadMontserrat("normal", { weights: ["400", "500", "600", "700", "800", "900"], subsets: L }),
  "Bricolage Grotesque": () => loadBricolage("normal", { weights: ["400", "500", "600", "700", "800"], subsets: L }),
  // monospace (code, table and column names)
  "JetBrains Mono": () => loadJetBrainsMono("normal", { weights: ["400", "500", "600", "700"], subsets: L }),
  "IBM Plex Mono": () => loadPlexMono("normal", { weights: ["400", "500", "600", "700"], subsets: L }),
};
const fontCache = new Map<string, { family: string; done: Promise<void> }>();
/** A whitelisted font by name (unknown → Inter): its CSS family and a promise that resolves once it is loaded. */
export function getFont(name: string) {
  const key = FONTS[name] ? name : "Inter";
  let f = fontCache.get(key);
  if (!f) {
    const l = FONTS[key]();
    f = { family: l.fontFamily, done: l.waitUntilDone().then(() => undefined, () => undefined) };
    fontCache.set(key, f);
  }
  return f;
}

/** Loads the theme fonts once and re-renders when they are ready (text fitting measures the real glyphs). */
export function useBrandFonts(theme: AdTheme) {
  const d = getFont(theme.display);
  const b = getFont(theme.body);
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("brand fonts"));
  useEffect(() => {
    Promise.all([d.done, b.done]).then(() => {
      setReady(true);
      continueRender(handle);
    });
  }, [d, b, handle]);
  return { display: `"${d.family}", sans-serif`, body: `"${b.family}", sans-serif`, displayName: d.family, ready };
}

// ---------- rhythm ----------

/** Music beats: real onsets (from <music>.beats.json, scripts/music_beats.py) or a fixed BPM grid. */
export type Rhythm = { interval: number; anchor: number; onsets: number[] | null };
export type Music = { file: string; volume?: number; start?: number; beats?: string };

/** public/ path of a job file; "library/..." stays relative to public/. */
export const mediaPath = (slug: string, file: string) => (file.startsWith("library/") ? file : `${slug}/${file}`);
export const hasFile = (path: string) => getStaticFiles().some((f) => f.name === path);

export async function loadRhythm(slug: string, music: Music | undefined, bpm: number): Promise<Rhythm> {
  const grid: Rhythm = { interval: 60 / bpm, anchor: 0, onsets: null };
  if (!music?.file) return grid;
  const path = mediaPath(slug, music.beats ?? music.file.replace(/\.[^.]+$/, "") + ".beats.json");
  const b = await fetchJson<{ onsets?: number[]; interval?: number | null }>(staticFile(path));
  const start = music.start ?? 0;
  const onsets = (b?.onsets ?? []).map((o) => o - start).filter((o) => o >= 0);
  if (!onsets.length) return grid;
  let interval = b?.interval ?? 0;
  if (!interval || interval < 0.2 || interval > 2) {
    const d = onsets.slice(1).map((o, i) => o - onsets[i]).filter((x) => x > 0.2 && x < 1.5).sort((a, c) => a - c);
    interval = d.length ? d[Math.floor(d.length / 2)] : grid.interval;
  }
  return { interval, anchor: onsets[0] % interval, onsets };
}

/** 1 right on a beat, decaying to 0 before the next one. */
export function beatPulse(t: number, r: Rhythm, decay = 8) {
  if (r.onsets) {
    let last = -10;
    for (const o of r.onsets) {
      if (o <= t + 1e-3) last = o;
      else break;
    }
    return Math.exp(-(t - last) * decay);
  }
  const age = (((t - r.anchor) % r.interval) + r.interval) % r.interval;
  return Math.exp(-age * decay);
}

/** Snaps a time to the nearest beat of the grid. */
export const snap = (t: number, r: Rhythm) => r.anchor + Math.round((t - r.anchor) / r.interval) * r.interval;

// ---------- timing ----------

export type Timed = { beats?: number; seconds?: number; word?: number };
export type Slot = { from: number; dur: number }; // seconds

/** Lays scenes end to end: each lasts `seconds`, or `beats` × beat interval (default `defaultBeats`).
 *  With narration, a scene with `word` (index into the alignment) starts at that word and the previous one stretches. */
export function layoutScenes(scenes: Timed[], r: Rhythm, defaultBeats: number, words: Word[] | null, startAt = 0): Slot[] {
  const own = scenes.map((s) => s.seconds ?? (s.beats ?? defaultBeats) * r.interval);
  const starts: number[] = [];
  let t = startAt;
  scenes.forEach((s, i) => {
    const w = s.word !== undefined && words ? words[Math.min(s.word, words.length - 1)] : null;
    const at = i === 0 ? startAt : w ? Math.max(starts[i - 1] + 0.3, w.start - 0.06) : t;
    starts.push(at);
    t = at + own[i];
  });
  return scenes.map((_, i) => ({ from: starts[i], dur: i + 1 < scenes.length ? starts[i + 1] - starts[i] : own[i] }));
}

export async function loadWords(slug: string, alignment?: string): Promise<Word[] | null> {
  if (!alignment) return null;
  const a = await fetchJson<{ words: Word[] }>(staticFile(`${slug}/${alignment}`));
  return a?.words?.filter((w) => w.text.trim()) ?? null;
}

// ---------- motion helpers ----------

export const EXPO = Easing.bezier(0.16, 1, 0.3, 1);
/** 0 → 1 over `frames` from `delay`, expo-out (no bounce). */
export const useIn = (delay = 0, frames = 16) => {
  const frame = useCurrentFrame();
  return interpolate(frame - delay, [0, frames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EXPO });
};
/** 1 = 1/1080 of the smaller side; `v` sizes stacked layouts by frame height (1.12 in 9:16, 0.9 in 4:5, 0.78 in 1:1). */
export const useUnits = () => {
  const { width, height } = useVideoConfig();
  const u = Math.min(width, height) / 1080;
  const ratio = height / width;
  return { u, v: ratio > 1.5 ? 1.12 : ratio > 1.1 ? 0.9 : 0.78, tall: ratio > 1.5, square: ratio < 1.1, width, height };
};

/** Font size so the longest line fits `margin` × width (measured with the real font). */
export function useFitSize(lines: string[], font: string, weight: number, max: number, margin = 0.84, letterSpacing = "-0.03em") {
  const { width } = useVideoConfig();
  const { u } = useUnits();
  let size = max * u;
  for (const l of lines) {
    if (!l.trim()) continue;
    const { fontSize } = fitText({ text: l, withinWidth: width * margin, fontFamily: font, fontWeight: String(weight), letterSpacing });
    size = Math.min(size, fontSize);
  }
  return size;
}

/** "text with *accent*" → parts; the accented part is drawn in `em` (italic when the display font is a serif). */
export const splitAccent = (text: string) => text.split(/(\*[^*]+\*)/).filter(Boolean).map((p) => (p.startsWith("*") ? { t: p.slice(1, -1), em: true } : { t: p, em: false }));
export const plain = (text: string) => text.replace(/\*/g, "");

/** Headline: lines rise out of a mask word by word, all lines at the same size (fits the width). Clean text only. */
export const Headline: React.FC<{ text: string; font: string; color: string; em: string; max: number; weight?: number; delay?: number; italicEm?: boolean; margin?: number; lineHeight?: number; align?: "center" | "left" }> = ({ text, font, color, em, max, weight = 800, delay = 0, italicEm = false, margin = 0.84, lineHeight = 1.0, align = "center" }) => {
  const frame = useCurrentFrame();
  const lines = text.split("\n");
  const size = useFitSize(lines.map(plain), font, weight, max, margin);
  let k = 0;
  return (
    <div style={{ fontFamily: font, fontWeight: weight, fontSize: size, lineHeight, letterSpacing: "-0.03em", color, textAlign: align }}>
      {lines.map((line, li) => (
        <div key={li} style={{ overflow: "hidden", paddingBottom: size * 0.12, marginBottom: -size * 0.12, whiteSpace: "nowrap" }}>
          {splitAccent(line).map((part, pi) =>
            part.t.split(/(\s+)/).map((w, wi) => {
              if (!w.trim()) return <span key={`${pi}-${wi}`} style={{ whiteSpace: "pre" }}>{w}</span>;
              const p = interpolate(frame - delay - k++ * 2.5, [0, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EXPO });
              return (
                <span key={`${pi}-${wi}`} style={{ display: "inline-block", transform: `translateY(${(1 - p) * 105}%)`, color: part.em ? em : undefined, fontStyle: part.em && italicEm ? "italic" : undefined }}>
                  {w}
                </span>
              );
            }),
          )}
        </div>
      ))}
    </div>
  );
};

// ---------- icons ----------

const ALIASES: Record<string, string> = {
  coffee: "RiCupLine", cup: "RiCupLine", time: "RiTimeLine", timer: "RiTimerFlashLine", walk: "RiWalkLine", phone: "RiSmartphoneLine",
  cart: "RiShoppingCart2Line", bag: "RiShoppingBag3Line", store: "RiStore2Line", pin: "RiMapPin2Line", gift: "RiGiftLine",
  coupon: "RiCoupon3Line", percent: "RiPercentLine", star: "RiStarFill", heart: "RiHeart3Line", check: "RiCheckLine",
  bolt: "RiFlashlightLine", fire: "RiFireLine", sparkle: "RiSparkling2Line", leaf: "RiLeafLine", cake: "RiCake3Line",
  food: "RiRestaurantLine", money: "RiMoneyDollarCircleLine", truck: "RiTruckLine", chat: "RiChat3Line", bell: "RiNotification3Line",
  download: "RiDownload2Line", qr: "RiQrCodeLine", user: "RiUser3Line", calendar: "RiCalendarLine",
};
/** Remix icon by short alias ("coffee") or component name ("RiCupLine"). Unknown → sparkle. */
export function icon(name?: string): RemixiconComponentType {
  const lib = Remix as unknown as Record<string, RemixiconComponentType>;
  if (!name) return lib.RiSparkling2Line;
  return lib[ALIASES[name] ?? name] ?? lib.RiSparkling2Line;
}
