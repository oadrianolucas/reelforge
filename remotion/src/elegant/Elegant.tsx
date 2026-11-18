import { AbsoluteFill, Audio, CalculateMetadataFunction, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import {
  CaptionConfig, Caption, DEFAULT_THEME, Format, LAYOUT, Label, LogoIn, Glow, Media, NumberItem, Numbers, PerFormat,
  QuoteMark, Scene, Soft, Theme, ThemeCtx, Title, Veil, Word, captionChunks, file, perFormat, progress, useTheme,
} from "./base";
import { SCREENS } from "./screens";
import { FPS, PLACEHOLDER_SECONDS, SIZE } from "../components/formats";
import { fetchJson } from "../components/theme";
import { Placeholder } from "../components/Placeholder";

// Template of the "elegant brand" style (skill .claude/skills/elegant-brand). Reads public/<slug>/script.json
// (written in the job and copied by scripts/elegant.py). EVERY time is a WORD index of the narration (alignment.json):
// "from" = word where the scene starts (it lasts until the next scene's "from"; the last one until the end of the
// speech + 2.6 s), "at" = word where the element enters. The same assembly serves 9:16, 4:5 and 1:1 (props.format).

type LabelSpec = string | { text: string; formats?: Format[] };
type Line = { text: string; at: number; size?: PerFormat<number> };
type PhotoScene = { type: "photo"; from: number; media: string; focus?: string; zoom?: [number, number]; darken?: number; label?: LabelSpec; titles?: Line[]; sub?: { text: string; at: number }; position?: "bottom" | "center" };
type SequenceScene = { type: "sequence"; from: number; items: { media: string; at: number; focus?: string }[]; numbers?: (NumberItem & { at: number })[]; label?: LabelSpec };
type QuoteScene = { type: "quote"; from: number; background: string; label?: LabelSpec; lines: Line[] };
type AppScene = { type: "app"; from: number; screen: string; label?: LabelSpec; groups?: Line[][]; marks?: Record<string, number> };
type SignoffScene = { type: "signoff"; from: number; title: string; at: number; site?: string; cta?: string; siteAt?: number };
type SceneSpec = PhotoScene | SequenceScene | QuoteScene | AppScene | SignoffScene;

export type ElegantScript = {
  theme?: Partial<Theme>;
  alignment?: string; // default "alignment.json"
  narration?: string; // default "narration.mp3"
  music?: { file: string; volume?: number; start?: number };
  captions?: CaptionConfig;
  scenes: SceneSpec[];
};
type Props = { slug: string; format?: Format; script?: ElegantScript; words?: Word[] };

const END_PAD = 2.6;

export const calculateElegantMetadata: CalculateMetadataFunction<Props> = async ({ props }) => {
  const [width, height] = SIZE[props.format ?? "9:16"];
  const empty = { durationInFrames: PLACEHOLDER_SECONDS * FPS, width, height, props };
  if (!props.slug) return empty;
  const script = await fetchJson<ElegantScript>(staticFile(`${props.slug}/script.json`));
  const al = script ? await fetchJson<{ words: Word[] }>(staticFile(`${props.slug}/${script.alignment ?? "alignment.json"}`)) : null;
  const words = (al?.words ?? []).filter((w) => w.text.trim());
  if (!script || !words.length) return empty;
  return { durationInFrames: Math.round((words[words.length - 1].end + END_PAD) * FPS), width, height, props: { ...props, script, words } };
};

export const Elegant: React.FC<Props> = ({ slug, format = "9:16", script, words }) => {
  if (!script || !words?.length) return <Placeholder title="Elegant" hint={`No data: publish script.json + alignment.json to public/${slug || "<slug>"}/ (scripts/elegant.py).`} />;
  const theme: Theme = { ...DEFAULT_THEME, ...script.theme, slug };
  return (
    <ThemeCtx.Provider value={theme}>
      <Video r={script} al={words} format={format} />
    </ThemeCtx.Provider>
  );
};

const visibleLabel = (r: LabelSpec | undefined, f: Format): string | null => {
  if (!r) return null;
  if (typeof r === "string") return f === "1:1" ? null : r; // in 1:1 there is no height for label + title
  return !r.formats || r.formats.includes(f) ? r.text : null;
};

const Video: React.FC<{ r: ElegantScript; al: Word[]; format: Format }> = ({ r, al, format }) => {
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const L = LAYOUT[format];
  const speechEnd = al[al.length - 1].end;
  const t = (i: number) => (i >= al.length ? speechEnd + END_PAD : al[i].start);
  const scenes = r.scenes;
  const chunks = captionChunks(al, r.captions?.join);

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Glow />
      {scenes.map((c, k) => {
        const ini = t(c.from) - (k === 0 ? 0 : 0.25);
        const end = k + 1 < scenes.length ? t(scenes[k + 1].from) : speechEnd + END_PAD;
        const from = Math.max(0, Math.round(ini * fps));
        const dur = Math.max(1, Math.round((end + (k + 1 < scenes.length ? 0.2 : 0)) * fps) - from);
        const q = (i: number) => Math.round((t(i) - ini) * fps); // frame of word i inside the scene
        const last = k === scenes.length - 1;
        return (
          <Sequence key={k} from={from} durationInFrames={dur}>
            <Scene exit={!last}>
              <Content c={c} q={q} format={format} ini={ini} end={end} />
            </Scene>
          </Sequence>
        );
      })}
      <Caption y={L.captionY} words={al} chunks={chunks} cfg={r.captions ?? {}} />
      <Audio src={file(theme, r.narration ?? "narration.mp3")} />
      {r.music && <Music {...r.music} />}
    </AbsoluteFill>
  );
};

const Music: React.FC<{ file: string; volume?: number; start?: number }> = ({ file: name, volume = 0.15, start = 0 }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const theme = useTheme();
  const vol = interpolate(frame, [0, fps * 1.5, durationInFrames - fps * 2.5, durationInFrames], [0, volume, volume, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <Audio src={file(theme, name)} volume={vol} startFrom={Math.round(start * fps)} />;
};

const Top: React.FC<{ text: string | null; format: Format }> = ({ text, format }) =>
  text ? (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: LAYOUT[format].labelY }}>
      <Label text={text} start={6} />
    </AbsoluteFill>
  ) : null;

const Content: React.FC<{ c: SceneSpec; q: (i: number) => number; format: Format; ini: number; end: number }> = ({ c, q, format, ini, end }) => {
  const { fps } = useVideoConfig();
  const theme = useTheme();
  const L = LAYOUT[format];
  const size = (l: Line, fallback: number) => L.title * perFormat(l.size, format, fallback);

  if (c.type === "photo") {
    const lines = c.titles ?? [];
    return (
      <>
        <Media src={c.media} focus={c.focus} zoom={c.zoom} darken={c.darken} />
        <Top text={visibleLabel(c.label, format)} format={format} />
        <AbsoluteFill style={{ alignItems: "center", justifyContent: c.position === "center" ? "center" : "flex-end", paddingBottom: c.position === "center" ? 0 : L.bottom, gap: 18 }}>
          {lines.map((l, i) => <Title key={i} text={l.text} size={size(l, 1)} start={Math.max(8, q(l.at))} width={1000} />)}
          {c.sub && (
            <Sequence layout="none" from={q(c.sub.at)}>
              <div style={{ height: 8 }} />
              <Soft text={c.sub.text} />
            </Sequence>
          )}
        </AbsoluteFill>
      </>
    );
  }

  if (c.type === "sequence") {
    const ns = c.numbers ?? [];
    return (
      <>
        {c.items.map((it, i) => {
          const a = Math.max(0, q(it.at) - (i === 0 ? 0 : 7));
          const b = i + 1 < c.items.length ? q(c.items[i + 1].at) + 6 : Math.round((end - ini + 0.2) * fps);
          return (
            <Sequence key={i} from={a} durationInFrames={Math.max(1, b - a)}>
              <Scene exit={i + 1 < c.items.length}><Media src={it.media} focus={it.focus} /></Scene>
            </Sequence>
          );
        })}
        <Top text={visibleLabel(c.label, format)} format={format} />
        {ns.length > 0 && <Veil start={q(ns[0].at) - 8} />}
        {ns.length > 0 && (
          <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: L.numbers }}>
            <Numbers format={format} items={ns} marks={ns.map((n) => q(n.at))} />
          </AbsoluteFill>
        )}
      </>
    );
  }

  if (c.type === "quote") {
    return (
      <>
        <Media src={c.background} blur={16} darken={0.55} />
        <Top text={visibleLabel(c.label, format)} format={format} />
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 40 }}>
          {c.lines.length > 0 && <QuoteMark start={q(c.lines[0].at) - 6} />}
          {c.lines.map((l, i) => <Title key={i} text={l.text} size={L.quote * perFormat(l.size, format, 1)} start={q(l.at)} step={5} />)}
        </AbsoluteFill>
      </>
    );
  }

  if (c.type === "app") {
    const Screen = SCREENS[c.screen];
    const groups = c.groups ?? [];
    const marks = Object.fromEntries(Object.entries(c.marks ?? {}).map(([k, v]) => [k, q(v)]));
    return (
      <>
        <Top text={visibleLabel(c.label, format)} format={format} />
        {groups.map((g, i) => {
          const a = i === 0 ? 0 : Math.max(0, q(g[0].at) - 8);
          const b = i + 1 < groups.length ? q(groups[i + 1][0].at) - 6 : Math.round((end - ini + 0.2) * fps);
          const fallback = g.length > 1 || i > 0 ? perFormat({ "9:16": 0.8, "4:5": 0.72, "1:1": 0.62 }, format, 0.8) : 0.86;
          return (
            <Sequence key={i} from={a} durationInFrames={Math.max(1, b - a)}>
              <Scene exit={i + 1 < groups.length}>
                <AbsoluteFill style={{ alignItems: "center", paddingTop: L.titleY - (g.length > 1 ? 30 : format === "1:1" ? 20 : 0), gap: 6 }}>
                  {g.map((l, j) => <Title key={j} text={l.text} size={size(l, fallback)} start={q(l.at) - a} step={3} width={1000} />)}
                </AbsoluteFill>
              </Scene>
            </Sequence>
          );
        })}
        {Screen ? <Stage format={format}><Screen marks={marks} portrait={format === "9:16"} /></Stage> : <Soft text={`screen "${c.screen}" is not registered`} />}
      </>
    );
  }

  // signoff
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 46 }}>
      <LogoIn />
      <Title text={c.title} size={L.title * 0.9} start={q(c.at)} step={3} width={880} />
      <Sequence layout="none" from={q(c.siteAt ?? c.at) + 10}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          {c.site && <Soft text={c.site} color={theme.text} size={36} />}
          {c.cta && <Soft text={c.cta} size={26} spaced />}
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};

/** Tablet rising and settling, with a light forward zoom during the scene. */
const Stage: React.FC<{ format: Format; children: React.ReactNode }> = ({ format, children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const L = LAYOUT[format];
  const rise = progress(frame, 4, 34);
  const scale = L.tablet * (1 + interpolate(frame, [0, durationInFrames], [0, 0.03]));
  return (
    <div style={{ position: "absolute", left: "50%", top: L.tabletY, transform: `translate(-50%,-50%) translateY(${(1 - rise) * 120}px) scale(${scale})`, opacity: rise }}>
      {children}
    </div>
  );
};
