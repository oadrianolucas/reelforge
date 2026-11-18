// Wall TV in a real room: photo of the place with motion (slow zoom + lateral drift, like a camera passing by),
// the TV turning on (white line opening, CRT effect) and a 16:9 offers flyer playing on the screen — the "in-store ad".
// Reusable: swap the room photo, the offers and the colors.
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { FONT, useU } from "./beats";

const ANTON = loadAnton("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;

// price is split as whole + cents so the cents can be drawn small (e.g. "4" + "99")
export type TvOffer = { img: string; name: string; whole: string; cents: string; unit?: string };

type Props = {
  room: string; // photo of the room (staticFile URL)
  offers: TvOffer[];
  label: string; // store name in the TV corner
  ticker: string; // text running on the bottom band
  framesPerOffer?: number;
  colors?: { background: string; highlight: string; text: string };
  square?: boolean;
  currency?: string; // symbol before the price
  decimalSeparator?: string;
};

export const WallTv: React.FC<Props> = ({ room, offers, label, ticker, framesPerOffer = 18, colors = { background: "#7a3e12", highlight: "#ffd200", text: "#fff" }, square, currency = "$", decimalSeparator = "." }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const u = useU();
  // room with motion
  const zoom = interpolate(frame, [0, durationInFrames], [1.08, 1.22]);
  const pan = interpolate(frame, [0, durationInFrames], [-2.5, 2.5]);
  // TV: enters and turns on
  const enter = spring({ frame, fps: 30, config: { damping: 14, stiffness: 160 } });
  const on = interpolate(frame, [4, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const tvW = (square ? 0.78 : 0.9) * width;
  const tvH = (tvW * 9) / 16;
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <Img src={room} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoom}) translateX(${pan}%)`, filter: "blur(2px) brightness(0.75)" }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 40%, transparent 30%, rgba(0,0,0,0.55) 100%)" }} />
      {/* TV */}
      <div style={{ position: "absolute", left: (width - tvW) / 2, top: (square ? 0.12 : 0.24) * height, width: tvW, height: tvH, transform: `translateY(${(1 - enter) * -200 * u}px) scale(${0.9 + 0.1 * enter})`, opacity: enter }}>
        {/* mount */}
        <div style={{ position: "absolute", left: "50%", top: -60 * u, width: 30 * u, height: 70 * u, marginLeft: -15 * u, background: "linear-gradient(90deg, #222, #555, #222)" }} />
        <div style={{ position: "absolute", inset: -14 * u, borderRadius: 18 * u, background: "linear-gradient(145deg, #2a2a2a, #0b0b0b)", boxShadow: `0 ${30 * u}px ${70 * u}px rgba(0,0,0,0.6), 0 0 ${80 * u}px rgba(255,190,90,${0.25 * on})` }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: 6 * u, overflow: "hidden", background: "#050505" }}>
          {/* CRT effect when turning on: horizontal line that opens */}
          <div style={{ position: "absolute", inset: 0, transform: `scaleY(${Math.max(0.01, on)}) scaleX(${0.3 + 0.7 * Math.min(1, on * 1.6)})`, filter: `brightness(${1 + (1 - on) * 3})` }}>
            <TvFlyer offers={offers} label={label} ticker={ticker} framesPerOffer={framesPerOffer} colors={colors} width={tvW} currency={currency} decimalSeparator={decimalSeparator} />
          </div>
          {/* glass reflection */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(120deg, rgba(255,255,255,0.12) 0%, transparent 35%, transparent 65%, rgba(255,255,255,0.05) 100%)", pointerEvents: "none" }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// 16:9 flyer drawn at 1600x900 and scaled to the width of the TV screen.
const TvFlyer: React.FC<{ offers: TvOffer[]; label: string; ticker: string; framesPerOffer: number; colors: { background: string; highlight: string; text: string }; width: number; currency: string; decimalSeparator: string }> = ({ offers, label, ticker, framesPerOffer, colors, width, currency, decimalSeparator }) => {
  const frame = useCurrentFrame();
  const sc = width / 1600;
  if (!offers.length) return null;
  const i = Math.floor(frame / framesPerOffer) % offers.length;
  const local = frame % framesPerOffer;
  const o = offers[i];
  const prod = spring({ frame: local + 2, fps: 30, config: { damping: 11, stiffness: 260 } });
  const price = spring({ frame: local - 2, fps: 30, config: { damping: 9, stiffness: 320 } });
  const wipe = interpolate(local, [0, 6], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div style={{ width: 1600, height: 900, transform: `scale(${sc})`, transformOrigin: "0 0", position: "relative", overflow: "hidden", fontFamily: FONT, background: colors.background }}>
      <div style={{ position: "absolute", inset: 0, background: `repeating-conic-gradient(rgba(255,255,255,0.08) 0deg 9deg, transparent 9deg 18deg)`, transform: `scale(2.4) rotate(${frame * 0.6}deg)` }} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 32% 50%, rgba(255,255,255,0.35), transparent 45%)", clipPath: `circle(${wipe * 120}% at 32% 50%)` }} />
      {/* product on a white plate */}
      <div style={{ position: "absolute", left: 140, top: 150, width: 560, height: 560, borderRadius: "50%", background: "radial-gradient(circle at 40% 35%, #ffffff, #efe9df)", boxShadow: "0 30px 60px rgba(0,0,0,0.35)", transform: `scale(${0.6 + 0.4 * prod})` }}>
        <Img src={staticFile(o.img)} style={{ position: "absolute", inset: 60, width: 440, height: 440, objectFit: "contain", mixBlendMode: "multiply", transform: `rotate(${(1 - Math.min(1, prod)) * -20}deg) scale(${prod})` }} />
      </div>
      {/* name + price */}
      <div style={{ position: "absolute", left: 780, top: 230, right: 80, color: colors.text }}>
        <div style={{ fontSize: 86, fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1, opacity: Math.min(1, prod * 1.5), transform: `translateX(${(1 - Math.min(1, prod)) * 80}px)` }}>{o.name}</div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 24, fontFamily: ANTON, color: colors.highlight, lineHeight: 0.9, transform: `scale(${price})`, transformOrigin: "left center", textShadow: "0 10px 0 rgba(0,0,0,0.45)" }}>
          <span style={{ fontSize: 80, marginTop: 34, color: colors.text }}>{currency}</span>
          <span style={{ fontSize: 300 }}>{o.whole}</span>
          <span style={{ display: "flex", flexDirection: "column", lineHeight: 0.9, marginTop: 24 }}>
            <span style={{ fontSize: 130 }}>{decimalSeparator}{o.cents}</span>
            {o.unit && <span style={{ fontFamily: FONT, fontWeight: 900, fontSize: 40, color: "#1a1a1a", background: colors.highlight, borderRadius: 10, padding: "4px 14px", marginTop: 16, textShadow: "none" }}>{o.unit}</span>}
          </span>
        </div>
      </div>
      {/* store label */}
      <div style={{ position: "absolute", left: 40, top: 30, background: colors.highlight, color: "#1a1a1a", fontWeight: 900, fontSize: 44, padding: "10px 26px", borderRadius: 14, transform: "rotate(-2deg)" }}>{label}</div>
      {/* running ticker */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 90, background: "#1a1a1a", overflow: "hidden", display: "flex", alignItems: "center" }}>
        <div style={{ whiteSpace: "nowrap", color: "#fff", fontWeight: 800, fontSize: 46, transform: `translateX(${-((frame * 9) % 1400)}px)` }}>
          {Array.from({ length: 4 }).map((_, k) => <span key={k} style={{ marginRight: 80 }}>{ticker}</span>)}
        </div>
      </div>
    </div>
  );
};
