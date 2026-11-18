// MotionAd: explosive motion ad, all from data (public/<slug>/ad.json). One idea per scene, each scene on its own
// background color, giant clean type, Remix icons, price counter, confetti/coin bursts, a pulse on every beat,
// optional narration with word-synced captions, at most one AI scene, end card.
// Timing: every scene lasts N beats of the music (beats.json next to the track) or of a fixed BPM grid; with narration,
// `word` pins a scene to a word of the alignment.
import { AbsoluteFill, Audio, CalculateMetadataFunction, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Format, FPS, PLACEHOLDER_SECONDS, SIZE } from "../components/formats";
import { fetchJson, rgba } from "../components/theme";
import { Placeholder } from "../components/Placeholder";
import { Captions, Word } from "../components/Captions";
import { EndCard } from "../components/EndCard";
import { AiScene } from "../components/AiScene";
import { Coin, Confetti, Explosion, Shockwave, Sparkles } from "../motion/beats";
import { AdTheme, EXPO, Headline, Music, Rhythm, Slot, Timed, beatPulse, bgColor, hasFile, icon, layoutScenes, loadRhythm, loadWords, mediaPath, onBg, plain, splitAccent, useBrandFonts, useFitSize, useIn, useUnits, withAdTheme } from "./kit";

type Burst = "confetti" | "coins" | "icons" | "none";
type Base = Timed & { background?: string; burst?: Burst };
export type AdScene = Base &
  (
    | { type: "title"; kicker?: string; text: string; sub?: string; icon?: string }
    | { type: "price"; label?: string; from?: number; to: number; prefix?: string; suffix?: string; decimals?: number; currency?: string; was?: string; note?: string; icon?: string }
    | { type: "list"; title?: string; items: { icon?: string; text: string }[] }
    | { type: "cross"; kicker?: string; text: string; sub?: string }
    | { type: "coupon"; kicker?: string; value: string; code: string; note?: string }
    | { type: "scene"; image?: string; video?: string; text?: string; focus?: string; icon?: string }
    | { type: "end"; title: string; subtitle?: string; cta?: string; logo?: string; name?: string; icon?: string }
  );
export type AdData = {
  theme?: Partial<AdTheme>;
  locale?: string; // number formatting (default en-US)
  currency?: string; // ISO code for price scenes that ask for currency formatting (default none)
  music?: Music; // file in public/<slug>/ (or library/...); beats from <file>.beats.json
  bpm?: number; // beat grid when there is no music / no beats file (default 112)
  beatsPerScene?: number; // default 4
  narration?: { file: string; alignment: string; highlights?: string[] };
  sfx?: boolean; // whoosh/pop from library/sfx when present
  scenes: AdScene[];
};
type Props = { slug: string; format: Format; data?: AdData; rhythm?: Rhythm; words?: Word[] | null; slots?: Slot[] };

const CYCLE = ["dark", "accent", "light", "highlight"];

export const calculateMotionAdMetadata: CalculateMetadataFunction<Props> = async ({ props }) => {
  const [width, height] = SIZE[props.format];
  const data = props.slug ? await fetchJson<AdData>(staticFile(`${props.slug}/ad.json`)) : null;
  if (!data?.scenes?.length) return { durationInFrames: PLACEHOLDER_SECONDS * FPS, width, height, props };
  const rhythm = await loadRhythm(props.slug, data.music, data.bpm ?? 112);
  const words = await loadWords(props.slug, data.narration?.alignment);
  const slots = layoutScenes(data.scenes, rhythm, data.beatsPerScene ?? 4, words);
  const last = slots[slots.length - 1];
  const end = Math.max(last.from + last.dur, words?.length ? words[words.length - 1].end + 0.5 : 0);
  slots[slots.length - 1] = { ...last, dur: end - last.from };
  return { durationInFrames: Math.ceil(end * FPS), width, height, props: { ...props, data, rhythm, words, slots } };
};

export const MotionAd: React.FC<Props> = ({ slug, format, data, rhythm, words, slots }) => {
  const theme = withAdTheme(data?.theme);
  const fonts = useBrandFonts(theme);
  const frame = useCurrentFrame();
  const { fps, height, durationInFrames } = useVideoConfig();
  if (!data?.scenes?.length || !rhythm || !slots) return <Placeholder title="MotionAd" hint={`No data: put ad.json in public/${slug || "<slug>"}/ (see examples/).`} />;
  const t = frame / fps;
  const pulse = beatPulse(t, rhythm);
  const bgs = data.scenes.map((s, i) => s.background ?? (s.type === "end" ? "dark" : CYCLE[i % CYCLE.length]));
  const captions = !!words?.length;
  const lift = captions ? -0.05 * height : 0;
  const musicFile = data.music?.file ? mediaPath(slug, data.music.file) : null;
  const narrationFile = data.narration ? `${slug}/${data.narration.file}` : null;
  const musicVolume = (f: number) =>
    (narrationFile ? 0.16 : 0.7) * interpolate(f, [durationInFrames - 0.8 * fps, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: bgColor(theme, bgs[0]), fontFamily: fonts.body }}>
      {data.scenes.map((s, i) => (
        <Sequence key={i} from={Math.round(slots[i].from * fps)} durationInFrames={Math.max(1, Math.round((slots[i].from + slots[i].dur) * fps) - Math.round(slots[i].from * fps))}>
          <Shell theme={theme} bg={bgs[i]} prev={i ? bgs[i - 1] : bgs[i]} index={i} pulse={pulse} lift={lift} plainBg={s.type === "end" || s.type === "scene"}>
            <SceneView s={s} theme={theme} bg={bgs[i]} fonts={fonts} rhythm={rhythm} data={data} slug={slug} format={format} i={i} />
          </Shell>
          {data.sfx && i > 0 && hasFile("library/sfx/whoosh.mp3") && <Audio src={staticFile("library/sfx/whoosh.mp3")} volume={0.35} />}
        </Sequence>
      ))}
      {captions && <Captions words={words!} highlights={data.narration?.highlights ?? []} highlightColor={theme.accent} y={height * (format === "9:16" ? 0.8 : 0.85)} size={format === "9:16" ? 66 : 56} variant="pill" until={slots[slots.length - 1].from} />}
      {narrationFile && hasFile(narrationFile) && <Audio src={staticFile(narrationFile)} />}
      {musicFile && hasFile(musicFile) && <Audio src={staticFile(musicFile)} startFrom={Math.round((data.music?.start ?? 0) * fps)} volume={musicVolume} />}
    </AbsoluteFill>
  );
};

// Scene frame: the new background opens over the previous one (circle or slide, alternating), a soft light that
// flashes on each beat, two large drifting discs, and the content breathing with the pulse. No grain, no blur.
const Shell: React.FC<{ theme: AdTheme; bg: string; prev: string; index: number; pulse: number; lift: number; plainBg?: boolean; children: React.ReactNode }> = ({ theme, bg, prev, index, pulse, lift, plainBg, children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { u } = useUnits();
  const open = useIn(0, 13);
  const color = bgColor(theme, bg);
  const { em } = onBg(theme, bg);
  const mode = index % 3;
  const clip = mode === 0 ? `circle(${open * 140}% at 50% 55%)` : mode === 1 ? `inset(${(1 - open) * 100}% 0 0 0)` : `inset(0 0 0 ${(1 - open) * 100}%)`;
  const drift = frame / durationInFrames;
  const contentIn = useIn(3, 18);
  return (
    <AbsoluteFill style={{ background: bgColor(theme, prev), overflow: "hidden" }}>
      <AbsoluteFill style={{ background: color, clipPath: open < 1 ? clip : undefined }}>
        {!plainBg && (
          <>
            <div style={{ position: "absolute", width: 1300 * u, height: 1300 * u, borderRadius: "50%", left: `${-30 + drift * 8}%`, top: `${-18 + drift * 4}%`, background: rgba(em.startsWith("#") ? em : "#ffffff", 0.07) }} />
            <div style={{ position: "absolute", width: 900 * u, height: 900 * u, borderRadius: "50%", right: `${-28 + drift * 6}%`, bottom: `${-14 - drift * 5}%`, border: `${3 * u}px solid ${rgba(em.startsWith("#") ? em : "#ffffff", 0.16)}` }} />
            <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 45% at 50% 38%, rgba(255,255,255,${0.1 + 0.08 * pulse}), transparent 70%)` }} />
          </>
        )}
        <AbsoluteFill style={{ transform: `translateY(${lift + (1 - contentIn) * 40 * u}px) scale(${1 + 0.012 * pulse})`, alignItems: "center", justifyContent: "center" }}>{children}</AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

type Fonts = ReturnType<typeof useBrandFonts>;
type ViewProps = { s: AdScene; theme: AdTheme; bg: string; fonts: Fonts; rhythm: Rhythm; data: AdData; slug: string; format: Format; i: number };

const SceneView: React.FC<ViewProps> = (p) => {
  switch (p.s.type) {
    case "title":
      return <TitleScene {...p} s={p.s} />;
    case "price":
      return <PriceScene {...p} s={p.s} />;
    case "list":
      return <ListScene {...p} s={p.s} />;
    case "cross":
      return <CrossScene {...p} s={p.s} />;
    case "coupon":
      return <CouponScene {...p} s={p.s} />;
    case "scene":
      return <AiSceneView {...p} s={p.s} />;
    case "end":
      return <EndScene {...p} s={p.s} />;
  }
};

const isSerif = (f: Fonts) => /fraunces|serif|playfair/i.test(f.displayName);

const Kicker: React.FC<{ text: string; color: string; font: string; delay?: number }> = ({ text, color, font, delay = 0 }) => {
  const { u, v } = useUnits();
  const p = useIn(delay, 14);
  return <div style={{ fontFamily: font, fontWeight: 600, fontSize: 40 * u * v, letterSpacing: "0.16em", textTransform: "uppercase", color, opacity: p, transform: `translateY(${(1 - p) * 16 * u}px)`, whiteSpace: "nowrap" }}>{text}</div>;
};

const Pill: React.FC<{ text: string; color: string; background: string; font: string; delay?: number; size?: number }> = ({ text, color, background, font, delay = 0, size = 50 }) => {
  const { u, v } = useUnits();
  const p = useIn(delay, 16);
  return (
    <div style={{ position: "relative", padding: `${12 * u * v}px ${34 * u * v}px`, fontFamily: font, fontWeight: 700, fontSize: size * u * v, color, whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>
      <div style={{ position: "absolute", inset: 0, background, borderRadius: 999, transformOrigin: "left center", transform: `scaleX(${p})` }} />
      <span style={{ position: "relative", opacity: interpolate(p, [0.4, 1], [0, 1], { extrapolateLeft: "clamp" }) }}>{text}</span>
    </div>
  );
};

const IconBadge: React.FC<{ name?: string; color: string; background: string; size: number; delay?: number }> = ({ name, color, background, size, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, v } = useUnits();
  const p = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 200 } });
  const Icon = icon(name);
  const s = size * u * v;
  return (
    <div style={{ width: s, height: s, borderRadius: s * 0.3, background, display: "grid", placeItems: "center", transform: `scale(${p}) rotate(${(1 - p) * -14 + Math.sin(frame / 16) * 2}deg)`, boxShadow: `0 ${18 * u}px ${44 * u}px rgba(0,0,0,0.18)` }}>
      <Icon size={s * 0.54} color={color} />
    </div>
  );
};

const BurstFx: React.FC<{ kind?: Burst; theme: AdTheme; delay: number; seed: string; iconName?: string; origin?: [number, number] }> = ({ kind = "confetti", theme, delay, seed, iconName, origin = [0.5, 0.5] }) => {
  if (kind === "none") return null;
  const colors = [theme.accent, theme.highlight, theme.light, theme.ink];
  if (kind === "coins") return <Explosion delay={delay} seed={seed} n={18} force={1.1} size={[50, 90]} origin={origin} render={(_, t) => <Coin size={t} />} />;
  if (kind === "icons") {
    const Icon = icon(iconName);
    return <Explosion delay={delay} seed={seed} n={16} force={1} size={[50, 96]} origin={origin} gravity={0.6} render={(i, t) => <Icon size={t} color={[theme.light, theme.ink, theme.accent][i % 3]} />} />;
  }
  return <Explosion delay={delay} seed={seed} n={34} force={1.2} size={[36, 70]} origin={origin} render={(i, t) => <Confetti size={t} i={i} colors={colors} />} />;
};

const TitleScene: React.FC<ViewProps & { s: Extract<AdScene, { type: "title" }> }> = ({ s, theme, bg, fonts, i }) => {
  const { u, v } = useUnits();
  const c = onBg(theme, bg);
  const nLines = s.text.split("\n").length;
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 34 * u * v }}>
        {s.icon && <IconBadge name={s.icon} color={c.fg === theme.ink ? theme.light : bgColor(theme, bg)} background={c.em === c.fg ? c.fg : c.em} size={170} delay={0} />}
        {s.kicker && <Kicker text={s.kicker} color={c.dim} font={fonts.body} delay={2} />}
        <Headline text={s.text} font={fonts.display} color={c.fg} em={c.em} max={(nLines > 2 ? 150 : 190) * v} weight={800} delay={4} italicEm={isSerif(fonts)} />
        {s.sub && (
          <div style={{ marginTop: 10 * u }}>
            <Pill text={s.sub} color={bgColor(theme, bg)} background={c.em === c.fg ? c.fg : c.em} font={fonts.body} delay={14} />
          </div>
        )}
      </div>
      {s.burst && <BurstFx kind={s.burst} theme={theme} delay={10} seed={"t" + i} iconName={s.icon} />}
    </>
  );
};

function formatNumber(n: number, s: { prefix?: string; suffix?: string; decimals?: number; currency?: string }, locale: string, dataCurrency?: string) {
  // prefix/suffix win; otherwise the scene (or ad) currency formats it with Intl
  const currency = s.prefix === undefined && s.suffix === undefined ? s.currency ?? dataCurrency : undefined;
  const decimals = s.decimals ?? 0;
  if (currency) return n.toLocaleString(locale, { style: "currency", currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${s.prefix ?? ""}${n.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${s.suffix ?? ""}`;
}

const PriceScene: React.FC<ViewProps & { s: Extract<AdScene, { type: "price" }> }> = ({ s, theme, bg, fonts, data, i }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, v } = useUnits();
  const c = onBg(theme, bg);
  const locale = data.locale ?? "en-US";
  const count = interpolate(frame - 6, [0, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EXPO });
  const from = s.from ?? 0;
  const value = from + (s.to - from) * count;
  const finalText = formatNumber(s.to, s, locale, data.currency);
  const startText = formatNumber(from, s, locale, data.currency);
  const size = useFitSize([finalText.length > startText.length ? finalText : startText], fonts.display, 800, 330 * v, 0.8, "-0.04em");
  const land = 6 + 22;
  const punch = spring({ frame: frame - land, fps, config: { damping: 9, stiffness: 260 } });
  const scale = frame < land ? 1 : 1 + 0.08 * Math.sin(punch * Math.PI);
  return (
    <>
      <Shockwave delay={land} color={c.em} thickness={22} />
      <BurstFx kind={s.burst ?? "confetti"} theme={theme} delay={land} seed={"p" + i} iconName={s.icon} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 * u * v }}>
        {s.icon && <IconBadge name={s.icon} color={bgColor(theme, bg)} background={c.fg} size={130} />}
        {s.label && <Kicker text={s.label} color={c.dim} font={fonts.body} delay={0} />}
        {s.was && <Strike text={s.was} color={c.dim} font={fonts.display} delay={2} />}
        <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: size, lineHeight: 1, letterSpacing: "-0.04em", color: c.fg, fontVariantNumeric: "tabular-nums", transform: `scale(${scale})`, whiteSpace: "nowrap" }}>
          {formatNumber(Math.round(value * 10 ** (s.decimals ?? 0)) / 10 ** (s.decimals ?? 0), s, locale, data.currency)}
        </div>
        {s.note && (
          <div style={{ marginTop: 6 * u }}>
            <Pill text={s.note} color={bgColor(theme, bg)} background={c.fg} font={fonts.body} delay={land - 2} size={44} />
          </div>
        )}
      </div>
    </>
  );
};

const Strike: React.FC<{ text: string; color: string; font: string; delay: number }> = ({ text, color, font, delay }) => {
  const { u, v } = useUnits();
  const p = useIn(delay, 12);
  const line = useIn(delay + 8, 10);
  return (
    <div style={{ position: "relative", fontFamily: font, fontWeight: 600, fontSize: 64 * u * v, color, opacity: p }}>
      {text}
      <div style={{ position: "absolute", left: "-4%", top: "54%", height: 6 * u, width: `${108 * line}%`, background: color, borderRadius: 6 * u, transform: "rotate(-6deg)", transformOrigin: "left center" }} />
    </div>
  );
};

const ListScene: React.FC<ViewProps & { s: Extract<AdScene, { type: "list" }> }> = ({ s, theme, bg, fonts, rhythm }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const { u, v } = useUnits();
  const c = onBg(theme, bg);
  const step = Math.max(6, Math.round(rhythm.interval * fps));
  const rowSize = useFitSize(s.items.map((it) => it.text), fonts.display, 700, 76 * v, 0.6, "-0.02em");
  const box = 120 * u * v;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 56 * u * v, width: width * 0.86 }}>
      {s.title && <Headline text={s.title} font={fonts.display} color={c.fg} em={c.em} max={130 * v} weight={800} italicEm={isSerif(fonts)} />}
      <div style={{ display: "flex", flexDirection: "column", gap: 30 * u * v, alignItems: "flex-start" }}>
        {s.items.map((it, k) => {
          const d = 8 + k * step;
          const p = spring({ frame: frame - d, fps, config: { damping: 18, stiffness: 180 } });
          const Icon = icon(it.icon);
          return (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 30 * u * v, opacity: Math.min(1, p * 1.5), transform: `translateX(${(1 - p) * -60 * u}px)` }}>
              <div style={{ width: box, height: box, borderRadius: box * 0.3, background: c.em === c.fg ? c.fg : c.em, display: "grid", placeItems: "center", flexShrink: 0, transform: `scale(${0.6 + 0.4 * p})` }}>
                <Icon size={box * 0.52} color={bgColor(theme, bg)} />
              </div>
              <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: rowSize, color: c.fg, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
                <span style={{ fontFamily: fonts.body, fontWeight: 600, fontSize: rowSize * 0.5, color: c.dim, marginRight: 18 * u, verticalAlign: "middle", fontVariantNumeric: "tabular-nums" }}>{String(k + 1).padStart(2, "0")}</span>
                {it.text}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const CrossScene: React.FC<ViewProps & { s: Extract<AdScene, { type: "cross" }> }> = ({ s, theme, bg, fonts }) => {
  const { u, v } = useUnits();
  const c = onBg(theme, bg);
  const size = useFitSize([plain(s.text)], fonts.display, 800, 220 * v, 0.8);
  const line = useIn(12, 10);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 36 * u * v }}>
      {s.kicker && <Kicker text={s.kicker} color={c.dim} font={fonts.body} />}
      <div style={{ position: "relative" }}>
        <Headline text={s.text} font={fonts.display} color={c.fg} em={c.em} max={220 * v} margin={0.8} weight={800} delay={2} />
        <div style={{ position: "absolute", left: "-5%", top: "50%", height: size * 0.09, width: `${110 * line}%`, background: c.em === c.fg ? c.fg : c.em, borderRadius: size, transform: "rotate(-4deg)", transformOrigin: "left center" }} />
      </div>
      {s.sub && <Headline text={s.sub} font={fonts.display} color={c.fg} em={c.em} max={96 * v} weight={600} delay={20} italicEm={isSerif(fonts)} />}
    </div>
  );
};

const CouponScene: React.FC<ViewProps & { s: Extract<AdScene, { type: "coupon" }> }> = ({ s, theme, bg, fonts, i }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const { u, v } = useUnits();
  const c = onBg(theme, bg);
  const p = spring({ frame: frame - 2, fps, config: { damping: 15, stiffness: 150 } });
  const W = width * 0.74;
  const paper = bg === "light" ? theme.background : theme.light;
  const ink = bg === "light" ? theme.light : theme.ink;
  const valueSize = useFitSize([s.value], fonts.display, 800, 200 * v, 0.62);
  const code = useIn(14, 14);
  return (
    <>
      <BurstFx kind={s.burst ?? "confetti"} theme={theme} delay={16} seed={"c" + i} />
      <div style={{ width: W, transform: `translateY(${(1 - p) * 300 * u}px) rotate(${(1 - p) * 8 - 2}deg)`, opacity: Math.min(1, p * 2) }}>
        <div style={{ background: paper, color: ink, borderRadius: 40 * u, padding: `${52 * u * v}px ${48 * u}px`, boxShadow: `0 ${40 * u}px ${90 * u}px rgba(0,0,0,0.28)`, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 * u * v, position: "relative" }}>
          {s.kicker && <div style={{ fontFamily: fonts.body, fontWeight: 600, fontSize: 38 * u * v, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.6 }}>{s.kicker}</div>}
          <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: valueSize, lineHeight: 1, letterSpacing: "-0.04em", color: c.fg === theme.ink || bg === "light" ? ink : bgColor(theme, bg) }}>
            {splitAccent(s.value).map((pt, k) => <span key={k} style={{ color: pt.em ? theme.accent : undefined }}>{pt.t}</span>)}
          </div>
          {/* perforation */}
          <div style={{ alignSelf: "stretch", borderTop: `${4 * u}px dashed ${rgba(ink.startsWith("#") ? ink : "#000000", 0.2)}`, margin: `${14 * u * v}px 0` }} />
          <div style={{ fontFamily: fonts.body, fontWeight: 500, fontSize: 34 * u * v, opacity: 0.6 }}>use code</div>
          <div style={{ fontFamily: fonts.body, fontWeight: 800, fontSize: 84 * u * v, letterSpacing: "0.12em", padding: `${10 * u}px ${36 * u}px`, borderRadius: 20 * u, border: `${4 * u}px dashed ${theme.accent}`, color: theme.accent, transform: `scale(${0.85 + 0.15 * code})`, opacity: code }}>{s.code}</div>
          {s.note && <div style={{ fontFamily: fonts.body, fontWeight: 500, fontSize: 32 * u * v, opacity: 0.55, marginTop: 6 * u }}>{s.note}</div>}
          {[-1, 1].map((side) => (
            <div key={side} style={{ position: "absolute", top: "50%", [side < 0 ? "left" : "right"]: -34 * u, width: 68 * u, height: 68 * u, borderRadius: "50%", background: bgColor(theme, bg) }} />
          ))}
        </div>
      </div>
    </>
  );
};

// The single AI scene: video if it exists, else the reference image, else a brand-colored stand-in with the icon.
const AiSceneView: React.FC<ViewProps & { s: Extract<AdScene, { type: "scene" }> }> = ({ s, theme, fonts, slug, format }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { u, v } = useUnits();
  const video = s.video ? `${slug}/${s.video}` : "";
  const image = s.image ? `${slug}/${s.image}` : "";
  const has = (video && hasFile(video)) || (image && hasFile(image));
  const Icon = icon(s.icon);
  const z = interpolate(frame, [0, durationInFrames], [1, 1.12]);
  return (
    <AbsoluteFill>
      {has ? (
        <AiScene video={video} image={image || video} focus={s.focus ?? (format === "1:1" ? "50% 35%" : "50% 50%")} />
      ) : (
        <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 40%, ${theme.accent}, ${theme.background} 75%)`, alignItems: "center", justifyContent: "center" }}>
          <div style={{ transform: `scale(${z})`, opacity: 0.9 }}>
            <Icon size={420 * u * v} color={rgba(theme.light, 0.85)} />
          </div>
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.55) 100%)" }} />
      {s.text && (
        <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: (format === "9:16" ? 520 : 140) * u }}>
          <Headline text={s.text} font={fonts.display} color="#fff" em={theme.highlight} max={120 * v} weight={800} delay={4} />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

// End card: the logo file when it exists, else a wordmark (icon tile + `name` in the display font).
const EndScene: React.FC<ViewProps & { s: Extract<AdScene, { type: "end" }> }> = ({ s, theme, fonts, slug, i }) => {
  const { u, v } = useUnits();
  const logo = `${slug}/${s.logo ?? "logo.svg"}`;
  const hasLogo = hasFile(logo);
  const mark = useIn(0, 16);
  return (
    <AbsoluteFill>
      <EndCard
        theme={theme}
        logo={hasLogo ? staticFile(logo) : undefined}
        title={
          <>
            {!hasLogo && s.name && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22 * u, marginBottom: 70 * u * v, opacity: mark, transform: `translateY(${(1 - mark) * 30 * u}px)` }}>
                <div style={{ width: 96 * u * v, height: 96 * u * v, borderRadius: 28 * u * v, background: `linear-gradient(140deg, ${theme.highlight}, ${theme.accent})`, display: "grid", placeItems: "center" }}>
                  {(() => { const I = icon(s.icon); return <I size={56 * u * v} color={theme.light} />; })()}
                </div>
                <span style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 64 * u * v, letterSpacing: "-0.02em", color: theme.light }}>{s.name}</span>
              </div>
            )}
            <span style={{ fontFamily: fonts.display, fontSize: "1.3em", letterSpacing: "-0.03em" }}>{splitAccent(s.title).map((p, k) => <span key={k} style={{ color: p.em ? theme.highlight : undefined, fontStyle: p.em && isSerif(fonts) ? "italic" : undefined }}>{p.t}</span>)}</span>
          </>
        }
        subtitle={s.subtitle}
        cta={s.cta}
      />
      <Sparkles delay={10} color={theme.highlight} n={12} />
      <BurstFx kind={s.burst ?? "confetti"} theme={theme} delay={4} seed={"e" + i} origin={[0.5, 0.42]} />
    </AbsoluteFill>
  );
};
