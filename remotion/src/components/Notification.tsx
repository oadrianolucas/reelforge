import { Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT } from "./fonts";

type Props = {
  icon: string; // URL (staticFile) of the app icon
  app: string;
  title: string;
  text: string;
  duration: number; // frames visible (includes enter and exit)
  top?: number;
  timeLabel?: string; // the "now" in the corner
};

// iOS-style notification banner, sliding down from the top of the video frame.
export const Notification: React.FC<Props> = ({ icon, app, title, text, duration, top = 110, timeLabel = "now" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 15, stiffness: 160 } });
  const exit = interpolate(frame, [duration - 8, duration], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(enter, [0, 1], [-260, 0]) - exit * 300;

  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 44,
        right: 44,
        transform: `translateY(${y}px) scale(${interpolate(enter, [0, 1], [0.92, 1])})`,
        opacity: 1 - exit,
        display: "flex",
        gap: 26,
        alignItems: "center",
        padding: "28px 32px",
        borderRadius: 48,
        background: "rgba(245, 245, 247, 0.82)",
        backdropFilter: "blur(30px) saturate(1.6)",
        boxShadow: "0 24px 60px rgba(0,0,0,0.30)",
        fontFamily: FONT,
        color: "#111",
      }}
    >
      <Img src={icon} style={{ width: 96, height: 96, borderRadius: 24, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 30, color: "#555", fontWeight: 500 }}>
          <span style={{ textTransform: "uppercase", letterSpacing: "0.02em" }}>{app}</span>
          <span>{timeLabel}</span>
        </div>
        <div style={{ fontSize: 38, fontWeight: 700, marginTop: 4 }}>{title}</div>
        <div style={{ fontSize: 34, fontWeight: 400, marginTop: 2, color: "#222", lineHeight: 1.25 }}>{text}</div>
      </div>
    </div>
  );
};
