import { AbsoluteFill, Audio, CalculateMetadataFunction, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import {
  RiAlertLine, RiBox3Line, RiCodeSSlashLine, RiEyeOffLine, RiFlashlightFill, RiGiftLine, RiMailLine, RiMessage2Line, RiMoneyDollarCircleLine,
  RiQuestionLine, RiShoppingCart2Line, RiStarFill, RiTeamLine, RiTimeLine, RiTruckLine, RiWhatsappFill,
} from "@remixicon/react";
import type { RemixiconComponentType } from "@remixicon/react";
import { fitText } from "@remotion/layout-utils";
import { Beat, Cross, Giant, Grain, IconTile, Small, useU } from "../motion/beats";
import { Phone } from "../components/Phone";
import { Captions, Word } from "../components/Captions";
import { Notification } from "../components/Notification";
import { EndCard } from "../components/EndCard";
import { Placeholder } from "../components/Placeholder";
import { FONT, FONT_MONO } from "../components/fonts";
import { Format, FPS, PLACEHOLDER_SECONDS, SIZE } from "../components/formats";
import { Theme, fetchJson, rgba, withTheme } from "../components/theme";
import { PHONE_SCREENS } from "../components/screens";
import { ShotsByPersona, findShot, loadShots } from "../library/PersonaShot";

// Narrated UGC template: 3rd-person scenes of the persona (library shots) + narration on top + app screens recreated
// in code. Each video is one public/<slug>/script.json (written by scripts/ugc_narrated.py) — no .tsx per video.
// Times in seconds of the narration (see the alignment from scripts/voice.py).
// Hard cuts between scenes (UGC); the app screen enters over the previous scene blurred, never over black.

type Scene =
  | { shot: string; from: number; to: number; start?: number; speed?: number; zoom?: [number, number] }
  | { screen: string; background: string; from: number; to: number; value?: number; props?: Record<string, unknown> }
  | { motion: Motion; from: number; to: number };
// motion beat (~1 s) between scenes: giant word or animated number, icon, cross — costs ~0 compared with an AI clip
type Motion = {
  text?: string; sub?: string; background?: "dark" | "accent" | "light"; icon?: string; cross?: boolean; shake?: boolean;
  number?: { from: number; to: number; prefix?: string; suffix?: string };
};
// overlay kind: with `items` = message stack, otherwise a notification (`type` is optional)
type Overlay =
  | { type?: "notification"; from: number; to: number; title: string; text: string }
  | { type?: "messages"; from: number; to: number; items: { name: string; text: string; at: number }[]; unread?: number };
const isMessages = (o: Overlay): o is Extract<Overlay, { items: unknown }> => "items" in o;
export type UgcScript = {
  persona: string; // default persona; a shot may come from another one as "persona:shot" (e.g. "customers:door-delivery")
  app?: { name: string }; // app name on notifications and screens
  store?: { name: string; email?: string }; // store shown inside the app screens (passed to them as `store`)
  theme?: Partial<Theme>;
  locale?: string; // number formatting (default "en-US")
  narration: string; // file in public/<slug>/
  alignment: string;
  music?: string; // id in library/music (no music when omitted)
  scenes: Scene[];
  overlays?: Overlay[];
  highlights?: string[];
  card: { from: number; title: string; highlight?: string; subtitle?: string; cta?: string }; // end card
  duration: number; // narration + end card (without the opening)
  // visual hook that plays ALONE before everything (library/hooks); `continuation` = the character in the SAME scene as
  // the hook saying the bridge line (AI clip with speech, in public/<slug>/), captioned from its transcript.
  // file null + duration 0 = no hook: opens straight on the continuation
  // continuation.captions = transcript JSON (ElevenLabs Scribe format) of the spoken clip
  opening?: { file: string | null; start: number; dur: number; continuation?: { file: string; dur: number; captions: string } };
};
type Props = { slug: string; format: Format; script?: UgcScript; words?: Word[]; openingWords?: Word[]; shots?: ShotsByPersona };

export const calculateUgcNarratedMetadata: CalculateMetadataFunction<Props> = async ({ props }) => {
  const [width, height] = SIZE[props.format];
  const empty = { durationInFrames: PLACEHOLDER_SECONDS * FPS, width, height, props };
  if (!props.slug) return empty;
  const script = await fetchJson<UgcScript>(staticFile(`${props.slug}/script.json`));
  if (!script) return empty;
  const al = await fetchJson<{ words: Word[] }>(staticFile(`${props.slug}/${script.alignment}`));
  const words = (al?.words ?? []).filter((w) => w.text.trim()).map((w) => ({ ...w, text: w.text.replace(/["“”]/g, "") }));
  const cont = script.opening?.continuation;
  const tr = cont ? await fetchJson<{ words: (Word & { type?: string })[] }>(staticFile(`${props.slug}/${cont.captions}`)) : null;
  const openingWords: Word[] = (tr?.words ?? []).filter((w) => w.type === "word");
  // personas referenced by the scenes ("persona:shot") + the default one
  const refs = script.scenes.flatMap((c) => ("shot" in c ? [c.shot] : "screen" in c ? [c.background] : []));
  const shots = await loadShots([script.persona, ...refs.filter((r) => r.includes(":")).map((r) => r.split(":")[0])]);
  const total = script.duration + (script.opening?.dur ?? 0) + (cont?.dur ?? 0);
  return { durationInFrames: Math.max(1, Math.round(total * FPS)), width, height, props: { ...props, script, words, openingWords, shots } };
};

const LAYOUT = {
  "9:16": { captionY: 1520, captionSize: 74, focus: "50% 40%", speechFocus: "50% 40%", phoneScale: 1.45, phoneTop: 150, notifTop: 90, stackTop: 110, stackScale: 1 },
  "4:5": { captionY: 1110, captionSize: 62, focus: "50% 35%", speechFocus: "50% 55%", phoneScale: 1.2, phoneTop: 70, notifTop: 50, stackTop: 60, stackScale: 0.9 },
  "1:1": { captionY: 990, captionSize: 54, focus: "50% 30%", speechFocus: "50% 70%", phoneScale: 1.05, phoneTop: 40, notifTop: 30, stackTop: 30, stackScale: 0.8 },
} as const;

const s = (sec: number) => Math.round(sec * FPS);
// The clean stretch of the shot (start–end in shots.json) has to cover the scene: if the scene is longer, slow the
// clip down (to 0.45× at most) instead of running into the part with AI artifacts.
const safeSpeed = (c: { from: number; to: number; start?: number; speed?: number }, p: { start: number; end: number }) => {
  const ini = Math.max(c.start ?? 0, p.start);
  const fits = (p.end - ini) / (c.to - c.from);
  return Math.max(0.45, Math.min(c.speed ?? 1, fits));
};
const span = (from: number, to: number) => ({ from: s(from), durationInFrames: Math.max(1, s(to) - s(from)) });

// Opening: the hook plays alone (with its own sound) and fades to black; the video fades in from black.
// The narration starts afterwards, with the bridge line that ties the hook to the pain (scripts/hooks.py).
const FADE = 0.3;
export const UgcNarrated: React.FC<Props> = (props) => {
  const { format, script } = props;
  if (!script || !props.words?.length) return <Placeholder title="UgcNarrated" hint={`No data: put script.json and the narration alignment in public/${props.slug || "<slug>"}/ (scripts/ugc_narrated.py).`} />;
  const theme = withTheme(script.theme);
  const op = script.opening;
  if (!op) return <Content {...props} />;
  const cont = op.continuation;
  const L = LAYOUT[format];
  const contentStart = op.dur + (cont?.dur ?? 0);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* with a continuation the hook hard-cuts to the same scene (it is the same place); without one, it fades out */}
      {op.file && op.dur > 0 && (
        <Sequence durationInFrames={s(op.dur)}>
          <Opening src={"library/hooks/" + op.file} start={op.start} focus={L.focus} fade={!cont} />
        </Sequence>
      )}
      {cont && (
        <Sequence from={s(op.dur)} durationInFrames={s(cont.dur)}>
          {/* speaking to camera is a tight selfie: in 1:1 the crop goes lower so it does not cut the mouth */}
          <Opening src={props.slug + "/" + cont.file} start={0} focus={L.speechFocus} fade />
          <Captions words={props.openingWords ?? []} highlights={script.highlights ?? []} highlightColor={theme.highlight} y={L.captionY} size={L.captionSize} variant="minimal" />
        </Sequence>
      )}
      <Sequence from={s(contentStart)}>
        <FadeIn>
          <Content {...props} />
        </FadeIn>
      </Sequence>
    </AbsoluteFill>
  );
};

const Opening: React.FC<{ src: string; start: number; focus: string; fade: boolean }> = ({ src, start, focus, fade }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const out = fade ? interpolate(frame, [durationInFrames - FADE * fps, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <OffthreadVideo src={staticFile(src)} startFrom={Math.round(start * fps)} volume={(f) => (fade ? interpolate(f, [durationInFrames - FADE * fps, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1)}
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: focus, filter: "saturate(0.92) contrast(1.04)" }} />
      <Grain strength={0.07} />
    </AbsoluteFill>
  );
};

const FadeIn: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <AbsoluteFill style={{ opacity: interpolate(frame, [0, FADE * fps], [0, 1], { extrapolateRight: "clamp" }) }}>{children}</AbsoluteFill>;
};

const Content: React.FC<Props> = ({ slug, format, script, words, shots = {} }) => {
  const { fps } = useVideoConfig();
  if (!script || !words?.length) return null;
  const theme = withTheme(script.theme);
  const locale = script.locale ?? "en-US";
  const L = LAYOUT[format];
  const P = slug + "/";
  const shot = (ref: string) => findShot(shots, script.persona, ref);
  const voiceEnd = words[words.length - 1].end;
  const musicVolume = (f: number) => {
    const t = f / fps;
    const base = interpolate(t, [voiceEnd - 0.2, voiceEnd + 0.3], [0.09, 0.34], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return base * interpolate(t, [script.duration - 0.8, script.duration], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  };
  const card = script.card;

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {script.scenes.map((c, i) => (
        <Sequence key={i} {...span(c.from, c.to)}>
          {"motion" in c ? (
            <MotionScene m={c.motion} theme={theme} locale={locale} />
          ) : "shot" in c ? (
            <ShotScene src={shot(c.shot).clip} start={Math.max(c.start ?? 0, shot(c.shot).start)} speed={safeSpeed(c, shot(c.shot))} zoom={c.zoom ?? [1.03, 1.1]} focus={L.focus} seed={i} />
          ) : (
            <ScreenScene screen={c.screen} props={c.props ?? {}} background={shot(c.background).clip} backgroundStart={shot(c.background).start} icon={staticFile(P + "favicon.svg")} appName={script.app?.name} store={script.store} theme={theme} value={c.value} scale={L.phoneScale} top={L.phoneTop} focus={L.focus} />
          )}
        </Sequence>
      ))}

      {(script.overlays ?? []).map((o, i) => (
        <Sequence key={"o" + i} {...span(o.from, o.to)}>
          {!isMessages(o) ? (
            <Notification icon={staticFile(P + "favicon.svg")} app={script.app?.name ?? "App"} title={o.title} text={o.text} duration={s(o.to - o.from)} top={L.notifTop} />
          ) : (
            <MessageStack items={o.items.map((m) => ({ ...m, at: m.at - o.from }))} unread={o.unread} top={L.stackTop} scale={L.stackScale} />
          )}
        </Sequence>
      ))}

      <Sequence {...span(card.from, script.duration)}>
        <EndCard
          theme={theme}
          logo={staticFile(P + "logo.svg")}
          title={
            <>
              {card.title} {card.highlight && <span style={{ color: theme.highlight }}>{card.highlight}</span>}
            </>
          }
          subtitle={card.subtitle}
          cta={card.cta}
        />
      </Sequence>

      <HideDuringMotion windows={script.scenes.filter((c) => "motion" in c).map((c) => [c.from, c.to] as [number, number])}>
        <Captions words={words} highlights={script.highlights ?? []} highlightColor={theme.highlight} y={L.captionY} size={L.captionSize} variant="minimal" until={card.from} />
      </HideDuringMotion>

      <Audio src={staticFile(P + script.narration)} />
      {script.music && <Audio src={staticFile(`library/music/${script.music}.mp3`)} volume={musicVolume} loop />}
      {script.scenes.map((c, i) => ("screen" in c ? <Sfx key={"w" + i} file="whoosh" at={c.from - 0.08} volume={0.4} /> : "motion" in c ? <Sfx key={"m" + i} file="pop" at={c.from} volume={0.45} /> : null))}
      {(script.overlays ?? []).flatMap((o, i) =>
        !isMessages(o) ? [<Sfx key={"n" + i} file="chime" at={o.from} volume={0.7} />] : o.items.map((m, j) => <Sfx key={`m${i}${j}`} file="ding" at={m.at} volume={0.35} />),
      )}
      <Sfx file="whoosh" at={card.from - 0.08} volume={0.35} />
    </AbsoluteFill>
  );
};

// hides the captions during the motion beats (the text is already giant on screen)
const HideDuringMotion: React.FC<{ windows: [number, number][]; children: React.ReactNode }> = ({ windows, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  return windows.some(([a, b]) => t >= a && t < b) ? null : <>{children}</>;
};

const Sfx: React.FC<{ file: string; at: number; volume: number }> = ({ file, at, volume }) => (
  <Sequence from={Math.max(0, s(at))} durationInFrames={s(1.5)}>
    <Audio src={staticFile("library/sfx/" + file + ".mp3")} volume={volume} />
  </Sequence>
);

const MOTION_ICONS: Record<string, RemixiconComponentType> = {
  clock: RiTimeLine, sms: RiMessage2Line, star: RiStarFill, box: RiBox3Line, team: RiTeamLine, money: RiMoneyDollarCircleLine,
  cart: RiShoppingCart2Line, question: RiQuestionLine, "eye-off": RiEyeOffLine, code: RiCodeSSlashLine, email: RiMailLine, gift: RiGiftLine,
  alert: RiAlertLine, whatsapp: RiWhatsappFill, bolt: RiFlashlightFill, truck: RiTruckLine,
};
const backgrounds = (t: Theme) => ({
  dark: { bg: t.background, txt: "#fff", accent: t.highlight, light: rgba(t.accent, 0.22) },
  accent: { bg: t.accent, txt: "#fff", accent: "#0a0a0a", light: "rgba(255,255,255,0.18)" },
  light: { bg: "#f4f3ef", txt: "#111", accent: t.accent, light: rgba(t.accent, 0.12) },
});

// Motion beat: brand background, icon in a tile, giant word (or a number counting up) and a small line.
const MotionScene: React.FC<{ m: Motion; theme: Theme; locale: string }> = ({ m, theme, locale }) => {
  const frame = useCurrentFrame();
  const u = useU();
  const b = backgrounds(theme)[m.background ?? "dark"];
  const Icon = m.icon ? MOTION_ICONS[m.icon] : undefined;
  const n = m.number;
  const v = n ? Math.round(interpolate(frame, [2, 16], [n.from, n.to], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })) : 0;
  const { width } = useVideoConfig();
  // the number always fits the width (measures the final text, the widest)
  const final = n ? `${n.prefix ?? ""}${n.to.toLocaleString(locale)}${n.suffix ?? ""}` : "";
  const numberSize = n ? Math.min(260 * u, fitText({ text: final, withinWidth: (width * 0.8) / 1.28, fontFamily: FONT, fontWeight: "900", letterSpacing: "-0.05em" }).fontSize) : 0;
  // brand color only: no grid and no moving light
  return (
    <Beat color={b.bg} entrance="cut" impact grid={false} light="transparent">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 * u, position: "relative" }}>
        {Icon && <IconTile Icon={Icon} size={150} background={b.accent} color={m.background === "accent" ? "#fff" : b.bg} delay={1} />}
        <div style={{ position: "relative" }}>
          {n ? (
            <div style={{ fontFamily: FONT, fontSize: numberSize, fontWeight: 900, color: b.accent, letterSpacing: "-0.05em", fontVariantNumeric: "tabular-nums", lineHeight: 1, whiteSpace: "nowrap" }}>
              {n.prefix ?? ""}{v.toLocaleString(locale)}{n.suffix ?? ""}
            </div>
          ) : (
            m.text && <Giant text={m.text} size={190} color={b.txt} delay={2} shake={m.shake} />
          )}
          {m.cross && <Cross size={520} delay={9} />}
        </div>
        {n && m.text && <Small text={m.text} color={b.txt} size={64} delay={4} weight={800} />}
        {m.sub && <Small text={m.sub} color={b.txt} size={50} delay={6} />}
      </div>
    </Beat>
  );
};

// Persona scene: slow push-in + light handheld drift (the one filming is "a friend").
const ShotScene: React.FC<{ src: string; start: number; speed: number; zoom: [number, number]; focus: string; seed: number }> = ({ src, start, speed, zoom, focus, seed }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const z = interpolate(frame, [0, durationInFrames], zoom);
  const x = Math.sin(t * 1.2 + seed) * 5 + Math.sin(t * 2.9 + seed * 2) * 2;
  const y = Math.cos(t * 1.0 + seed * 1.7) * 4;
  const r = Math.sin(t * 0.8 + seed * 3) * 0.3;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <OffthreadVideo
        src={staticFile(src)}
        startFrom={Math.round(start * fps)}
        playbackRate={speed}
        muted
        // "phone camera" finish: removes the perfect AI shine (less saturation, phone-like contrast and sharpness)
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: focus, transformOrigin: focus, transform: `translate(${x}px, ${y}px) rotate(${r}deg) scale(${z})`, filter: "saturate(0.88) contrast(1.06) brightness(0.98)" }}
      />
      {/* light phone-lens vignette + sensor grain */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 85% 75% at 50% 45%, transparent 60%, rgba(0,0,0,0.28) 100%)", pointerEvents: "none" }} />
      <Grain strength={0.09} />
    </AbsoluteFill>
  );
};

// App screen in a phone rising over the blurred scene (it stays in the scene's world).
const ScreenScene: React.FC<{ screen: string; props: Record<string, unknown>; background: string; backgroundStart: number; icon: string; appName?: string; store?: { name: string; email?: string }; theme: Theme; value?: number; scale: number; top: number; focus: string }> = ({ screen, props: d, background, backgroundStart, icon, appName, store, theme, value, scale, top, focus }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 15, stiffness: 140 } });
  const Screen = PHONE_SCREENS[screen];
  return (
    <AbsoluteFill>
      <OffthreadVideo src={staticFile(background)} startFrom={Math.round(backgroundStart * fps)} muted style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: focus, filter: "blur(26px) brightness(0.55)", transform: "scale(1.15)" }} />
      <div style={{ position: "absolute", left: "50%", top, transform: `translateX(-50%) translateY(${interpolate(enter, [0, 1], [700, 0])}px) rotate(${interpolate(enter, [0, 1], [5, 0])}deg)`, transformOrigin: "50% 40%", filter: "drop-shadow(0 40px 60px rgba(0,0,0,0.5))" }}>
        <Phone scale={scale}>
          {Screen ? (
            <Screen theme={theme} icon={icon} appName={appName} store={store} duration={durationInFrames / fps} value={value} {...d} />
          ) : (
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#fff", fontFamily: FONT, fontSize: 18, padding: 30, textAlign: "center" }}>screen "{screen}" is not registered in components/screens</div>
          )}
        </Phone>
      </div>
    </AbsoluteFill>
  );
};

// WhatsApp messages stacking at the top (the daily "where is my order?") + unread counter.
const MessageStack: React.FC<{ items: { name: string; text: string; at: number }[]; unread?: number; top: number; scale: number }> = ({ items, unread, top, scale }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const visible = items.filter((m) => t >= m.at);
  const last = items.length ? items[items.length - 1].at + 0.5 : 0;
  const pCounter = spring({ frame: frame - s(last), fps, config: { damping: 10, stiffness: 200 } });
  const n = Math.round(interpolate(t, [last, last + 0.8], [items.length, unread ?? items.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.45), rgba(0,0,0,0) 55%)" }} />
      <div style={{ position: "absolute", top, left: 40, right: 40, transform: `scale(${scale})`, transformOrigin: "50% 0", fontFamily: FONT }}>
        {visible
          .slice()
          .reverse()
          .map((m, i) => {
            const p = spring({ frame: frame - s(m.at), fps, config: { damping: 15, stiffness: 190 } });
            return (
              <div key={m.name + m.at} style={{ marginBottom: 16, opacity: p * (1 - i * 0.12), transform: `translateY(${interpolate(p, [0, 1], [-120, 0])}px) scale(${1 - i * 0.03})`, display: "flex", alignItems: "center", gap: 22, padding: "22px 28px", borderRadius: 36, background: "rgba(245,245,247,0.86)", boxShadow: "0 16px 40px rgba(0,0,0,0.3)", color: "#111" }}>
                <div style={{ width: 70, height: 70, borderRadius: 18, background: "#25d366", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <RiWhatsappFill size={44} color="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 34, fontWeight: 700 }}>{m.name}</div>
                  <div style={{ fontSize: 32, color: "#333", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.text}</div>
                </div>
              </div>
            );
          })}
      </div>
      {unread && t >= last && (
        <div style={{ position: "absolute", top: top + items.length * 140 * scale + 40, left: "50%", transform: `translateX(-50%) scale(${pCounter * scale})`, padding: "14px 34px", borderRadius: 999, background: "#ff3b30", color: "#fff", fontFamily: FONT_MONO, fontWeight: 700, fontSize: 44, boxShadow: "0 10px 30px rgba(255,59,48,0.45)", whiteSpace: "nowrap" }}>
          {n} unread
        </div>
      )}
    </AbsoluteFill>
  );
};
