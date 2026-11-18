import { useCurrentFrame } from "remotion";
import { RiArrowUpLine, RiBarChartBoxLine, RiCalendarLine, RiUser3Line } from "@remixicon/react";
import { INTER, MANROPE, progress, rgba, useTheme } from "../base";
import type { ScreenProps } from "./types";

// Example screen (generic, no brand): a tablet with a small analytics dashboard. Colors come from the theme.
// marks (word indices in script.json → scene.marks): "open" (cards appear), "grow" (chart draws), "highlight" (last
// point is circled). Missing marks fall back to a timed sequence.

const PAPER = "#F7F6F3";
const INK = "#16171B";
const MUTED = "#6E6F76";
const BORDER = "#E3E1DC";

export const StatsDashboard: React.FC<ScreenProps> = ({ marks, portrait }) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const open = marks.open ?? 10;
  const grow = marks.grow ?? open + 30;
  const highlight = marks.highlight ?? grow + 40;
  const W = portrait ? 820 : 1120;
  const H = portrait ? 1100 : 760;
  const kpis = [
    { Icon: RiUser3Line, label: "Visitors", value: "12.4k" },
    { Icon: RiCalendarLine, label: "Bookings", value: "318" },
    { Icon: RiBarChartBoxLine, label: "Conversion", value: "4.2%" },
  ];
  const pts: [number, number][] = [[0, 0.78], [0.14, 0.7], [0.28, 0.74], [0.42, 0.55], [0.57, 0.5], [0.71, 0.36], [0.85, 0.3], [1, 0.14]];
  const line = progress(frame, grow, 40);
  const ring = progress(frame, highlight, 20);
  const chartW = W - 112;
  const chartH = portrait ? 420 : 260;
  const d = pts.map(([x, y], k) => `${k ? "L" : "M"} ${x * chartW} ${y * chartH}`).join(" ");
  const tip = pts[pts.length - 1];

  return (
    <div style={{ width: W + 44, height: H + 44, borderRadius: 48, padding: 22, background: "linear-gradient(145deg, #2b2c30, #121316)", boxShadow: `0 60px 140px rgba(0,0,0,.55), 0 0 0 1px ${rgba(t.accent, 0.15)}` }}>
      <div style={{ width: W, height: H, borderRadius: 28, overflow: "hidden", background: PAPER, color: INK, fontFamily: INTER, padding: "34px 34px 0", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `linear-gradient(135deg, ${t.primary}, ${t.accent})` }} />
            <div style={{ fontFamily: MANROPE, fontWeight: 700, fontSize: 24 }}>Overview</div>
          </div>
          <div style={{ fontSize: 18, color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 99, padding: "8px 18px" }}>Last 30 days</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18, marginTop: 30 }}>
          {kpis.map(({ Icon, label, value }, i) => {
            const p = progress(frame, open + i * 6, 22);
            return (
              <div key={i} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 18, padding: "22px 22px 20px", opacity: p, transform: `translateY(${(1 - p) * 18}px)` }}>
                <Icon size={26} color={t.primary} />
                <div style={{ fontSize: 16, color: MUTED, marginTop: 12 }}>{label}</div>
                <div style={{ fontFamily: MANROPE, fontWeight: 700, fontSize: portrait ? 36 : 40, marginTop: 4 }}>{value}</div>
              </div>
            );
          })}
        </div>
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 18, marginTop: 22, padding: "24px 22px", opacity: progress(frame, open + 18, 22) }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontFamily: MANROPE, fontWeight: 600, fontSize: 20 }}>Revenue</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 17, fontWeight: 600, color: t.primary, opacity: ring }}>
              <RiArrowUpLine size={18} color={t.primary} /> 38%
            </div>
          </div>
          <svg width={chartW} height={chartH + 20} style={{ marginTop: 18, overflow: "visible" }}>
            {[0.25, 0.5, 0.75].map((y) => <line key={y} x1={0} x2={chartW} y1={y * chartH} y2={y * chartH} stroke={BORDER} strokeWidth={1} />)}
            <path d={`${d} L ${chartW} ${chartH} L 0 ${chartH} Z`} fill={rgba(t.primary, 0.1)} style={{ clipPath: `inset(0 ${100 - line * 100}% 0 0)` }} />
            <path d={d} fill="none" stroke={t.primary} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - line} />
            <circle cx={tip[0] * chartW} cy={tip[1] * chartH} r={8 + ring * 14} fill="none" stroke={t.accent} strokeWidth={3} opacity={ring} />
            <circle cx={tip[0] * chartW} cy={tip[1] * chartH} r={7} fill={t.primary} opacity={line >= 0.99 ? 1 : 0} />
          </svg>
        </div>
      </div>
    </div>
  );
};
