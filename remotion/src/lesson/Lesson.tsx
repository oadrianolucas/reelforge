import { useMemo } from "react";
import { AbsoluteFill, Audio, CalculateMetadataFunction, Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import {
  RiAlarmWarningLine, RiArrowRightLine, RiCalendarScheduleLine, RiChat3Line, RiCheckboxCircleLine, RiCustomerService2Line,
  RiDraftLine, RiEmotionHappyLine, RiFileList3Line, RiFilter3Line, RiFlashlightLine, RiFlowChart, RiImageEditLine,
  RiLightbulbFlashLine, RiLineChartLine, RiLinkM, RiLiveLine, RiMedicineBottleLine, RiMicLine, RiNotification3Line,
  RiPlugLine, RiQuestionAnswerLine, RiQuillPenLine, RiSparkling2Line, RiToothLine, RiUserReceived2Line, RiUserSmileLine,
  RiWhatsappLine, RiTimeLine, RiErrorWarningLine,
} from "@remixicon/react";
import type { RemixiconComponentType } from "@remixicon/react";
import { Scene, Glow, MANROPE, INTER, SERIF, DEFAULT_THEME, Theme, ThemeCtx, progress, rgba, useTheme } from "../elegant/base";
import { fetchJson } from "../components/theme";
import { Placeholder } from "../components/Placeholder";

// Narrated 16:9 lesson in the elegant style (team training / narrated presentation).
// Reads public/<slug>/timeline.json written by scripts/lesson.py: scenes with ABSOLUTE times in seconds
// ("from"/"to" of the scene, "marks" = second each element enters), words for the captions and one mp3 per chapter.

const FPS = 30;
const ICONS: Record<string, RemixiconComponentType> = {
  RiAlarmWarningLine, RiCalendarScheduleLine, RiChat3Line, RiDraftLine, RiEmotionHappyLine, RiFileList3Line, RiFilter3Line,
  RiFlashlightLine, RiFlowChart, RiImageEditLine, RiLightbulbFlashLine, RiLineChartLine, RiLinkM, RiLiveLine,
  RiMedicineBottleLine, RiMicLine, RiNotification3Line, RiPlugLine, RiQuestionAnswerLine, RiQuillPenLine, RiSparkling2Line,
  RiToothLine, RiUserReceived2Line, RiUserSmileLine, RiWhatsappLine, RiTimeLine,
};

type Word = { text: string; start: number; end: number };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SceneT = Record<string, any> & { type: string; from: number; to: number; start: number; speechEnd?: number; marks: Record<string, number>; chapter?: string };
export type Timeline = {
  duration: number;
  audios: { file: string; at: number; from?: number; to?: number }[]; // chapter mp3s: start at `at`, optionally trimmed to [from, to]
  music?: { file: string; volume?: number; duration?: number } | null;
  words: Word[];
  scenes: SceneT[];
  title?: string;
  theme?: Partial<Theme>;
  chapters?: Record<string, string>; // chapter id → footer text (e.g. "II · The platform"); missing = no footer text
};
type Props = { slug: string; timeline?: Timeline };

export const calculateLessonMetadata: CalculateMetadataFunction<Props> = async ({ props }) => {
  const tl = props.slug ? await fetchJson<Timeline>(staticFile(`${props.slug}/timeline.json`)) : null;
  if (!tl) return { durationInFrames: 5 * FPS, width: 1920, height: 1080, fps: FPS, props };
  return { durationInFrames: Math.max(1, Math.round(tl.duration * FPS)), width: 1920, height: 1080, fps: FPS, props: { ...props, timeline: tl } };
};

export const Lesson: React.FC<Props> = ({ slug, timeline: tl }) => {
  if (!tl) return <Placeholder title="Lesson" hint={`No data: run scripts/lesson.py so public/${slug || "<slug>"}/ has timeline.json, the chapter mp3s and the photos.`} />;
  const T: Theme = { ...DEFAULT_THEME, ...tl.theme, slug };
  const file = (n: string) => staticFile(`${slug}/${n}`);
  return (
    <ThemeCtx.Provider value={T}>
      <AbsoluteFill style={{ background: T.background }}>
        <Glow />
        {tl.scenes.map((c, k) => {
          const from = Math.round(c.from * FPS);
          const dur = Math.max(1, Math.round(c.to * FPS) - from + (k + 1 < tl.scenes.length ? 10 : 0));
          const q = (t: number | undefined) => (t === undefined ? 0 : Math.round((t - c.from) * FPS));
          return (
            <Sequence key={k} from={from} durationInFrames={dur}>
              <Scene exit={k + 1 < tl.scenes.length}>
                <Content c={c} q={q} file={file} part={(c.chapter && tl.chapters?.[c.chapter]) || ""} />
              </Scene>
            </Sequence>
          );
        })}
        <Captions words={tl.words} hide={tl.scenes.filter((c) => ["quote", "chapter", "signoff"].includes(c.type)).map((c) => [c.start - 0.3, c.to + 0.3] as [number, number])} />
        {tl.audios.map((a, i) => (
          <Sequence key={i} from={Math.round(a.at * FPS)}><Audio src={file(a.file)} startFrom={a.from ? Math.round(a.from * FPS) : undefined} endAt={a.to ? Math.round(a.to * FPS) : undefined} /></Sequence>
        ))}
        {tl.music && <Music src={file(tl.music.file)} volume={tl.music.volume ?? 0.08} trackDuration={tl.music.duration ?? 300} total={tl.duration} />}
      </AbsoluteFill>
    </ThemeCtx.Provider>
  );
};

/** Music looped with a 6 s crossfade between loops, soft in and out. */
const Music: React.FC<{ src: string; volume: number; trackDuration: number; total: number }> = ({ src, volume, trackDuration, total }) => {
  const XF = 6;
  const step = trackDuration - XF - 1;
  const loops = Math.ceil(total / step);
  return (
    <>
      {Array.from({ length: loops }).map((_, k) => {
        const ini = k * step;
        const len = Math.min(trackDuration - 1, total - ini);
        return (
          <Sequence key={k} from={Math.round(ini * FPS)} durationInFrames={Math.max(1, Math.round(len * FPS))}>
            <Audio src={src} startFrom={k === 0 ? 0 : Math.round(20 * FPS)} volume={(f) => {
              const t = f / FPS, g = ini + t;
              const fadeIn = k === 0 ? Math.min(1, t / 2) : Math.min(1, t / XF);
              const fadeOut = Math.min(1, (len - t) / (k + 1 < loops ? XF : 3));
              const end = Math.min(1, (total - g) / 3);
              return volume * Math.max(0, Math.min(fadeIn, fadeOut, end));
            }} />
          </Sequence>
        );
      })}
    </>
  );
};

// ---------- pieces ----------
const In: React.FC<{ at: number; children: React.ReactNode; dy?: number; style?: React.CSSProperties }> = ({ at, children, dy = 24, style }) => {
  const f = useCurrentFrame();
  const p = progress(f, at, 24);
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * dy}px)`, filter: `blur(${(1 - p) * 8}px)`, ...style }}>{children}</div>;
};

/** Serif title with *accent* in italic accent color; words rise through a mask. */
const Title: React.FC<{ text: string; size: number; at: number; align?: "left" | "center"; width?: number; step?: number }> = ({ text, size, at, align = "left", width = 1500, step = 3 }) => {
  const f = useCurrentFrame();
  const T = useTheme();
  let ac = false;
  const ws = String(text ?? "").split(" ").map((w) => {
    if (w.startsWith("*")) ac = true;
    const it = { w: w.replace(/\*/g, ""), ac };
    if (/\*[.,!?:;]?$/.test(w)) ac = false;
    return it;
  });
  return (
    <div style={{ width, display: "flex", flexWrap: "wrap", justifyContent: align === "center" ? "center" : "flex-start", columnGap: size * 0.24, fontFamily: SERIF, fontSize: size, lineHeight: 1.04, letterSpacing: "-0.015em", color: T.text, textAlign: align }}>
      {ws.map((p, i) => {
        const k = progress(f, at + i * step, 22);
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", paddingBottom: size * 0.12, marginBottom: -size * 0.12 }}>
            <span style={{ display: "inline-block", transform: `translateY(${(1 - k) * 105}%)`, opacity: 0.2 + k * 0.8, fontStyle: p.ac ? "italic" : "normal", color: p.ac ? T.accent : undefined }}>{p.w}</span>
          </span>
        );
      })}
    </div>
  );
};

const Label: React.FC<{ text?: string; at?: number; center?: boolean }> = ({ text, at = 4, center }) => {
  const f = useCurrentFrame();
  const T = useTheme();
  const p = progress(f, at, 20);
  if (!text) return null;
  const rule = <div style={{ width: 40 * p, height: 1.5, background: T.accent, opacity: 0.8 }} />;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, opacity: p, justifyContent: center ? "center" : "flex-start" }}>
      {rule}
      <div style={{ fontFamily: MANROPE, fontWeight: 600, fontSize: 21, letterSpacing: "0.3em", textTransform: "uppercase", color: T.accent, whiteSpace: "nowrap" }}>{text}</div>
      {center && rule}
    </div>
  );
};

/** Photo with slow zoom and a gradient toward the text side. */
const Photo: React.FC<{ src: string; side?: "full" | "left" | "right"; focus?: string; opacity?: number; blur?: number; dark?: number }> = ({ src, side = "full", focus = "50% 50%", opacity = 1, blur = 0, dark = 0.0 }) => {
  const f = useCurrentFrame();
  const T = useTheme();
  const { durationInFrames } = useVideoConfig();
  const s = interpolate(f, [0, durationInFrames], [1.0, 1.07]);
  const box: React.CSSProperties = side === "full" ? { inset: 0 } : side === "left" ? { top: 0, bottom: 0, left: 0, width: "45%" } : { top: 0, bottom: 0, right: 0, width: "45%" };
  const g = side === "full"
    ? `linear-gradient(90deg, ${rgba(T.background, 0.93)} 0%, ${rgba(T.background, 0.7)} 40%, ${rgba(T.background, 0.2 + dark)} 72%, ${rgba(T.background, 0.35 + dark)} 100%), linear-gradient(0deg, ${rgba(T.background, 0.85)}, transparent 42%)`
    : `linear-gradient(${side === "left" ? 270 : 90}deg, ${T.background} 0%, ${rgba(T.background, 0.55)} 22%, ${rgba(T.background, 0.05)} 55%), linear-gradient(0deg, ${rgba(T.background, 0.6)}, transparent 35%)`;
  return (
    <div style={{ position: "absolute", overflow: "hidden", opacity, ...box }}>
      <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: focus, transform: `scale(${s})`, transformOrigin: focus, filter: blur ? `blur(${blur}px)` : undefined }} />
      <AbsoluteFill style={{ background: g }} />
    </div>
  );
};

const Logo: React.FC<{ file: (n: string) => string; height?: number; at?: number }> = ({ file, height = 46, at = 4 }) => {
  const f = useCurrentFrame();
  const T = useTheme();
  const p = progress(f, at, 30);
  return <Img src={file(T.logo)} style={{ height, filter: `brightness(0) invert(1) blur(${(1 - p) * 6}px)`, opacity: p }} />;
};

const Footer: React.FC<{ file: (n: string) => string; text?: string }> = ({ file, text }) => {
  const T = useTheme();
  return (
    <div style={{ position: "absolute", left: 120, top: 62, right: 120, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 0.7 }}>
      <Img src={file(T.logo)} style={{ height: 24, filter: "brightness(0) invert(1)" }} />
      {text && <div style={{ fontFamily: MANROPE, fontWeight: 600, fontSize: 15, letterSpacing: "0.26em", textTransform: "uppercase", color: rgba(T.text, 0.55) }}>{text}</div>}
    </div>
  );
};

const Icon: React.FC<{ name?: string; size?: number; color?: string }> = ({ name, size = 34, color }) => {
  const T = useTheme();
  const C = (name && ICONS[name]) || RiCheckboxCircleLine;
  return <C size={size} color={color ?? T.accent} />;
};

const ROMAN = ["I.", "II.", "III.", "IV.", "V.", "VI.", "VII.", "VIII.", "IX.", "X."];

// ---------- scenes ----------
const Content: React.FC<{ c: SceneT; q: (t?: number) => number; file: (n: string) => string; part: string }> = ({ c, q, file, part }) => {
  const f = useCurrentFrame();
  const T = useTheme();
  const m = (k: string) => q(c.marks?.[k]);
  const ini = q(c.start);
  const photo = (n: string) => file(`${n}.jpg`);
  const dim = rgba(T.text, 0.68);
  const rule = `1px solid ${rgba(T.text, 0.1)}`;

  if (c.type === "opening") {
    return (
      <>
        {c.photo && <Photo src={photo(c.photo)} focus="60% 50%" />}
        <AbsoluteFill style={{ padding: "0 120px", justifyContent: "center", alignItems: "flex-start", gap: 40 }}>
          <Logo file={file} height={52} />
          <Label text={c.label} at={14} />
          <Title text={c.title} size={138} at={18} width={1250} />
          {c.subtitle && <In at={ini + 60}><div style={{ fontFamily: INTER, fontSize: 30, color: rgba(T.text, 0.7), maxWidth: 900, lineHeight: 1.45 }}>{c.subtitle}</div></In>}
        </AbsoluteFill>
      </>
    );
  }

  if (c.type === "index") {
    const items = (c.items ?? []) as [string, string][];
    return (
      <AbsoluteFill style={{ padding: "0 120px", justifyContent: "center", gap: 60 }}>
        <Footer file={file} />
        <Label text={c.label} />
        {c.title && <Title text={c.title} size={96} at={6} />}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderTop: `1px solid ${rgba(T.accent, 0.2)}` }}>
          {items.map(([t, k], i) => (
            <In key={i} at={m(k)} style={{ padding: "34px 40px 34px 0", borderBottom: rule, paddingLeft: i % 3 ? 40 : 0, borderLeft: i % 3 ? rule : undefined }}>
              <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 34, color: T.accent }}>{ROMAN[i] ?? `${i + 1}.`}</div>
              <div style={{ fontFamily: SERIF, fontSize: 60, color: T.text, marginTop: 6 }}>{t}</div>
            </In>
          ))}
        </div>
      </AbsoluteFill>
    );
  }

  if (c.type === "chapter") {
    const p = progress(f, 4, 40);
    return (
      <>
        {c.photo && <Photo src={photo(c.photo)} focus="50% 45%" opacity={0.85} />}
        <AbsoluteFill style={{ padding: "0 120px 150px", justifyContent: "flex-end", gap: 10 }}>
          <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 240, lineHeight: 0.85, color: T.accent, opacity: p, transform: `translateY(${(1 - p) * 30}px)`, filter: `blur(${(1 - p) * 10}px)` }}>{c.number}</div>
          <Title text={c.title} size={150} at={10} />
        </AbsoluteFill>
      </>
    );
  }

  if (c.type === "numbers") {
    const items = c.items as { n: string; label: string; at: string }[];
    return (
      <AbsoluteFill style={{ padding: "0 120px", justifyContent: "center", gap: 46 }}>
        <Footer file={file} text={part} />
        <Label text={c.label} />
        <Title text={c.title} size={92} at={6} />
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${items.length}, 1fr)`, marginTop: 40, borderTop: `1px solid ${rgba(T.accent, 0.22)}` }}>
          {items.map((it, i) => (
            <In key={i} at={m(it.at)} style={{ padding: "44px 40px 0 0", paddingLeft: i ? 44 : 0, borderLeft: i ? rule : undefined }}>
              <div style={{ fontFamily: SERIF, fontSize: items.length > 3 ? 130 : 150, lineHeight: 0.95, color: T.text, fontStyle: i === items.length - 1 ? "italic" : "normal" }}>{it.n}</div>
              <div style={{ fontFamily: MANROPE, fontWeight: 600, fontSize: 20, letterSpacing: "0.22em", textTransform: "uppercase", color: T.accent, marginTop: 20, lineHeight: 1.5 }}>{it.label}</div>
            </In>
          ))}
        </div>
      </AbsoluteFill>
    );
  }

  if (c.type === "list") {
    const items = c.items as { title: string; desc: string; at: string; icon: string }[];
    const left = c.side === "left"; // photo on the left, text on the right
    const times = items.map((it) => m(it.at));
    const active = times.reduce((a, t, i) => (f >= t ? i : a), -1);
    return (
      <>
        {c.photo && <Photo src={photo(c.photo)} side={left ? "left" : "right"} />}
        <AbsoluteFill style={{ paddingLeft: left ? 930 : 120, paddingRight: left ? 120 : 930, justifyContent: "center", gap: 0 }}>
          <Label text={c.label} />
          <div style={{ height: 28 }} />
          <Title text={c.title} size={76} at={6} width={880} />
          <div style={{ height: 44 }} />
          {items.map((it, i) => {
            const on = i === active;
            const past = i < active;
            return (
              <In key={i} at={times[i]} style={{ display: "grid", gridTemplateColumns: "56px 1fr", padding: "20px 0", borderTop: rule, position: "relative" }}>
                <div style={{ position: "absolute", left: -24, top: 20, bottom: 20, width: 2, background: T.accent, opacity: on ? 1 : 0 }} />
                <div style={{ paddingTop: 2 }}><Icon name={it.icon} size={32} color={past ? rgba(T.accent, 0.6) : T.accent} /></div>
                <div style={{ opacity: on ? 1 : past ? 0.62 : 1 }}>
                  <div style={{ fontFamily: MANROPE, fontWeight: 600, fontSize: 30, color: T.text }}>{it.title}</div>
                  <div style={{ fontFamily: INTER, fontSize: 22, color: rgba(T.text, 0.66), marginTop: 6, lineHeight: 1.4 }}>{it.desc}</div>
                </div>
              </In>
            );
          })}
        </AbsoluteFill>
        <Footer file={file} text={part} />
      </>
    );
  }

  if (c.type === "quote") {
    const ls = c.lines as { text: string; at: string }[];
    return (
      <>
        <Photo src={photo(c.photo ?? "abstract")} opacity={0.45} focus="80% 50%" />
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 26 }}>
          <Label text={c.label} center />
          <In at={m(ls[0]?.at) - 8}><div style={{ fontFamily: SERIF, fontSize: 200, lineHeight: 0.5, height: 80, color: T.accent, opacity: 0.75, marginTop: 30 }}>“</div></In>
          {ls.map((l, i) => <Title key={i} text={l.text} size={i === 1 ? 128 : 84} at={m(l.at)} align="center" width={1600} step={4} />)}
        </AbsoluteFill>
        <Footer file={file} text={part} />
      </>
    );
  }

  if (c.type === "chat") {
    const ms = c.messages as { from: string; text: string; at: string }[];
    return (
      <>
        <AbsoluteFill style={{ paddingLeft: 120, paddingRight: 900, justifyContent: "center", gap: 34 }}>
          <Label text={c.label} />
          <Title text={c.title} size={112} at={6} width={900} />
          {c.subtitle && <In at={ini + 40}><div style={{ fontFamily: INTER, fontSize: 28, color: dim, lineHeight: 1.5, maxWidth: 780 }}>{c.subtitle}</div></In>}
        </AbsoluteFill>
        <ChatPhone messages={ms} m={m} contact={c.contact} />
        <Footer file={file} text={part} />
      </>
    );
  }

  if (c.type === "grid") {
    const items = c.items as { title: string; desc: string; at: string; icon: string }[];
    return (
      <AbsoluteFill style={{ padding: "0 120px", justifyContent: "center", gap: 0 }}>
        <Footer file={file} text={part} />
        <Label text={c.label} />
        <div style={{ height: 28 }} />
        <Title text={c.title} size={92} at={6} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", marginTop: 64, borderTop: rule }}>
          {items.map((it, i) => (
            <In key={i} at={m(it.at)} style={{ padding: "40px 36px 40px 0", paddingLeft: i ? 36 : 0, borderLeft: i ? rule : undefined }}>
              <Icon name={it.icon} size={38} />
              <div style={{ fontFamily: SERIF, fontSize: 46, color: T.text, margin: "22px 0 12px", lineHeight: 1.05 }}>{it.title}</div>
              <div style={{ fontFamily: INTER, fontSize: 22, color: rgba(T.text, 0.66), lineHeight: 1.45 }}>{it.desc}</div>
            </In>
          ))}
        </div>
        {c.highlight && (
          <div style={{ marginTop: 70, paddingTop: 44, borderTop: `1px solid ${rgba(T.accent, 0.25)}` }}>
            <Title text={c.highlight.text} size={72} at={m(c.highlight.at)} />
          </div>
        )}
      </AbsoluteFill>
    );
  }

  if (c.type === "steps") {
    const items = c.items as { title: string; desc: string; at: string }[];
    const pLine = items.length ? progress(f, m(items[0].at), Math.max(30, m(items[items.length - 1].at) - m(items[0].at) + 20)) : 0;
    return (
      <AbsoluteFill style={{ padding: "0 120px", justifyContent: "center" }}>
        <Footer file={file} text={part} />
        <Label text={c.label} />
        <div style={{ height: 28 }} />
        <Title text={c.title} size={100} at={6} />
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", marginTop: 100 }}>
          <div style={{ position: "absolute", left: 0, top: 31, height: 1.5, width: `${pLine * 100}%`, background: `linear-gradient(90deg, ${T.accent}, ${rgba(T.accent, 0.2)})` }} />
          {items.map((it, i) => (
            <In key={i} at={m(it.at)} style={{ paddingRight: 50 }}>
              <div style={{ width: 64, height: 64, borderRadius: 32, border: `1.5px solid ${T.accent}`, background: T.background, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SERIF, fontStyle: "italic", fontSize: 32, color: T.accent, position: "relative" }}>{i + 1}</div>
              <div style={{ fontFamily: SERIF, fontSize: 54, color: T.text, margin: "34px 0 14px", lineHeight: 1.05 }}>{it.title}</div>
              <div style={{ fontFamily: INTER, fontSize: 24, color: rgba(T.text, 0.66), lineHeight: 1.45 }}>{it.desc}</div>
            </In>
          ))}
        </div>
      </AbsoluteFill>
    );
  }

  if (c.type === "plans") {
    const items = c.items as { name: string; price: string; desc: string; at: string; featured?: boolean }[];
    const times = items.map((it) => m(it.at));
    const active = times.reduce((a, t, i) => (f >= t ? i : a), -1);
    return (
      <AbsoluteFill style={{ padding: "0 120px", justifyContent: "center" }}>
        <Footer file={file} text={part} />
        <Label text={c.label} />
        <div style={{ height: 28 }} />
        <Title text={c.title ?? "A plan for *every stage.*"} size={92} at={6} />
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, items.length)}, 1fr)`, gap: 26, marginTop: 70 }}>
          {items.map((it, i) => {
            const on = i === active;
            const pk = progress(f, times[i], 26);
            return (
              <In key={i} at={times[i]} style={{ position: "relative", padding: "46px 38px 44px", borderRadius: 30, border: `1px solid ${on || it.featured ? rgba(T.accent, 0.55) : rgba(T.text, 0.12)}`, background: it.featured ? `linear-gradient(170deg, ${rgba(T.primary, 0.6)}, ${rgba(T.dark, 0.25)} 60%, ${rgba(T.background, 0.4)})` : rgba(T.text, 0.03), transform: `scale(${on ? 1 + 0.03 * pk : 1})`, boxShadow: on ? `0 40px 100px ${rgba(T.primary, 0.35)}` : undefined, opacity: active >= 0 && !on ? 0.72 : 1 }}>
                {it.featured && <div style={{ position: "absolute", top: -16, left: 38, fontFamily: MANROPE, fontWeight: 700, fontSize: 14, letterSpacing: "0.2em", textTransform: "uppercase", background: T.accent, color: T.background, padding: "8px 15px", borderRadius: 99 }}>{c.badge ?? "Recommended"}</div>}
                <div style={{ fontFamily: SERIF, fontSize: 66, color: T.text }}>{it.name}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 26 }}>
                  <div style={{ fontFamily: SERIF, fontSize: 92, lineHeight: 1, color: T.text }}>{it.price}</div>
                  <div style={{ fontFamily: INTER, fontSize: 22, color: rgba(T.text, 0.6) }}>{c.period ?? "/mo"}</div>
                </div>
                <div style={{ marginTop: 30, paddingTop: 24, borderTop: `1px solid ${rgba(T.text, 0.12)}`, fontFamily: INTER, fontSize: 22, color: rgba(T.text, 0.72), lineHeight: 1.45 }}>{it.desc}</div>
              </In>
            );
          })}
        </div>
      </AbsoluteFill>
    );
  }

  if (c.type === "recommend") {
    const items = c.items as { profile: string; plan: string; at: string }[];
    return (
      <AbsoluteFill style={{ padding: "0 120px", justifyContent: "center" }}>
        <Footer file={file} text={part} />
        <Label text={c.label} />
        <div style={{ height: 28 }} />
        <Title text={c.title} size={96} at={6} />
        {c.question && (
          <In at={m(c.question.at)} style={{ marginTop: 36 }}>
            <div style={{ fontFamily: INTER, fontSize: 30, color: rgba(T.text, 0.72) }}>{c.question.text}</div>
          </In>
        )}
        <div style={{ marginTop: 50 }}>
          {items.map((it, i) => (
            <In key={i} at={m(it.at)} style={{ display: "grid", gridTemplateColumns: "1fr 80px 420px", alignItems: "center", padding: "30px 0", borderTop: rule }}>
              <div style={{ fontFamily: MANROPE, fontWeight: 600, fontSize: 34, color: T.text }}>{it.profile}</div>
              <RiArrowRightLine size={36} color={T.accent} />
              <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 72, color: T.accent, lineHeight: 1 }}>{it.plan}</div>
            </In>
          ))}
        </div>
      </AbsoluteFill>
    );
  }

  if (c.type === "objection") {
    const answers = c.answers as { text: string; at: string }[];
    return (
      <AbsoluteFill style={{ padding: "0 120px", flexDirection: "row", alignItems: "center", gap: 100 }}>
        <Footer file={file} text={part} />
        <div style={{ width: 720, display: "flex", flexDirection: "column", gap: 24 }}>
          <Label text={c.label ?? `Objection ${c.n ?? ""}`.trim()} />
          <Title text={`*${c.question}*`} size={118} at={6} width={720} />
        </div>
        <div style={{ flex: 1, borderLeft: `1px solid ${rgba(T.accent, 0.25)}`, paddingLeft: 80 }}>
          <In at={ini + 2}><div style={{ fontFamily: MANROPE, fontWeight: 600, fontSize: 18, letterSpacing: "0.28em", textTransform: "uppercase", color: rgba(T.text, 0.5), marginBottom: 20 }}>{c.answerLabel ?? "How to answer"}</div></In>
          {answers.map((r, i) => (
            <In key={i} at={m(r.at)} style={{ display: "grid", gridTemplateColumns: "60px 1fr", padding: "28px 0", borderTop: rule }}>
              <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 40, color: T.accent, lineHeight: 1 }}>{i + 1}</div>
              <div style={{ fontFamily: INTER, fontWeight: 500, fontSize: 34, color: T.text, lineHeight: 1.35 }}>{r.text}</div>
            </In>
          ))}
        </div>
      </AbsoluteFill>
    );
  }

  if (c.type === "caveats") {
    const soon = c.soon ?? { items: [] };
    const careful = c.careful ?? { items: [] };
    return (
      <AbsoluteFill style={{ padding: "0 120px", justifyContent: "center" }}>
        <Footer file={file} text={part} />
        <Label text={c.label} />
        <div style={{ height: 28 }} />
        <Title text={c.title} size={96} at={6} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 90, marginTop: 70 }}>
          <div>
            <In at={m(soon.at) - 4}><div style={{ fontFamily: MANROPE, fontWeight: 600, fontSize: 18, letterSpacing: "0.28em", textTransform: "uppercase", color: T.accent, marginBottom: 26 }}>{soon.label ?? "Coming soon · don't sell yet"}</div></In>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
              {(soon.items as string[]).map((t, i) => (
                <In key={i} at={m(soon.at) + i * 7} dy={14}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: INTER, fontWeight: 500, fontSize: 26, color: T.text, border: `1px solid ${rgba(T.text, 0.18)}`, borderRadius: 99, padding: "14px 24px" }}>
                    <RiTimeLine size={22} color={T.accent} />{t}
                  </div>
                </In>
              ))}
            </div>
          </div>
          <div>
            <In at={m(careful.at) - 4}><div style={{ fontFamily: MANROPE, fontWeight: 600, fontSize: 18, letterSpacing: "0.28em", textTransform: "uppercase", color: T.accent, marginBottom: 10 }}>{careful.label ?? "Handle with care"}</div></In>
            {(careful.items as { title: string; desc: string; at: string }[]).map((it, i) => (
              <In key={i} at={m(it.at)} style={{ display: "grid", gridTemplateColumns: "56px 1fr", padding: "24px 0", borderTop: rule }}>
                <RiErrorWarningLine size={32} color={T.accent} />
                <div>
                  <div style={{ fontFamily: MANROPE, fontWeight: 600, fontSize: 30, color: T.text }}>{it.title}</div>
                  <div style={{ fontFamily: INTER, fontSize: 23, color: rgba(T.text, 0.66), marginTop: 6 }}>{it.desc}</div>
                </div>
              </In>
            ))}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  // signoff
  return (
    <>
      {c.photo && <Photo src={photo(c.photo)} opacity={0.3} blur={3} />}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 50, background: `radial-gradient(ellipse 60% 55% at 50% 50%, ${rgba(T.background, 0.75)}, transparent)` }}>
        <Logo file={file} height={66} at={ini} />
        <Title text={c.title} size={110} at={ini + 20} align="center" width={1500} />
        <In at={ini + 70}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            {c.site && <div style={{ fontFamily: INTER, fontSize: 34, color: T.text }}>{c.site}</div>}
            {c.cta && <div style={{ fontFamily: MANROPE, fontWeight: 600, fontSize: 22, letterSpacing: "0.26em", textTransform: "uppercase", color: T.accent }}>{c.cta}</div>}
          </div>
        </In>
      </AbsoluteFill>
    </>
  );
};

// Chat on a phone. from: "user" (right bubble), "assistant" (brand bubble), "ok" (done badge), "team" (handoff badge).
const ChatPhone: React.FC<{ messages: { from: string; text: string; at: string }[]; m: (k: string) => number; contact?: { name?: string; status?: string } }> = ({ messages, m, contact }) => {
  const f = useCurrentFrame();
  const T = useTheme();
  const rise = progress(f, 6, 34);
  return (
    <div style={{ position: "absolute", right: 170, top: 90, width: 560, height: 900, borderRadius: 66, background: "#0d0d10", border: `1px solid ${rgba(T.text, 0.14)}`, boxShadow: `0 60px 140px rgba(0,0,0,.6), 0 0 0 10px ${rgba(T.text, 0.03)}`, padding: "28px 24px", display: "flex", flexDirection: "column", opacity: rise, transform: `translateY(${(1 - rise) * 80}px)` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 10px 22px", borderBottom: `1px solid ${rgba(T.text, 0.1)}` }}>
        <div style={{ width: 52, height: 52, borderRadius: 26, background: `linear-gradient(135deg, ${T.primary}, ${T.accent})`, display: "flex", alignItems: "center", justifyContent: "center" }}><RiSparkling2Line size={28} color="#fff" /></div>
        <div>
          <div style={{ fontFamily: MANROPE, fontWeight: 600, fontSize: 22, color: T.text }}>{contact?.name ?? "Your business"}</div>
          <div style={{ fontFamily: INTER, fontSize: 16, color: T.accent }}>{contact?.status ?? "Assistant · online"}</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "24px 4px", flex: 1, justifyContent: "flex-start" }}>
        {messages.map((x, i) => {
          const st: React.CSSProperties = { maxWidth: "84%", padding: "15px 20px", borderRadius: 22, fontFamily: INTER, fontSize: 20, lineHeight: 1.42, color: T.text };
          if (x.from === "user") Object.assign(st, { alignSelf: "flex-end", background: rgba(T.text, 0.09), borderBottomRightRadius: 6 });
          if (x.from === "assistant") Object.assign(st, { alignSelf: "flex-start", background: `linear-gradient(135deg, ${rgba(T.primary, 0.9)}, ${rgba(T.dark, 0.95)})`, borderBottomLeftRadius: 6 });
          if (x.from === "ok" || x.from === "team") Object.assign(st, { alignSelf: "flex-start", border: `1px solid ${rgba(T.accent, 0.3)}`, color: T.accent, fontSize: 18, display: "flex", alignItems: "center", gap: 10, padding: "12px 18px" });
          return (
            <In key={i} at={m(x.at)} dy={16} style={{ display: "flex", flexDirection: "column" }}>
              <div style={st}>
                {x.from === "ok" && <RiCheckboxCircleLine size={20} color={T.accent} />}
                {x.from === "team" && <RiCustomerService2Line size={20} color={T.accent} />}
                {x.text}
              </div>
            </In>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 6px 8px", padding: "16px 22px", borderRadius: 99, border: `1px solid ${rgba(T.text, 0.1)}`, color: rgba(T.text, 0.4), fontFamily: INTER, fontSize: 18 }}>
        Message <RiMicLine size={22} color={rgba(T.text, 0.4)} />
      </div>
    </div>
  );
};

/** Discreet captions: a short sentence at a time, at the bottom. */
const Captions: React.FC<{ words: Word[]; hide: [number, number][] }> = ({ words, hide }) => {
  const f = useCurrentFrame();
  const T = useTheme();
  const t = f / FPS;
  const chunks = useMemo(() => {
    const out: number[][] = [];
    let cur: number[] = [];
    words.forEach((w, i) => {
      cur.push(i);
      const next = words[i + 1];
      const pause = next ? next.start - w.end > 0.5 : true;
      if ((/[.,:;!?]$/.test(w.text) && cur.length >= 3) || cur.length >= 8 || pause) { out.push(cur); cur = []; }
    });
    if (cur.length) out.push(cur);
    return out;
  }, [words]);
  const b = chunks.find((x) => t >= words[x[0]].start - 0.08 && t <= words[x[x.length - 1]].end + 0.3);
  if (!b || hide.some(([a, z]) => words[b[0]].start >= a && words[b[0]].start < z)) return null;
  const p = progress(f, (words[b[0]].start - 0.08) * FPS, 8);
  return (
    <div style={{ position: "absolute", bottom: 46, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: p }}>
      <div style={{ fontFamily: INTER, fontWeight: 500, fontSize: 30, color: "#fff", textShadow: "0 2px 16px rgba(0,0,0,.85)", background: rgba(T.background, 0.55), padding: "8px 22px", borderRadius: 12, maxWidth: 1500, textAlign: "center" }}>
        {b.map((i) => words[i].text).join(" ")}
      </div>
    </div>
  );
};
