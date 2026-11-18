import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT } from "./fonts";
import { Theme, rgba } from "./theme";

type Props = {
  theme: Theme;
  logo?: string; // URL (staticFile) of the white logo; omitted = no logo
  title: React.ReactNode;
  subtitle?: string;
  cta?: string; // button text (e.g. the site); omitted = no button
};

// Final CTA card in the brand identity: near-black background with a soft accent glow, white logo, one accent color.
export const EndCard: React.FC<Props> = ({ theme, logo, title, subtitle, cta }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  // in the square everything shrinks to fit the height
  const k = Math.min(1, height / width / 1.6 + 0.38);
  const p = (delay: number) => spring({ frame: frame - delay, fps, config: { damping: 16, stiffness: 150 } });
  const rise = (delay: number): React.CSSProperties => ({ opacity: p(delay), transform: `translateY(${interpolate(p(delay), [0, 1], [40, 0])}px)` });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 80% 45% at 50% 42%, ${rgba(theme.accent, 0.22)}, transparent 70%), ${theme.background}`,
        fontFamily: FONT,
        color: theme.text,
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "0 90px",
      }}
    >
      {logo && <Img src={logo} style={{ width: 520 * k, ...rise(0), transform: `${rise(0).transform} scale(${interpolate(p(0), [0, 1], [0.9, 1])})` }} />}
      <div style={{ ...rise(8), marginTop: logo ? 90 * k : 0, fontSize: 82 * k, fontWeight: 700, lineHeight: 1.08, letterSpacing: "-0.035em" }}>{title}</div>
      {subtitle && <div style={{ ...rise(16), marginTop: 44 * k, fontSize: 38 * k, color: theme.textDim, fontWeight: 500 }}>{subtitle}</div>}
      {cta && (
        <div
          style={{
            ...rise(24),
            marginTop: 70 * k,
            padding: `${26 * k}px ${64 * k}px`,
            borderRadius: 18,
            background: theme.accent,
            color: "#fff",
            fontSize: 50 * k,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            boxShadow: `0 20px 60px ${rgba(theme.accent, 0.45)}`,
          }}
        >
          {cta}
        </div>
      )}
    </AbsoluteFill>
  );
};

/** "text with *accent*" → spans; the part between asterisks gets `color`. */
export const accented = (text: string, color: string) =>
  text.split(/(\*[^*]+\*)/).filter(Boolean).map((p, k) => (p.startsWith("*") ? <span key={k} style={{ color }}>{p.slice(1, -1)}</span> : <span key={k}>{p}</span>));
