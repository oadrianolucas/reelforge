import { AbsoluteFill, Easing, Img, OffthreadVideo, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import {
  RiChat3Line, RiCheckLine, RiCodeSSlashLine, RiFileTextLine, RiFlashlightLine, RiGithubLine, RiMailLine,
  RiRobot2Line, RiSearchLine, RiSparkling2Line, RiTerminalBoxLine, RiUser3Line, RiCalendarLine, RiBarChartBoxLine,
  type RemixiconComponentType,
} from "@remixicon/react";
import { Phone } from "../components/Phone";
import { PHONE_SCREENS } from "../components/screens";
import { Theme as BrandTheme, rgba } from "../components/theme";
import { Edl, Media, Theme, wordStart } from "./types";
import { fonts } from "./fonts";

const ICONS: Record<string, RemixiconComponentType> = {
  file: RiFileTextLine, email: RiMailLine, chat: RiChat3Line, ok: RiCheckLine, code: RiCodeSSlashLine,
  terminal: RiTerminalBoxLine, robot: RiRobot2Line, search: RiSearchLine, person: RiUser3Line, github: RiGithubLine,
  ai: RiSparkling2Line, bolt: RiFlashlightLine, calendar: RiCalendarLine, chart: RiBarChartBoxLine,
};

export const EXPO = Easing.bezier(0.16, 1, 0.3, 1);
const DEFAULT_ACCENT = "#e4f75a";
const isVideo = (p: string) => /\.(mp4|webm|mov)$/i.test(p);

// width/height = panel size (px): scales the graphics
type Props = { media: Media; slug: string; edl: Edl; theme: Theme; brand: BrandTheme; t0: number; paper?: boolean; width?: number; height?: number };

// absolute t (on the cut) from the frame inside the Sequence that starts at t0
const useT = (t0: number) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return t0 + f / fps;
};

// soft entrance: rises 24 px, blur → focus, opacity (the "elegant fade" of the references)
const entrance = (t: number, t1: number, dur = 0.45) => {
  const p = interpolate(t, [t1, t1 + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EXPO });
  return { opacity: p, transform: `translateY(${(1 - p) * 24}px)`, filter: `blur(${(1 - p) * 8}px)` };
};

export const MediaPanel: React.FC<Props> = ({ media, slug, edl, theme, brand, t0, paper, width = 1080, height = 960 }) => {
  const t = useT(t0);
  const u = Math.min(1.4, width / 1080);
  const F = fonts(theme);
  const ink = paper ? theme.ink : theme.light;
  const src = (p: string) => staticFile(`${slug}/${p}`);
  const dur = 6; // slow zoom: reference duration for the Ken Burns

  if (typeof media === "string") {
    const s = interpolate(t - t0, [0, dur], [1.0, 1.06], { extrapolateRight: "clamp" });
    const style: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", transform: `scale(${s})` };
    return (
      <AbsoluteFill style={{ overflow: "hidden" }}>
        {isVideo(media) ? <OffthreadVideo src={src(media)} muted style={style} /> : <Img src={src(media)} style={style} />}
      </AbsoluteFill>
    );
  }

  if ("screenshot" in media) {
    const [z0, z1] = media.zoom ?? [1.0, 1.08];
    const s = interpolate(t - t0, [0, dur], [z0, z1], { extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) });
    const framed = media.frame ?? true;
    return (
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: framed ? "6%" : 0, overflow: "hidden" }}>
        <div style={{
          width: "100%", height: "100%", borderRadius: framed ? 18 : 0, overflow: "hidden",
          boxShadow: framed ? "0 30px 80px rgba(0,0,0,0.35), 0 4px 14px rgba(0,0,0,0.25)" : undefined,
          border: framed ? `1px solid ${paper ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.10)"}` : undefined,
        }}>
          <Img src={src(media.screenshot)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: media.focus ?? "50% 0%", transform: `scale(${s})`, transformOrigin: media.focus ?? "50% 0%" }} />
        </div>
      </AbsoluteFill>
    );
  }

  if ("diagram" in media) {
    const { root, items, done } = media.diagram;
    const tDone = done !== undefined ? wordStart(edl, done) : Infinity;
    const lineColor = paper ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.35)";
    const n = items.length;
    return (
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily: F.mono, color: ink }}>
        <div style={{ position: "relative", width: "88%", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ ...entrance(t, t0), padding: `${10 * u}px ${22 * u}px`, border: `2px solid ${theme.accent}`, borderRadius: 10, color: theme.accent, fontSize: 44 * u, fontWeight: 500 }}>
            {root}
          </div>
          {/* trunk + horizontal bar */}
          <div style={{ width: 2 * u, height: 46 * u, background: lineColor, opacity: entrance(t, t0 + 0.15).opacity }} />
          <div style={{ position: "relative", width: `${(100 * (n - 1)) / n}%`, height: 2 * u, background: lineColor, transformOrigin: "50% 50%",
            transform: `scaleX(${interpolate(t, [t0 + 0.2, t0 + 0.6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EXPO })})` }} />
          <div style={{ display: "flex", width: "100%" }}>
            {items.map((it, k) => {
              const ti = wordStart(edl, it.word);
              const Ic = ICONS[it.icon ?? "file"] ?? RiFileTextLine;
              const pDone = spring({ frame: Math.round((t - tDone - k * 0.12) * 30), fps: 30, config: { damping: 12, stiffness: 200 } });
              return (
                <div key={k} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: 2 * u, height: 40 * u, background: lineColor, opacity: t >= ti ? 1 : 0.25 }} />
                  <div style={{ ...entrance(t, ti), position: "relative", width: "78%", aspectRatio: "1 / 1.05", borderRadius: 16,
                    background: paper ? "#fff" : "rgba(255,255,255,0.05)", border: `1px solid ${paper ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.14)"}`,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 * u }}>
                    <Ic size={64 * u} color={ink} />
                    <div style={{ fontSize: 30 * u, fontWeight: 500 }}>{it.text}</div>
                    {it.sub && <div style={{ fontSize: 20 * u, opacity: 0.55 }}>{it.sub}</div>}
                    {t >= tDone && (
                      <div style={{ position: "absolute", top: -16, right: -16, width: 40 * u, height: 40 * u, borderRadius: 20, background: "#22c55e",
                        display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${pDone})` }}>
                        <RiCheckLine size={26 * u} color="#fff" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  if ("steps" in media) {
    const { items, center } = media.steps;
    return (
      <AbsoluteFill style={{ fontFamily: F.sans, color: ink }}>
        <div style={{ position: "absolute", top: "12%", left: "6%", right: "6%", display: "flex", justifyContent: "space-between" }}>
          {items.map((it, k) => {
            const ti = wordStart(edl, it.word);
            return (
              <div key={k} style={{ ...entrance(t, ti), display: "flex", alignItems: "center", gap: 14 * u, width: `${88 / items.length}%` }}>
                <div style={{ flex: "none", width: 52 * u, height: 52 * u, borderRadius: 26, background: ink, color: paper ? theme.paper : theme.dark,
                  display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 28 * u }}>{k + 1}</div>
                <div style={{ fontWeight: 600, fontSize: 28 * u, lineHeight: 1.15 }}>{it.text}</div>
              </div>
            );
          })}
        </div>
        {/* dashed line from each step down to the center */}
        <svg style={{ position: "absolute", inset: 0 }} viewBox="0 0 1000 1000" preserveAspectRatio="none">
          {items.map((it, k) => {
            const x = 60 + (880 / items.length) * (k + 0.15);
            const p = interpolate(t, [wordStart(edl, it.word) + 0.1, wordStart(edl, it.word) + 0.7], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EXPO });
            const d = `M ${x} 200 L ${x} 330 L 500 330 L 500 380`;
            return <path key={k} d={d} fill="none" stroke={ink} strokeOpacity={0.55} strokeWidth={2} strokeDasharray="6 6" pathLength={1} style={{ strokeDasharray: `${p} 1` }} />;
          })}
        </svg>
        {center && (
          <div style={{ ...entrance(t, t0), position: "absolute", left: "30%", right: "30%", top: "40%", bottom: 0 }}>
            <Img src={src(center)} style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "50% 100%", filter: "drop-shadow(0 20px 30px rgba(0,0,0,0.18))" }} />
          </div>
        )}
      </AbsoluteFill>
    );
  }

  if ("canvas" in media) {
    const { items, title } = media.canvas;
    const n = items.length;
    return (
      <AbsoluteFill style={{ fontFamily: F.sans, color: ink, alignItems: "center", justifyContent: "flex-end" }}>
        {title && (
          <div style={{ ...entrance(t, wordStart(edl, title.word)), position: "absolute", top: "14%", fontWeight: 700, fontSize: 64 * u, letterSpacing: "-0.02em" }}>
            {title.text}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", width: "92%", height: "70%" }}>
          {items.map((it, k) => {
            const ti = wordStart(edl, it.word);
            const p = interpolate(t, [ti, ti + 0.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EXPO });
            return (
              <div key={k} style={{ position: "relative", flex: `0 0 ${Math.min(34, 100 / n + 6)}%`, marginLeft: k ? `-${Math.min(6, 18 / n)}%` : 0, height: "100%",
                opacity: p, transform: `translateY(${(1 - p) * 40}px) scale(${0.96 + 0.04 * p})`, filter: `blur(${(1 - p) * 10}px)`, zIndex: k }}>
                {it.label && <div style={{ position: "absolute", top: -48, left: 0, right: 0, textAlign: "center", fontWeight: 600, fontSize: 26 * u }}>{it.label}</div>}
                <Img src={src(it.img)} style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "50% 100%",
                  filter: "drop-shadow(0 24px 30px rgba(0,0,0,0.20)) drop-shadow(0 3px 6px rgba(0,0,0,0.12))" }} />
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    );
  }

  if ("list" in media) {
    const { title, items } = media.list;
    const size = (items.length <= 4 ? 54 : 40) * u; // short list: bigger type (the panel has room)
    return (
      <AbsoluteFill style={{ fontFamily: F.sans, color: ink, justifyContent: "center", padding: "0 9%" }}>
        {title && <div style={{ ...entrance(t, t0), fontFamily: F.serif, fontSize: 72 * u, lineHeight: 1.05, marginBottom: 36 * u }}>{title}</div>}
        {items.map((it, k) => {
          const ti = wordStart(edl, it.word);
          const Ic = it.ok === false ? null : RiCheckLine;
          return (
            <div key={k} style={{ ...entrance(t, ti), display: "flex", alignItems: "center", gap: 20 * u, padding: `${18 * u}px 0`,
              borderTop: `1px solid ${paper ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.12)"}`, fontSize: size, fontWeight: 500 }}>
              {Ic && <Ic size={size} color={theme.accent === DEFAULT_ACCENT && paper ? ink : theme.accent} />}
              {it.text}
            </div>
          );
        })}
      </AbsoluteFill>
    );
  }

  // App screen in a phone rising from the bottom of the panel. Times in props are seconds since the block entered.
  // Scale: in the wide panel (9:16, top half) the phone runs past the bottom edge — what matters is at the top of the screen.
  const Screen = PHONE_SCREENS[media.ui];
  const e = Math.min((width * 0.62) / 418, (height * 1.25) / 872);
  const rise = interpolate(t - t0, [0, 0.6], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EXPO });
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 50% at 50% 45%, ${rgba(brand.accent, 0.22)}, transparent 70%), ${brand.background}` }}>
      <div style={{ position: "absolute", left: "50%", top: height * 0.07, transform: `translateX(-50%) translateY(${rise * height * 0.6}px)` }}>
        <Phone scale={e}>
          {Screen ? (
            <Screen theme={brand} icon={src("favicon.svg")} duration={6} {...(media.props ?? {})} />
          ) : (
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#fff", fontFamily: F.sans, fontSize: 18, padding: 30, textAlign: "center" }}>screen "{media.ui}" is not registered in components/screens</div>
          )}
        </Phone>
      </div>
    </AbsoluteFill>
  );
};
