import { AbsoluteFill, Audio, CalculateMetadataFunction, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/TikTokSans";
import { loadFont as loadEmoji } from "@remotion/google-fonts/NotoColorEmoji";
import { Format, FPS, PLACEHOLDER_SECONDS, SIZE } from "../../components/formats";
import { fetchJson } from "../../components/theme";
import { Placeholder } from "../../components/Placeholder";

// "Vibe + text" style: a single take of the person enjoying the music, testimonial block fixed from the 1st frame in
// the upper third, list growing one line per beat. No logo, no CTA.
// Data: public/<slug>/vibe.json (clip and music are files in the same folder).
const tiktok = loadFont("normal", { weights: ["600"], subsets: ["latin", "latin-ext"] });
const emoji = loadEmoji();
const FONT = `${tiktok.fontFamily}, ${emoji.fontFamily}, sans-serif`;

type Adjust = { top?: number; fontSize?: number; focus?: string };
export type VibeData = {
  clip: string; // the selfie clip (muted)
  music: string; // the track, already cut to end before the person relaxes
  block: string[]; // testimonial lines, visible from the first frame
  list: string[]; // lines that appear one per beat
  listTimes: number[]; // second each list line appears (same length as `list`)
  duration?: number; // seconds (default 10)
  // per-format tweak: when the person sits high in the frame, move/shrink the text so it does not cover the face;
  // in 1:1 / 4:5, `focus` lowers the face inside the crop
  adjust?: Partial<Record<Format, Adjust>>;
};
type Props = { slug: string; format: Format; data?: VibeData };

export const DEFAULT_VIBE_SECONDS = 10;

const LAYOUT: Record<Format, { top: number; fontSize: number; width: number; focus: string }> = {
  "9:16": { top: 215, fontSize: 46, width: 1010, focus: "50% 50%" },
  "4:5": { top: 110, fontSize: 43, width: 1005, focus: "50% 45%" },
  "1:1": { top: 50, fontSize: 40, width: 1000, focus: "50% 40%" },
};

export const calculateVibeTextMetadata: CalculateMetadataFunction<Props> = async ({ props }) => {
  const [width, height] = SIZE[props.format];
  const data = props.slug ? await fetchJson<VibeData>(staticFile(`${props.slug}/vibe.json`)) : null;
  if (!data) return { durationInFrames: PLACEHOLDER_SECONDS * FPS, width, height, props };
  return { durationInFrames: Math.round((data.duration ?? DEFAULT_VIBE_SECONDS) * FPS), width, height, props: { ...props, data } };
};

// Native TikTok/Reels text: white, thin black outline, medium weight, centered, no animation.
const textStyle = (size: number): React.CSSProperties => ({
  fontFamily: FONT,
  fontWeight: 600,
  fontSize: size,
  lineHeight: 1.24,
  color: "#fff",
  WebkitTextStroke: `${size * 0.09}px #000`,
  paintOrder: "stroke fill",
  textAlign: "center",
  letterSpacing: "-0.01em",
});

export const VibeText: React.FC<Props> = ({ slug, format, data }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  if (!data) return <Placeholder title="VibeText" hint={`No data: put vibe.json, the clip and the music in public/${slug || "<slug>"}/.`} />;
  const L = { ...LAYOUT[format], ...(data.adjust?.[format] ?? {}) };
  const t = frame / fps;
  // every line fits whole (no wrapping): the font shrinks by the longest line (~0.53 em per character)
  const longest = Math.max(1, ...[...data.block, ...data.list].map((l) => [...l].length));
  const size = Math.min(L.fontSize, L.width / (longest * 0.53));
  const volume = (f: number) => 0.9 * interpolate(f, [durationInFrames - 12, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const file = (n: string) => staticFile(`${slug}/${n}`);

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <OffthreadVideo src={file(data.clip)} muted style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: L.focus }} />
      <div style={{ position: "absolute", top: L.top, left: "50%", transform: "translateX(-50%)", width: L.width, whiteSpace: "nowrap", ...textStyle(size) }}>
        {data.block.map((line) => (
          <div key={line}>{line}</div>
        ))}
        <div style={{ height: size * 1.1 }} />
        {data.list.map((line, i) => (
          <div key={line} style={{ visibility: t >= (data.listTimes[i] ?? 0) ? "visible" : "hidden" }}>
            {line}
          </div>
        ))}
      </div>
      <Audio src={file(data.music)} volume={volume} />
    </AbsoluteFill>
  );
};
