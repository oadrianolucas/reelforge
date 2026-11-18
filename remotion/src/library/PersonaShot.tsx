import { AbsoluteFill, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { fetchJson } from "../components/theme";

// Reusable shots of the library personas (library/personas/<id>/shots.json, mirrored to remotion/public/library/).
// Each shot is a clean stretch of a clip that was already paid for: reusing it across many ads costs nothing.
//   shots.json = { "persona": "<id>", "note"?: "...", "shots": [{ "id", "clip", "start", "end", "action", "framing"? }] }
//   clip = path relative to library/personas/<id>/ ; start/end = seconds of the clean stretch.
export type Shot = { id: string; clip: string; start: number; end: number; action?: string; framing?: string };
export type ShotsByPersona = Record<string, Shot[]>;

/** Loads library/personas/<id>/shots.json for each persona (missing file → empty list). Use it in calculateMetadata. */
export async function loadShots(personas: string[]): Promise<ShotsByPersona> {
  const out: ShotsByPersona = {};
  for (const id of Array.from(new Set(personas.filter(Boolean)))) {
    const j = await fetchJson<{ shots?: Shot[] }>(staticFile(`library/personas/${id}/shots.json`));
    out[id] = j?.shots ?? [];
  }
  return out;
}

/** "shot" or "persona:shot" → the shot, with `clip` as a path inside public/. Throws with a helpful message. */
export function findShot(shots: ShotsByPersona, defaultPersona: string, ref: string): Shot {
  const [persona, id] = ref.includes(":") ? ref.split(":") : [defaultPersona, ref];
  const s = shots[persona]?.find((x) => x.id === id);
  if (!s) throw new Error(`shot "${id}" does not exist for persona "${persona}" — see library/personas/${persona}/shots.json`);
  return { ...s, clip: `library/personas/${persona}/${s.clip}` };
}

type Props = {
  shot: Shot; // from findShot()
  focus?: string; // object-position (e.g. "50% 35%" to keep the face in the 1:1)
  zoom?: [number, number]; // light push-in during the Sequence
  speed?: number;
};

// Shows one persona shot inside a <Sequence>. If the Sequence is longer than the shot, the video keeps playing past
// `end` (into the part that may have AI artifacts) — prefer Sequences the length of the shot (or use speed < 1).
export const PersonaShot: React.FC<Props> = ({ shot, focus = "50% 50%", zoom = [1.0, 1.06], speed = 1 }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const s = interpolate(frame, [0, durationInFrames], zoom);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <OffthreadVideo
        src={staticFile(shot.clip)}
        startFrom={Math.round(shot.start * fps)}
        playbackRate={speed}
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: focus, transformOrigin: focus, transform: `scale(${s})` }}
      />
    </AbsoluteFill>
  );
};
