import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { FONT } from "./fonts";

export type Word = { text: string; start: number; end: number };

type Props = {
  words: Word[];
  highlights: string[]; // words (no punctuation, lowercase) that get the brand-color treatment
  highlightColor: string;
  y: number; // vertical center of the captions, in px
  until?: number; // hidden from this second on
  from?: number; // only shows from this second on
  maxWords?: number;
  size?: number; // font size in px
  variant?: "minimal" | "pill"; // minimal: weight 600, soft shadow, highlight only in color · pill: 800 with outline and pill
};

const clean = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

// Groups into chunks of up to N words, breaking after punctuation (end of sentence/comma).
function chunks(words: Word[], max: number): Word[][] {
  const out: Word[][] = [];
  let current: Word[] = [];
  for (const w of words) {
    current.push(w);
    if (current.length >= max || /[.,!?:…]$/.test(w.text)) {
      out.push(current);
      current = [];
    }
  }
  if (current.length) out.push(current);
  return out;
}

export const Captions: React.FC<Props> = ({ words, highlights, highlightColor, y, until, from, maxWords = 3, size = 78, variant = "minimal" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  if (until !== undefined && t >= until) return null;
  if (from !== undefined && t < from) return null;

  const list = chunks(words, maxWords);
  const i = list.findIndex((b, k) => {
    const end = k + 1 < list.length ? list[k + 1][0].start : b[b.length - 1].end + 0.4;
    return t >= b[0].start - 0.05 && t < end - 0.05;
  });
  if (i < 0) return null;
  const chunk = list[i];
  const min = variant === "minimal";
  const enter = spring({ frame: frame - Math.round((chunk[0].start - 0.05) * fps), fps, config: { damping: 14, stiffness: 220 } });

  return (
    <div
      style={{
        position: "absolute",
        left: 60,
        right: 60,
        top: y,
        transform: `translateY(-50%) scale(${interpolate(enter, [0, 1], [0.85, 1])})`,
        opacity: enter,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: min ? "4px 0.28em" : "6px 18px",
        fontFamily: FONT,
        fontWeight: min ? 600 : 800,
        fontSize: size,
        lineHeight: 1.15,
        letterSpacing: min ? "-0.015em" : "-0.02em",
        color: "#fff",
        textShadow: min ? "0 0 24px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.7)" : "0 6px 22px rgba(0,0,0,0.6)",
        WebkitTextStroke: min ? undefined : `${Math.round(size / 7.8)}px rgba(0,0,0,0.88)`,
        paintOrder: min ? undefined : "stroke fill",
      }}
    >
      {chunk.map((w, k) => {
        const spoken = t >= w.start;
        const hl = highlights.includes(clean(w.text));
        return (
          <span
            key={k}
            style={{
              display: "inline-block",
              padding: hl && !min ? "2px 18px 6px" : 0,
              borderRadius: 16,
              background: hl && !min ? highlightColor : "transparent",
              color: hl && min ? highlightColor : undefined,
              boxShadow: hl && !min ? "0 8px 24px rgba(0,0,0,0.35)" : "none",
              WebkitTextStroke: hl && !min ? "0px transparent" : undefined,
              opacity: spoken ? 1 : min ? 0.72 : 0.55,
              transform: `scale(${spoken && t < w.end ? (min ? 1.03 : 1.06) : 1})`,
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
};
