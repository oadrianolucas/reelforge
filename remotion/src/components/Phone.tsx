import { FONT } from "./fonts";

// Generic smartphone frame (iPhone style). The screen is drawn at 390x844 "points" and scaled.
export const SCREEN = { w: 390, h: 844 };

type Props = {
  scale: number; // px per point
  time?: string;
  screenBackground?: string;
  children: React.ReactNode;
};

export const Phone: React.FC<Props> = ({ scale, time = "9:41", screenBackground = "#0a0a0a", children }) => {
  const bezel = 14 * scale;
  const w = SCREEN.w * scale + bezel * 2;
  const h = SCREEN.h * scale + bezel * 2;
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 62 * scale,
        padding: bezel,
        background: "linear-gradient(145deg, #3a3a3c, #1c1c1e 40%, #2c2c2e)",
        boxShadow: `0 ${40 * scale}px ${90 * scale}px rgba(0,0,0,0.55), inset 0 0 0 ${2 * scale}px #4a4a4c`,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: SCREEN.w * scale,
          height: SCREEN.h * scale,
          borderRadius: 48 * scale,
          overflow: "hidden",
          position: "relative",
          background: screenBackground,
        }}
      >
        <div style={{ width: SCREEN.w, height: SCREEN.h, transform: `scale(${scale})`, transformOrigin: "0 0", position: "relative" }}>
          {children}
          {/* status bar + dynamic island */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 50,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "6px 30px 0 34px",
              fontFamily: FONT,
              fontWeight: 600,
              fontSize: 16,
              color: "#fff",
              pointerEvents: "none",
            }}
          >
            <span>{time}</span>
            <div style={{ position: "absolute", left: "50%", top: 11, transform: "translateX(-50%)", width: 120, height: 34, borderRadius: 20, background: "#000" }} />
            <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <Signal />
              <Battery />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const Signal = () => (
  <svg width="18" height="12" viewBox="0 0 18 12">
    {[0, 1, 2, 3].map((i) => (
      <rect key={i} x={i * 5} y={9 - i * 3} width="3.4" height={3 + i * 3} rx="1" fill="#fff" />
    ))}
  </svg>
);

const Battery = () => (
  <svg width="27" height="13" viewBox="0 0 27 13">
    <rect x="0.5" y="0.5" width="23" height="12" rx="3.5" fill="none" stroke="rgba(255,255,255,0.5)" />
    <rect x="2" y="2" width="17" height="9" rx="2" fill="#fff" />
    <rect x="24.5" y="4.5" width="2" height="4" rx="1" fill="rgba(255,255,255,0.5)" />
  </svg>
);
