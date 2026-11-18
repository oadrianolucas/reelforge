import {
  AbsoluteFill, Audio, CalculateMetadataFunction, Easing, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig,
} from "remotion";
import { Block, DEFAULT_THEME, DIMENSIONS, Edit, Edl, Format, Theme, wordEnd, wordStart } from "./types";
import { EXPO, MediaPanel } from "./Media";
import { RecordedCaptions } from "./RecordedCaptions";
import { fonts } from "./fonts";
import { EndCard, accented } from "../components/EndCard";
import { Placeholder } from "../components/Placeholder";
import { FPS, PLACEHOLDER_SECONDS } from "../components/formats";
import { fetchJson, withTheme } from "../components/theme";
import { pulseOnBeat } from "../motion/beats";

// Template of the "recorded" style — see .claude/skills/recorded/SKILL.md. Reads public/<slug>/edl.json
// (scripts/recording.py), public/<slug>/edit.json (what happens on each word) and public/<slug>/cut.mp4. A single
// <OffthreadVideo> carries your voice: the blocks only change the rectangle where you appear, so audio and lipsync never move.

type Props = { slug: string; format: Format; edl?: Edl; edit?: Edit; onsets?: number[] };

export const calculateRecordedMetadata: CalculateMetadataFunction<Props> = async ({ props }) => {
  const [width, height] = DIMENSIONS[props.format];
  const edl = props.slug ? await fetchJson<Edl>(staticFile(`${props.slug}/edl.json`)) : null;
  if (!edl) return { durationInFrames: PLACEHOLDER_SECONDS * FPS, width, height, props };
  const edit = (await fetchJson<Edit>(staticFile(`${props.slug}/edit.json`))) ?? {};
  const card = edit.endCard ? edit.endCard.seconds ?? 2.2 : 0;
  const beats = edit.rhythm?.beats ? await fetchJson<{ onsets: number[] }>(staticFile(edit.rhythm.beats)) : null;
  return { durationInFrames: Math.ceil((edl.duration + card) * edl.fps), fps: edl.fps, width, height, props: { ...props, edl, edit, onsets: beats?.onsets ?? [] } };
};

const TR = 0.45; // soft transition (s); with `rhythm`, TR_FAST
const TR_FAST = 0.25;
type Rect = { x: number; y: number; w: number; h: number };
const mix = (a: Rect, b: Rect, p: number): Rect => ({ x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, w: a.w + (b.w - a.w) * p, h: a.h + (b.h - a.h) * p });

// window of a block in seconds of the cut
const windowOf = (edl: Edl, b: Block): [number, number] => {
  if (b.type === "split" || b.type === "full") return [wordStart(edl, b.from) - 0.1, wordEnd(edl, b.to) + 0.15];
  if (b.type === "title") return [wordStart(edl, b.word) - 0.05, wordStart(edl, b.word) + (b.seconds ?? 1.8)];
  return [wordStart(edl, b.word) - 0.1, wordStart(edl, b.word) + (b.seconds ?? 2.4)];
};
// 0 → 1 on enter, 1 → 0 on exit
const presence = (t: number, [a, b]: [number, number], tr = TR) =>
  Math.min(
    interpolate(t, [a, a + tr], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EXPO }),
    interpolate(t, [b - tr * 0.8, b], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) }),
  );

// side of the MEDIA on the split screen. The `side` in edit.json applies to 9:16; in the other formats the split is
// always side by side (top/bottom halves of a square cut the face), with the media on the right unless "left".
const mediaSide = (b: Extract<Block, { type: "split" }>, format: Format) =>
  format === "9:16" ? b.side ?? "top" : b.side === "left" ? "left" : "right";

// text with *accent*: words between asterisks come out in the accent color
const Accented: React.FC<{ text: string; accent: string; t: number; t1: number }> = ({ text, accent, t, t1 }) => (
  <>
    {text.split(/(\*[^*]+\*)/).filter(Boolean).flatMap((part, k) => {
      const ac = part.startsWith("*");
      return part.replace(/\*/g, "").split(" ").filter(Boolean).map((w, j) => {
        const p = interpolate(t, [t1 + (k * 2 + j) * 0.06, t1 + (k * 2 + j) * 0.06 + 0.4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EXPO });
        return (
          <span key={`${k}-${j}`} style={{ display: "inline-block", marginRight: "0.25em", color: ac ? accent : undefined, opacity: p,
            transform: `translateY(${(1 - p) * 0.25}em)`, filter: `blur(${(1 - p) * 6}px)` }}>{w}</span>
        );
      });
    })}
  </>
);

export const Recorded: React.FC<Props> = ({ slug, format, edl, edit = {}, onsets = [] }) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  if (!edl) return <Placeholder title="Recorded" hint={`No data: run scripts/prepare.py so public/${slug || "<slug>"}/ has edl.json, edit.json and cut.mp4.`} />;
  const t = frame / fps;
  const theme: Theme = { ...DEFAULT_THEME, ...edit.theme };
  const brand = withTheme({ background: theme.dark, accent: theme.accent, highlight: theme.accent, ...edit.brand });
  const F = fonts(theme);
  const blocks = edit.blocks ?? [];
  const vertical = format !== "16:9";
  const rhythm = edit.rhythm;
  const tr0 = rhythm ? TR_FAST : TR;

  // ── where you appear: full screen, or half when a "split" block is active
  const full: Rect = { x: 0, y: 0, w: W, h: H };
  let rect = full;
  let panel: { b: Extract<Block, { type: "split" }>; r: Rect; p: number } | null = null;
  for (const b of blocks) {
    if (b.type !== "split") continue;
    const p = presence(t, windowOf(edl, b), tr0);
    if (p <= 0) continue;
    const side = mediaSide(b, format);
    const half = 0.5;
    const you: Rect = side === "top" ? { x: 0, y: H * half, w: W, h: H * (1 - half) }
      : side === "bottom" ? { x: 0, y: 0, w: W, h: H * half }
      : side === "right" ? { x: 0, y: 0, w: W * 0.5, h: H } : { x: W * 0.5, y: 0, w: W * 0.5, h: H };
    const media: Rect = side === "top" ? { x: 0, y: 0, w: W, h: H * half } : side === "bottom" ? { x: 0, y: H * half, w: W, h: H * (1 - half) }
      : side === "right" ? { x: W * 0.5, y: 0, w: W * 0.5, h: H } : { x: 0, y: 0, w: W * 0.5, h: H };
    rect = mix(full, you, p);
    panel = { b, r: media, p };
  }

  // ── camera: base zoom alternating per segment (hides the jump cut) + slow push and punches, always forward in the segment
  const cam = edit.camera ?? {};
  const [z0, z1] = cam.alternate ?? [1.0, 1.08];
  const k = Math.max(0, edl.segments.findIndex((sg) => t >= sg.start && t < sg.end));
  const seg = edl.segments[k] ?? edl.segments[edl.segments.length - 1];
  let zoom = (k % 2 ? z1 : z0) + (cam.push ?? 0.025) * interpolate(t, [seg.start, seg.end], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  let rot = 0, dx = 0, dy = 0;
  const punches = [...(edit.punches ?? []), ...(rhythm?.autoPunches ? (edit.captions?.highlights ?? []).map((word) => ({ word, zoom: 0.08 })) : [])];
  for (const pu of punches) {
    const ts = wordStart(edl, pu.word);
    if (ts >= seg.start && ts < seg.end && t >= ts - 0.04) zoom += (pu.zoom ?? 0.08) * interpolate(t, [ts - 0.04, ts + 0.22], [0, 1], { extrapolateRight: "clamp", easing: EXPO });
    // short shake (~0.15 s) with a slight tilt alternating sides: only in the rhythm version
    if (rhythm && t >= ts - 0.02 && t < ts + 0.18) {
      const d = 1 - (t - ts + 0.02) / 0.2;
      const side = pu.word % 2 ? 1 : -1;
      rot += side * 1.5 * d;
      dx += Math.sin(t * 90) * 10 * d;
      dy += Math.cos(t * 77) * 8 * d;
    }
  }
  if (rhythm) {
    // jolt on the cut: enters 6% closer and settles in 0.25 s
    zoom += (rhythm.snap ?? 0.06) * interpolate(t, [seg.start, seg.start + 0.25], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
    if (onsets.length) zoom += (rhythm.pulse ?? 0.015) * pulseOnBeat(t + (edit.music?.start ?? 0), onsets);
  }
  const focus = cam.focus ?? "50% 35%";

  const sfx = edit.sfx ?? true;
  const sfxVol = typeof sfx === "object" ? sfx : {};
  const entrances = blocks.map((b) => windowOf(edl, b)[0]);
  const videoEnd = Math.round(edl.duration * fps);
  const card = edit.endCard;

  // captions: in 9:16 at chest height; with the media on top they drop to the foot of your half (below the mouth)
  const pSplit = panel?.p ?? 0;
  const capY = format === "9:16" ? interpolate(pSplit, [0, 1], [H * 0.74, H * 0.915]) : H * (format === "1:1" ? 0.8 : format === "4:5" ? 0.82 : 0.86);

  return (
    <AbsoluteFill style={{ background: theme.dark }}>
      {/* you */}
      <Sequence durationInFrames={videoEnd}>
        <div style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h, overflow: "hidden" }}>
          <OffthreadVideo src={staticFile(`${slug}/cut.mp4`)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: focus,
            transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${zoom})`, transformOrigin: focus }} />
        </div>
      </Sequence>

      {/* split-screen panel */}
      {blocks.map((b, i) => {
        if (b.type !== "split") return null;
        const [a, z] = windowOf(edl, b);
        const side = mediaSide(b, format);
        const r: Rect = side === "top" ? { x: 0, y: 0, w: W, h: H / 2 } : side === "bottom" ? { x: 0, y: H / 2, w: W, h: H / 2 }
          : side === "right" ? { x: W / 2, y: 0, w: W / 2, h: H } : { x: 0, y: 0, w: W / 2, h: H };
        const p = presence(t, [a, z], tr0);
        const paper = b.background === "paper";
        // with rhythm: the panel slides in from off-screen with an overshoot and a short flash, no blur
        const slideIn = rhythm ? interpolate(t, [a, a + 0.32], [-1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(1.6)) }) : 0;
        const slideOut = rhythm ? interpolate(t, [z - 0.2, z], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) }) : 0;
        const vertSlide = side === "top" || side === "bottom";
        const off = (slideIn - slideOut) * (vertSlide ? r.h : r.w) * (side === "bottom" || side === "right" ? -1 : 1);
        const flash = rhythm ? interpolate(t, [a + 0.05, a + 0.2], [0.5, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
        return (
          <Sequence key={i} from={Math.round(a * fps)} durationInFrames={Math.max(1, Math.round((z - a) * fps))}>
            <div style={{ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, overflow: "hidden", background: paper ? theme.paper : theme.dark,
              ...(rhythm ? { transform: vertSlide ? `translateY(${off}px)` : `translateX(${off}px)` } : { opacity: p, filter: `blur(${(1 - p) * 10}px)` }) }}>
              <MediaPanel media={b.media} slug={slug} edl={edl} theme={theme} brand={brand} t0={a} paper={paper} width={r.w} height={r.h} />
              {b.label && <div style={{ position: "absolute", left: 28, bottom: 22, fontFamily: F.sans, fontSize: 24, fontWeight: 500, letterSpacing: "0.04em",
                textTransform: "uppercase", color: paper ? theme.ink : theme.light, opacity: 0.7 }}>{b.label}</div>}
              {flash > 0 && <AbsoluteFill style={{ background: "#fff", opacity: flash }} />}
            </div>
          </Sequence>
        );
      })}

      {/* full-screen media and chapters */}
      {blocks.map((b, i) => {
        if (b.type !== "full" && b.type !== "chapter") return null;
        const [a, z] = windowOf(edl, b);
        const p = presence(t, [a, z], tr0);
        const paper = b.type === "full" && b.background === "paper";
        return (
          <Sequence key={i} from={Math.round(a * fps)} durationInFrames={Math.max(1, Math.round((z - a) * fps))}>
            <AbsoluteFill style={{ background: paper ? theme.paper : theme.dark, opacity: p, filter: `blur(${(1 - p) * 14}px)`, transform: `scale(${1.03 - 0.03 * p})` }}>
              {b.media && <MediaPanel media={b.media} slug={slug} edl={edl} theme={theme} brand={brand} t0={a} paper={paper} width={W} height={H} />}
              {b.type === "chapter" && (
                <AbsoluteFill style={{ background: b.media ? "rgba(0,0,0,0.45)" : undefined, alignItems: "center", justifyContent: "center", textAlign: "center" }}>
                  <div style={{ position: "relative" }}>
                    <div style={{ fontFamily: F.serif, fontSize: W * (vertical ? 0.2 : 0.13), lineHeight: 1, color: theme.accent, opacity: 0.9 }}>
                      {b.label ?? "Chapter"} {b.number}
                    </div>
                    <div style={{ position: "absolute", left: 0, right: 0, top: "50%", transform: "translateY(-50%)", fontFamily: F.sans, fontWeight: 600,
                      fontSize: W * (vertical ? 0.06 : 0.035), color: "#fff", textShadow: "0 4px 24px rgba(0,0,0,0.5)" }}>
                      <Accented text={b.title} accent={theme.accent} t={t} t1={a + 0.25} />
                    </div>
                  </div>
                </AbsoluteFill>
              )}
              {b.type === "full" && b.label && <div style={{ position: "absolute", left: 36, top: 36, fontFamily: F.sans, fontSize: 26, fontWeight: 500,
                letterSpacing: "0.04em", textTransform: "uppercase", color: paper ? theme.ink : theme.light, opacity: 0.75 }}>{b.label}</div>}
            </AbsoluteFill>
          </Sequence>
        );
      })}

      {/* titles */}
      {blocks.map((b, i) => {
        if (b.type !== "title") return null;
        const [a, z] = windowOf(edl, b);
        if (t < a || t > z) return null;
        const out = interpolate(t, [z - 0.3, z], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const font = b.font ?? "serif";
        const size = b.size ?? W * (font === "serif" ? (vertical ? 0.13 : 0.08) : vertical ? 0.085 : 0.055);
        const pos = b.position ?? "top";
        const top = pos === "top" ? H * 0.16 : pos === "center" ? H * 0.5 : H * 0.62;
        // with rhythm: the whole title pops (spring) instead of appearing word by word with blur
        const pop = rhythm ? spring({ frame: frame - Math.round(a * fps), fps, config: { damping: 11, stiffness: 260 } }) : 1;
        return (
          <div key={i} style={{ position: "absolute", left: W * 0.06, right: W * 0.06, top, transform: `translateY(-50%) scale(${rhythm ? 0.4 + 0.6 * pop : 1})`, textAlign: "center", opacity: out,
            fontFamily: F[font], fontWeight: font === "serif" ? 400 : 700, fontSize: size, lineHeight: 1.0, letterSpacing: font === "sans" ? "-0.02em" : 0,
            textTransform: font === "sans" ? "uppercase" : undefined, color: "#fff", textShadow: "0 6px 30px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.35)" }}>
            {rhythm ? b.text.split(/(\*[^*]+\*)/).filter(Boolean).map((part, k) =>
              <span key={k} style={{ color: part.startsWith("*") ? theme.accent : undefined }}>{part.replace(/\*/g, "")}</span>)
              : <Accented text={b.text} accent={theme.accent} t={t} t1={a} />}
          </div>
        );
      })}

      {/* captions, centered on your part of the screen */}
      {t < edl.duration && edit.captions?.style !== "none" && (
        <div style={{ position: "absolute", left: rect.x, width: rect.w, top: 0, height: H }}>
          <RecordedCaptions edl={edl} cfg={edit.captions ?? {}} theme={theme} y={capY} width={rect.w} />
        </div>
      )}

      {/* end card */}
      {card?.branded && (
        <Sequence from={videoEnd}>
          <EndCard theme={brand} logo={staticFile(`${slug}/logo.svg`)} subtitle={card.sub} cta={card.cta} title={accented(card.text, brand.highlight)} />
        </Sequence>
      )}
      {card && !card.branded && (
        <Sequence from={videoEnd - Math.round(TR * fps)}>
          <AbsoluteFill style={{ background: theme.paper, alignItems: "center", justifyContent: "center", textAlign: "center", padding: W * 0.08,
            opacity: interpolate(frame - videoEnd, [-TR * fps, 0], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
            <div style={{ fontFamily: F.serif, fontSize: W * (vertical ? 0.1 : 0.06), lineHeight: 1.05, color: theme.ink }}>
              <Accented text={card.text} accent={theme.ink} t={t} t1={edl.duration} />
            </div>
            {card.sub && <div style={{ marginTop: 28, fontFamily: F.mono, fontSize: W * (vertical ? 0.035 : 0.02), color: theme.ink, opacity: 0.6 }}>{card.sub}</div>}
          </AbsoluteFill>
        </Sequence>
      )}

      {/* sound: low music under the voice (final loudness is fixed by scripts/check.py) + discreet whoosh on entrances */}
      {edit.music && (
        <Audio src={staticFile(edit.music.file)} startFrom={Math.round((edit.music.start ?? 0) * fps)} loop
          volume={(f) => (edit.music!.volume ?? 0.08) * interpolate(f, [0, fps, (edl.duration + (card?.seconds ?? 0)) * fps - fps, (edl.duration + (card?.seconds ?? 0)) * fps], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      )}
      {sfx && entrances.map((a, i) => (
        <Sequence key={`s${i}`} from={Math.max(0, Math.round((a - 0.12) * fps))} durationInFrames={Math.round(1.2 * fps)}>
          <Audio src={staticFile("library/sfx/whoosh.mp3")} volume={(blocks[i].type === "title" ? 0.1 : 0.16) * (sfxVol.whoosh ?? 1)} />
        </Sequence>
      ))}
      {sfx && sfxVol.pop && blocks.map((b, i) => b.type !== "title" ? null : (
        <Sequence key={`p${i}`} from={Math.max(0, Math.round(entrances[i] * fps))} durationInFrames={Math.round(0.8 * fps)}>
          <Audio src={staticFile("library/sfx/pop.mp3")} volume={sfxVol.pop} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
