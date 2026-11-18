import { Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import * as Remix from "@remixicon/react";
import type { RemixiconComponentType } from "@remixicon/react";
import { FONT } from "../fonts";
import { rgba } from "../theme";
import type { PhoneScreenProps } from "./types";

// Generic loyalty card screen: stamps filling one by one up to `stamps` of `total`, progress bar and the reward.
// Extra props (all optional): title ("Loyalty card"), stamps (default total-1), total (default 10),
// reward ("Next one is on us"), stampIcon (Remix name, default RiStarFill).
export const StampCard: React.FC<PhoneScreenProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const { theme } = p;
  const total = (p.total as number | undefined) ?? 10;
  const stamps = (p.stamps as number | undefined) ?? total - 1;
  const lib = Remix as unknown as Record<string, RemixiconComponentType>;
  const Stamp = lib[(p.stampIcon as string) ?? ""] ?? lib.RiStarFill;
  const filled = interpolate(t, [0.2, Math.min(1.6, p.duration * 0.7)], [0, stamps], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const enter = (d: number) => spring({ frame: frame - d, fps, config: { damping: 18, stiffness: 160 } });
  const cols = 5;
  return (
    <div style={{ position: "absolute", inset: 0, background: theme.background, color: theme.text, fontFamily: FONT, padding: "62px 22px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {p.icon ? <Img src={p.icon} style={{ width: 30, height: 30, borderRadius: 8 }} /> : <div style={{ width: 30, height: 30, borderRadius: 9, background: `linear-gradient(140deg, ${theme.highlight}, ${theme.accent})` }} />}
        <div style={{ fontWeight: 700, fontSize: 18 }}>{(p.title as string) ?? "Loyalty card"}</div>
      </div>
      <div style={{ marginTop: 26, borderRadius: 26, padding: "24px 20px", background: `linear-gradient(150deg, ${theme.accent}, ${rgba(theme.accent, 0.7)} 60%, ${rgba(theme.highlight, 0.8)})`, color: "#fff", opacity: enter(0), transform: `translateY(${(1 - enter(0)) * 20}px)`, boxShadow: `0 18px 40px ${rgba(theme.accent, 0.35)}` }}>
        <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.85 }}>{p.appName ?? "Rewards"}</div>
        <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.03em", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
          {Math.round(filled)}
          <span style={{ fontSize: 22, opacity: 0.75 }}> / {total}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10, marginTop: 18 }}>
          {Array.from({ length: total }).map((_, i) => {
            const on = filled >= i + 1 - 0.01;
            const pop = on ? spring({ frame: frame - Math.round((0.2 + (i / Math.max(1, stamps)) * (Math.min(1.6, p.duration * 0.7) - 0.2)) * fps), fps, config: { damping: 10, stiffness: 260 } }) : 0;
            const last = i === total - 1;
            return (
              <div key={i} style={{ aspectRatio: "1", borderRadius: 14, display: "grid", placeItems: "center", background: on ? "#fff" : "rgba(255,255,255,0.14)", border: last && !on ? "2px dashed rgba(255,255,255,0.7)" : "none", transform: `scale(${on ? 0.7 + 0.3 * pop : 1})` }}>
                <Stamp size={24} color={on ? theme.accent : "rgba(255,255,255,0.55)"} />
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ marginTop: 22, opacity: enter(10) }}>
        <div style={{ height: 10, borderRadius: 5, background: theme.surface, overflow: "hidden" }}>
          <div style={{ width: `${(filled / total) * 100}%`, height: "100%", background: theme.highlight, borderRadius: 5 }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 15 }}>
          <span style={{ color: theme.textDim }}>{(p.reward as string) ?? "Next one is on us"}</span>
          <span style={{ fontWeight: 700 }}>{total - Math.round(filled)} to go</span>
        </div>
      </div>
    </div>
  );
};
