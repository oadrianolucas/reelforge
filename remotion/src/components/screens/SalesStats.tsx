import { Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { RiArrowUpLine } from "@remixicon/react";
import { FONT } from "../fonts";
import { rgba } from "../theme";
import type { PhoneScreenProps } from "./types";

// Example phone screen (generic, no brand): app header, a big number counting up, a small bar chart and a few rows.
// Extra props (all optional): title, currency ("$"), locale ("en-US"), rows: { label, value }[], bars: number[] (0–1).
export const SalesStats: React.FC<PhoneScreenProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const { theme } = p;
  const title = (p.title as string | undefined) ?? "Today";
  const locale = (p.locale as string | undefined) ?? "en-US";
  const currency = (p.currency as string | undefined) ?? "$";
  const rows = (p.rows as { label: string; value: string }[] | undefined) ?? [
    { label: "Orders", value: "24" },
    { label: "Returning customers", value: "38%" },
    { label: "Avg. ticket", value: `${currency}52` },
  ];
  const bars = (p.bars as number[] | undefined) ?? [0.35, 0.5, 0.42, 0.66, 0.58, 0.8, 1];
  const target = p.value ?? 1247.8;
  const count = interpolate(t, [0.3, Math.min(1.8, p.duration * 0.7)], [0, target], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const enter = (delay: number) => spring({ frame: frame - delay, fps, config: { damping: 16, stiffness: 170 } });

  return (
    <div style={{ position: "absolute", inset: 0, background: theme.background, color: theme.text, fontFamily: FONT, padding: "64px 20px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
        {p.icon ? <Img src={p.icon} style={{ width: 30, height: 30, borderRadius: 8 }} /> : <div style={{ width: 30, height: 30, borderRadius: 8, background: theme.accent }} />}
        <div style={{ fontWeight: 700, fontSize: 18 }}>{p.appName ?? "Dashboard"}</div>
      </div>
      <div style={{ background: theme.surface, borderRadius: 16, padding: "18px 18px 16px", border: "1px solid rgba(255,255,255,0.08)", opacity: enter(0) }}>
        <div style={{ fontSize: 13, color: theme.textDim, fontWeight: 500 }}>{title}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>
            {currency}
            {count.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ display: "flex", alignItems: "center", fontSize: 13, fontWeight: 600, color: theme.highlight }}>
            <RiArrowUpLine size={14} color={theme.highlight} />
            {Math.round((target / 1000) * 10)}%
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 90, marginTop: 14 }}>
          {bars.map((b, i) => {
            const g = enter(6 + i * 2);
            return <div key={i} style={{ flex: 1, height: `${b * 100 * g}%`, borderRadius: 6, background: i === bars.length - 1 ? theme.accent : rgba(theme.accent, 0.35) }} />;
          })}
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        {rows.map((r, i) => {
          const g = enter(14 + i * 4);
          return (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "14px 4px", borderBottom: "1px solid rgba(255,255,255,0.07)", fontSize: 15, opacity: g, transform: `translateY(${(1 - g) * 12}px)` }}>
              <span style={{ color: theme.textDim }}>{r.label}</span>
              <span style={{ fontWeight: 700 }}>{r.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
