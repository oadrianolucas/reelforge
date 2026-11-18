import { Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { RiCheckLine } from "@remixicon/react";
import { FONT } from "../fonts";
import { rgba } from "../theme";
import type { PhoneScreenProps } from "./types";

// Generic order tracking screen: progress ring counting down, the item, and the steps checking one by one.
// Extra props (all optional): title ("Your order"), item ("Flat white"), place (pickup place), eta (minutes, default 4),
// etaLabel ("min"), steps: string[] (default Received / Preparing / Ready).
export const OrderStatus: React.FC<PhoneScreenProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const { theme } = p;
  const steps = (p.steps as string[] | undefined) ?? ["Received", "Preparing", "Ready"];
  const eta = (p.eta as number | undefined) ?? 4;
  const dur = Math.max(1, p.duration);
  const prog = interpolate(t, [0.2, dur * 0.85], [0.15, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const minutes = Math.max(0, Math.ceil(eta * (1 - prog)));
  const done = Math.min(steps.length, Math.floor(prog * steps.length + 0.35));
  const enter = (d: number) => spring({ frame: frame - d, fps, config: { damping: 18, stiffness: 160 } });
  const R = 92;
  const C = 2 * Math.PI * R;
  const line = rgba(theme.text.startsWith("#") ? theme.text : "#ffffff", 0.08);
  return (
    <div style={{ position: "absolute", inset: 0, background: theme.background, color: theme.text, fontFamily: FONT, padding: "62px 22px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {p.icon ? <Img src={p.icon} style={{ width: 30, height: 30, borderRadius: 8 }} /> : <div style={{ width: 30, height: 30, borderRadius: 9, background: `linear-gradient(140deg, ${theme.highlight}, ${theme.accent})` }} />}
        <div style={{ fontWeight: 700, fontSize: 18 }}>{(p.title as string) ?? "Your order"}</div>
      </div>
      <div style={{ display: "grid", placeItems: "center", marginTop: 34, opacity: enter(0), transform: `scale(${0.9 + 0.1 * enter(0)})` }}>
        <svg width={230} height={230} viewBox="0 0 230 230">
          <circle cx={115} cy={115} r={R} fill="none" stroke={theme.surface} strokeWidth={16} />
          <circle cx={115} cy={115} r={R} fill="none" stroke={theme.accent} strokeWidth={16} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - prog)} transform="rotate(-90 115 115)" />
        </svg>
        <div style={{ position: "absolute", textAlign: "center" }}>
          <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{minutes === 0 ? "Ready" : minutes}</div>
          {minutes > 0 && <div style={{ fontSize: 15, color: theme.textDim, fontWeight: 600 }}>{(p.etaLabel as string) ?? "min"}</div>}
        </div>
      </div>
      <div style={{ textAlign: "center", marginTop: 18, opacity: enter(4) }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>{(p.item as string) ?? "Flat white"}</div>
        <div style={{ fontSize: 14, color: theme.textDim, marginTop: 4 }}>{(p.place as string) ?? p.store?.name ?? "Pickup at the counter"}</div>
      </div>
      <div style={{ marginTop: 30, background: theme.surface, borderRadius: 20, padding: "6px 18px", border: `1px solid ${line}` }}>
        {steps.map((s, i) => {
          const ok = i < done;
          const g = enter(8 + i * 3);
          return (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: i < steps.length - 1 ? `1px solid ${line}` : undefined, opacity: g }}>
              <div style={{ width: 28, height: 28, borderRadius: 14, display: "grid", placeItems: "center", background: ok ? theme.accent : "transparent", border: ok ? "none" : `2px solid ${theme.textDim}` }}>
                {ok && <RiCheckLine size={18} color="#fff" />}
              </div>
              <div style={{ fontSize: 16, fontWeight: ok ? 700 : 500, color: ok ? theme.text : theme.textDim }}>{s}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
