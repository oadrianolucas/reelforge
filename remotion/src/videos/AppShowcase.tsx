// AppShowcase: music-only app launch from data (public/<slug>/showcase.json). Gradient logo opening, app screens
// (images or registered PHONE_SCREENS) on a phone in 3D perspective with slow zoom and glare, a pulsing button being
// tapped, the phone in the center with objects orbiting, logo + CTA. Hard cuts every ~1.4 s, always on a beat.
import { AbsoluteFill, Audio, CalculateMetadataFunction, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Format, FPS, PLACEHOLDER_SECONDS, SIZE } from "../components/formats";
import { fetchJson, rgba } from "../components/theme";
import { Placeholder } from "../components/Placeholder";
import { Phone, SCREEN } from "../components/Phone";
import { PHONE_SCREENS } from "../components/screens";
import { Shockwave } from "../motion/beats";
import { AdTheme, EXPO, Headline, Music, Rhythm, Slot, Timed, beatPulse, hasFile, icon, layoutScenes, loadRhythm, mediaPath, useBrandFonts, useIn, useUnits, withAdTheme } from "./kit";

type ScreenRef = { screen?: string; image?: string; props?: Record<string, unknown> };
export type Shot = Timed &
  (
    | { type: "logo" }
    | ({ type: "screen"; title?: string; tilt?: "left" | "right" | "none"; focus?: "top" | "center" | "bottom" } & ScreenRef)
    | { type: "title"; text: string }
    | { type: "button"; text: string; title?: string }
    | ({ type: "orbit"; title?: string; icons?: string[] } & ScreenRef)
    | { type: "end"; title?: string; subtitle?: string; cta?: string }
  );
export type ShowcaseData = {
  theme?: Partial<AdTheme>;
  app: { name: string; tagline?: string; logo?: string; icon?: string }; // logo file in public/<slug>/ (icon tile fallback)
  music?: Music;
  bpm?: number; // grid without music (default 128)
  shotSeconds?: number; // target length of a shot, rounded to whole beats (default 1.4)
  shots: Shot[];
};
type Props = { slug: string; format: Format; data?: ShowcaseData; rhythm?: Rhythm; slots?: Slot[] };

export const calculateAppShowcaseMetadata: CalculateMetadataFunction<Props> = async ({ props }) => {
  const [width, height] = SIZE[props.format];
  const data = props.slug ? await fetchJson<ShowcaseData>(staticFile(`${props.slug}/showcase.json`)) : null;
  if (!data?.shots?.length) return { durationInFrames: PLACEHOLDER_SECONDS * FPS, width, height, props };
  const rhythm = await loadRhythm(props.slug, data.music, data.bpm ?? 128);
  const per = Math.max(1, Math.round((data.shotSeconds ?? 1.4) / rhythm.interval));
  // opening and closing shots get twice the time; the first cut lands on the first beat of the track
  const shots = data.shots.map((s) => (s.beats === undefined && s.seconds === undefined && (s.type === "logo" || s.type === "end") ? { ...s, beats: per * 2 } : s));
  const slots = layoutScenes(shots, rhythm, per, null);
  return { durationInFrames: Math.ceil((slots[slots.length - 1].from + slots[slots.length - 1].dur) * FPS), width, height, props: { ...props, data, rhythm, slots } };
};

type Fonts = ReturnType<typeof useBrandFonts>;
type Ctx = { theme: AdTheme; fonts: Fonts; slug: string; data: ShowcaseData; rhythm: Rhythm; pulse: number; i: number };

export const AppShowcase: React.FC<Props> = ({ slug, data, rhythm, slots }) => {
  const theme = withAdTheme(data?.theme);
  const fonts = useBrandFonts(theme);
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  if (!data?.shots?.length || !rhythm || !slots) return <Placeholder title="AppShowcase" hint={`No data: put showcase.json in public/${slug || "<slug>"}/ (see examples/).`} />;
  const t = frame / fps;
  const pulse = beatPulse(t, rhythm, 7);
  const f = (s: number) => Math.round(s * fps);
  const musicFile = data.music?.file ? mediaPath(slug, data.music.file) : null;
  const vol = (fr: number) => 0.85 * interpolate(fr, [durationInFrames - fps, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: theme.background, fontFamily: fonts.body, overflow: "hidden" }}>
      <Backdrop theme={theme} pulse={pulse} />
      {data.shots.map((s, i) => (
        <Sequence key={i} from={f(slots[i].from)} durationInFrames={Math.max(1, f(slots[i].from + slots[i].dur) - f(slots[i].from))}>
          <Cut>
            <ShotView s={s} ctx={{ theme, fonts, slug, data, rhythm, pulse, i }} />
          </Cut>
        </Sequence>
      ))}
      {musicFile && hasFile(musicFile) && <Audio src={staticFile(musicFile)} startFrom={f(data.music?.start ?? 0)} volume={vol} />}
    </AbsoluteFill>
  );
};

// Soft brand-colored light moving behind everything (continuous across cuts, so the cuts feel like one camera).
const Backdrop: React.FC<{ theme: AdTheme; pulse: number }> = ({ theme, pulse }) => {
  const frame = useCurrentFrame();
  const a = frame / 40;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: `radial-gradient(circle at ${50 + Math.sin(a) * 22}% ${30 + Math.cos(a * 0.8) * 12}%, ${rgba(theme.accent, 0.55 + 0.1 * pulse)}, transparent 48%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(circle at ${50 - Math.sin(a * 0.7) * 26}% ${78 + Math.sin(a * 0.9) * 10}%, ${rgba(theme.highlight, 0.32)}, transparent 45%)` }} />
    </AbsoluteFill>
  );
};

// Hard cut with a short zoom settle (1.06 → 1): reads as a punch on the beat, no blur.
const Cut: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const p = useIn(0, 10);
  return <AbsoluteFill style={{ transform: `scale(${1.06 - 0.06 * p})` }}>{children}</AbsoluteFill>;
};

const ShotView: React.FC<{ s: Shot; ctx: Ctx }> = ({ s, ctx }) => {
  switch (s.type) {
    case "logo":
      return <LogoShot ctx={ctx} />;
    case "screen":
      return <ScreenShot s={s} ctx={ctx} />;
    case "title":
      return <TitleShot text={s.text} ctx={ctx} />;
    case "button":
      return <ButtonShot s={s} ctx={ctx} />;
    case "orbit":
      return <OrbitShot s={s} ctx={ctx} />;
    case "end":
      return <EndShot s={s} ctx={ctx} />;
  }
};

const serif = (f: Fonts) => /fraunces|serif|playfair/i.test(f.displayName);

const AppIcon: React.FC<{ ctx: Ctx; size: number; shine?: boolean }> = ({ ctx, size, shine }) => {
  const frame = useCurrentFrame();
  const { theme, data, slug } = ctx;
  const logo = data.app.logo ? `${slug}/${data.app.logo}` : "";
  const I = icon(data.app.icon ?? "sparkle");
  const x = interpolate(frame % 60, [8, 34], [-60, 160], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "relative", width: size, height: size, borderRadius: size * 0.27, overflow: "hidden", background: `linear-gradient(145deg, ${theme.highlight}, ${theme.accent} 60%, ${rgba(theme.accent, 0.85)})`, display: "grid", placeItems: "center", boxShadow: `0 ${size * 0.12}px ${size * 0.3}px ${rgba(theme.accent, 0.45)}, inset 0 ${size * 0.01}px 0 rgba(255,255,255,0.4)` }}>
      {logo && hasFile(logo) ? <Img src={staticFile(logo)} style={{ width: "62%", height: "62%", objectFit: "contain" }} /> : <I size={size * 0.56} color={theme.light} />}
      {shine && <div style={{ position: "absolute", inset: 0, background: `linear-gradient(115deg, transparent ${x - 18}%, rgba(255,255,255,0.45) ${x}%, transparent ${x + 18}%)` }} />}
    </div>
  );
};

const LogoShot: React.FC<{ ctx: Ctx }> = ({ ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, v } = useUnits();
  const { theme, fonts, data } = ctx;
  const p = spring({ frame, fps, config: { damping: 13, stiffness: 120 } });
  const name = useIn(10, 18);
  const tag = useIn(18, 18);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 46 * u * v }}>
      <div style={{ transform: `scale(${0.5 + 0.5 * p}) rotate(${(1 - p) * -18}deg)`, opacity: Math.min(1, p * 2) }}>
        <AppIcon ctx={ctx} size={260 * u * v} shine />
      </div>
      <div style={{ overflow: "hidden", paddingBottom: 12 * u }}>
        <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 150 * u * v, letterSpacing: "-0.04em", lineHeight: 1, color: theme.light, transform: `translateY(${(1 - name) * 110}%)` }}>{data.app.name}</div>
      </div>
      {data.app.tagline && <div style={{ fontFamily: fonts.body, fontWeight: 500, fontSize: 44 * u * v, color: rgba(theme.light, 0.72), opacity: tag, transform: `translateY(${(1 - tag) * 20 * u}px)` }}>{data.app.tagline}</div>}
    </AbsoluteFill>
  );
};

// The screen content inside the phone: a registered PHONE_SCREENS component, an image, or a neutral skeleton.
const ScreenContent: React.FC<{ r: ScreenRef; ctx: Ctx }> = ({ r, ctx }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const { theme, slug, data } = ctx;
  const Comp = r.screen ? PHONE_SCREENS[r.screen] : undefined;
  if (Comp) return <Comp theme={theme} appName={data.app.name} duration={durationInFrames / fps} {...(r.props ?? {})} />;
  const img = r.image ? `${slug}/${r.image}` : "";
  if (img && hasFile(img)) return <Img src={staticFile(img)} style={{ position: "absolute", inset: 0, width: SCREEN.w, height: SCREEN.h, objectFit: "cover" }} />;
  return <Skeleton theme={theme} />;
};

const Skeleton: React.FC<{ theme: AdTheme }> = ({ theme }) => {
  const bar = (w: string, h: number, c = theme.surface) => <div style={{ width: w, height: h, borderRadius: h / 2.4, background: c }} />;
  return (
    <div style={{ position: "absolute", inset: 0, background: theme.background, padding: "70px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
      {bar("40%", 14)}
      {bar("70%", 30, rgba(theme.light, 0.9))}
      <div style={{ height: 170, borderRadius: 22, background: `linear-gradient(140deg, ${theme.accent}, ${theme.highlight})`, marginTop: 8 }} />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: theme.surface }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            {bar("60%", 12, rgba(theme.light, 0.5))}
            {bar("40%", 10)}
          </div>
        </div>
      ))}
    </div>
  );
};

/** Phone height as a share of the frame, and where text goes, per format. */
const usePhoneLayout = () => {
  const { tall, square, height, width } = useUnits();
  const phoneH = (square ? 0.8 : tall ? 0.66 : 0.68) * height;
  const scale = phoneH / (SCREEN.h + 28);
  return { scale, square, tall, height, width, phoneW: (SCREEN.w + 28) * scale, phoneH };
};

// Phone in 3D: rotates toward the camera while zooming in slowly; a glare band sweeps the glass.
const Phone3D: React.FC<{ r: ScreenRef; ctx: Ctx; tilt: number; zoom?: [number, number]; scale: number; focusY?: number }> = ({ r, ctx, tilt, zoom = [1, 1.07], scale, focusY = 0 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const p = interpolate(frame, [0, durationInFrames], [0, 1]);
  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 110 } });
  const ry = tilt * interpolate(p, [0, 1], [28, 14]) + (1 - enter) * tilt * 20;
  const rx = tilt === 0 ? 0 : interpolate(p, [0, 1], [10, 6]);
  const z = interpolate(p, [0, 1], zoom);
  const glare = interpolate(frame, [4, 30], [-40, 140], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EXPO });
  return (
    <div style={{ perspective: 2400 * scale }}>
      <div style={{ transform: `translateY(${(1 - enter) * 120 * scale + focusY * (z - 1) * 900 * scale}px) rotateY(${ry}deg) rotateX(${rx}deg) rotateZ(${-tilt * 2}deg) scale(${z})`, transformStyle: "preserve-3d" }}>
        <Phone scale={scale} screenBackground={ctx.theme.background}>
          <ScreenContent r={r} ctx={ctx} />
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: `linear-gradient(${tilt >= 0 ? 115 : 65}deg, transparent ${glare - 22}%, rgba(255,255,255,0.18) ${glare - 4}%, rgba(255,255,255,0.05) ${glare + 10}%, transparent ${glare + 24}%)` }} />
        </Phone>
      </div>
    </div>
  );
};

/** Title + phone: stacked in 9:16 and 4:5, side by side in 1:1. */
const WithTitle: React.FC<{ title?: string; ctx: Ctx; children: React.ReactNode }> = ({ title, ctx, children }) => {
  const { u, v } = useUnits();
  const { square, width, height } = usePhoneLayout();
  const { theme, fonts } = ctx;
  if (!title) return <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>{children}</AbsoluteFill>;
  if (square)
    return (
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 40 * u, padding: `0 ${60 * u}px` }}>
        <div style={{ width: width * 0.4 }}>
          <Headline text={twoLines(title)} font={fonts.display} color={theme.light} em={theme.highlight} max={96} margin={0.4} weight={800} delay={2} align="left" italicEm={serif(fonts)} lineHeight={1.04} />
        </div>
        {children}
      </AbsoluteFill>
    );
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: height * 0.02 }}>
      <Headline text={title} font={fonts.display} color={theme.light} em={theme.highlight} max={118 * v} weight={800} delay={2} italicEm={serif(fonts)} lineHeight={1.04} />
      <div style={{ marginTop: 40 * u * v }}>{children}</div>
    </AbsoluteFill>
  );
};

/** Splits a one-line title in two at the word boundary closest to the middle (side layout of the 1:1). */
const twoLines = (t: string) => {
  if (t.includes("\n")) return t;
  const w = t.split(" ");
  if (w.length < 2) return t;
  let best = 1;
  for (let k = 1; k < w.length; k++) if (Math.abs(w.slice(0, k).join(" ").length - t.length / 2) < Math.abs(w.slice(0, best).join(" ").length - t.length / 2)) best = k;
  // keep *emphasis* markers balanced on each line
  const a = w.slice(0, best).join(" "), b = w.slice(best).join(" ");
  const odd = (x: string) => (x.match(/\*/g)?.length ?? 0) % 2 === 1;
  return odd(a) ? `${a}*\n*${b}` : `${a}\n${b}`;
};

const ScreenShot: React.FC<{ s: Extract<Shot, { type: "screen" }>; ctx: Ctx }> = ({ s, ctx }) => {
  const { scale, square } = usePhoneLayout();
  const tilt = s.tilt === "none" ? 0 : s.tilt === "right" ? 1 : s.tilt === "left" ? -1 : ctx.i % 2 ? 1 : -1;
  const focusY = s.focus === "top" ? 1 : s.focus === "bottom" ? -1 : 0;
  return (
    <WithTitle title={s.title} ctx={ctx}>
      <Phone3D r={s} ctx={ctx} tilt={tilt} scale={scale * (s.title ? (square ? 0.94 : 0.9) : 1.05)} focusY={focusY} zoom={[1, 1.1]} />
    </WithTitle>
  );
};

const TitleShot: React.FC<{ text: string; ctx: Ctx }> = ({ text, ctx }) => {
  const { v } = useUnits();
  const { theme, fonts } = ctx;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <Headline text={text} font={fonts.display} color={theme.light} em={theme.highlight} max={190 * v} weight={800} italicEm={serif(fonts)} />
    </AbsoluteFill>
  );
};

// The main action: a button pulsing on every beat, a cursor comes in and taps it (shockwave + press).
const ButtonShot: React.FC<{ s: Extract<Shot, { type: "button" }>; ctx: Ctx }> = ({ s, ctx }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { u, v } = useUnits();
  const { theme, fonts, pulse } = ctx;
  const tapAt = Math.round(durationInFrames * 0.55);
  const cursor = interpolate(frame, [4, tapAt - 2], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EXPO });
  const press = interpolate(frame, [tapAt - 2, tapAt, tapAt + 6], [1, 0.92, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const enter = useIn(0, 14);
  const Cursor = icon("RiCursorFill");
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 70 * u * v }}>
      {s.title && <Headline text={s.title} font={fonts.display} color={theme.light} em={theme.highlight} max={120 * v} weight={800} italicEm={serif(fonts)} />}
      <div style={{ position: "relative", opacity: enter, transform: `scale(${(0.8 + 0.2 * enter) * press * (1 + 0.045 * pulse)})` }}>
        <div style={{ position: "absolute", inset: -22 * u * pulse, borderRadius: 999, background: rgba(theme.accent, 0.35 * pulse) }} />
        <div style={{ position: "relative", padding: `${40 * u * v}px ${96 * u * v}px`, borderRadius: 999, background: `linear-gradient(140deg, ${theme.highlight}, ${theme.accent})`, color: "#fff", fontFamily: fonts.body, fontWeight: 800, fontSize: 70 * u * v, letterSpacing: "-0.02em", whiteSpace: "nowrap", boxShadow: `0 ${24 * u}px ${60 * u}px ${rgba(theme.accent, 0.5)}, inset 0 ${2 * u}px 0 rgba(255,255,255,0.35)` }}>{s.text}</div>
        <div style={{ position: "absolute", left: "62%", top: "58%", transform: `translate(${cursor * 380 * u}px, ${cursor * 300 * u}px) scale(${frame >= tapAt && frame < tapAt + 6 ? 0.85 : 1})`, filter: `drop-shadow(0 ${6 * u}px ${10 * u}px rgba(0,0,0,0.4))` }}>
          <Cursor size={110 * u * v} color="#fff" />
        </div>
      </div>
      <Shockwave delay={tapAt} color={theme.highlight} thickness={20} />
    </AbsoluteFill>
  );
};

// Phone facing the camera with icons orbiting in depth (behind the phone on the far side of the orbit).
const OrbitShot: React.FC<{ s: Extract<Shot, { type: "orbit" }>; ctx: Ctx }> = ({ s, ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u } = useUnits();
  const { scale, phoneW, phoneH, square } = usePhoneLayout();
  const { theme } = ctx;
  const names = s.icons?.length ? s.icons : ["star", "heart", "bolt", "gift", "check", "sparkle"];
  const t = frame / fps;
  const R = phoneW * (square ? 1.1 : 1.05);
  const items = names.map((n, k) => {
    const a = (k / names.length) * Math.PI * 2 + t * 1.1;
    const fly = spring({ frame: frame - k * 2, fps, config: { damping: 16, stiffness: 90 } });
    const r = R * (2.2 - 1.2 * fly);
    const depth = Math.sin(a);
    const y = Math.cos(a * 1) * 0.0 + ((k % 3) - 1) * phoneH * 0.28 + Math.sin(t * 2 + k) * 14 * u;
    return { n, x: Math.cos(a) * r, y, depth, k, fly };
  });
  const tile = (it: (typeof items)[number]) => {
    const I = icon(it.n);
    const sz = 150 * u * (0.78 + 0.3 * (it.depth + 1) / 2);
    const colors = [theme.accent, theme.highlight, theme.light];
    const bg = colors[it.k % 3];
    return (
      <div key={it.k} style={{ position: "absolute", left: "50%", top: "50%", width: sz, height: sz, marginLeft: -sz / 2, marginTop: -sz / 2, borderRadius: sz * 0.3, background: bg, display: "grid", placeItems: "center", transform: `translate(${it.x}px, ${it.y}px) rotate(${Math.sin(t * 1.5 + it.k) * 12}deg)`, opacity: Math.min(1, it.fly * 1.5) * (0.55 + 0.45 * (it.depth + 1) / 2), boxShadow: `0 ${14 * u}px ${34 * u}px rgba(0,0,0,0.35)` }}>
        <I size={sz * 0.52} color={bg === theme.light ? theme.accent : theme.light} />
      </div>
    );
  };
  return (
    <WithTitle title={s.title} ctx={ctx}>
      <div style={{ position: "relative" }}>
        <AbsoluteFill style={{ overflow: "visible" }}>{items.filter((it) => it.depth < 0).map(tile)}</AbsoluteFill>
        <Phone3D r={s} ctx={ctx} tilt={0} scale={scale * (s.title ? 0.84 : 0.95)} zoom={[1, 1.04]} />
        <AbsoluteFill style={{ overflow: "visible" }}>{items.filter((it) => it.depth >= 0).map(tile)}</AbsoluteFill>
      </div>
    </WithTitle>
  );
};

const EndShot: React.FC<{ s: Extract<Shot, { type: "end" }>; ctx: Ctx }> = ({ s, ctx }) => {
  const { u, v } = useUnits();
  const { theme, fonts, data, pulse } = ctx;
  const p = useIn(0, 16);
  const sub = useIn(12, 16);
  const cta = useIn(18, 16);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 40 * u * v }}>
      <div style={{ display: "flex", alignItems: "center", gap: 28 * u, opacity: p, transform: `translateY(${(1 - p) * 30 * u}px)` }}>
        <AppIcon ctx={ctx} size={120 * u * v} />
        <span style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 92 * u * v, letterSpacing: "-0.035em", color: theme.light }}>{data.app.name}</span>
      </div>
      {s.title && <Headline text={s.title} font={fonts.display} color={theme.light} em={theme.highlight} max={150 * v} weight={800} delay={6} italicEm={serif(fonts)} />}
      {s.subtitle && <div style={{ fontFamily: fonts.body, fontWeight: 500, fontSize: 42 * u * v, color: rgba(theme.light, 0.7), opacity: sub }}>{s.subtitle}</div>}
      {s.cta && (
        <div style={{ marginTop: 10 * u, padding: `${28 * u * v}px ${70 * u * v}px`, borderRadius: 999, background: theme.light, color: theme.ink, fontFamily: fonts.body, fontWeight: 800, fontSize: 50 * u * v, opacity: cta, transform: `scale(${(0.85 + 0.15 * cta) * (1 + 0.035 * pulse)})`, boxShadow: `0 ${20 * u}px ${50 * u}px rgba(0,0,0,0.35)`, whiteSpace: "nowrap" }}>{s.cta}</div>
      )}
    </AbsoluteFill>
  );
};
