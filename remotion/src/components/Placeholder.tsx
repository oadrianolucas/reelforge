import { AbsoluteFill } from "remotion";
import { FONT } from "./fonts";

// Shown when a template has no data yet (Studio opened with an empty public/ or a slug that was not prepared).
export const Placeholder: React.FC<{ title: string; hint: string }> = ({ title, hint }) => (
  <AbsoluteFill style={{ background: "#0b0c0f", color: "#eee", fontFamily: FONT, alignItems: "center", justifyContent: "center", textAlign: "center", padding: 80, gap: 24 }}>
    <div style={{ fontSize: 56, fontWeight: 700 }}>{title}</div>
    <div style={{ fontSize: 30, color: "#a3a3a3", lineHeight: 1.4, maxWidth: 900 }}>{hint}</div>
  </AbsoluteFill>
);
