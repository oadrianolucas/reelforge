import { Audio, Sequence, staticFile, useVideoConfig } from "remotion";

// Plays a narration assembled by scripts/patch_voice.py (narration.patched.json → "segments"): audio pieces in
// sequence (approved take + new sentences).
// file = audio file inside `folder`; from/to = seconds inside that file (to null = until the end); at = second in the video.
export type AudioSegment = { file: string; from: number; to: number | null; at: number };

export const PatchedNarration: React.FC<{ folder: string; segments: AudioSegment[] }> = ({ folder, segments }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {segments.map((p, i) => (
        <Sequence key={i} from={Math.round(p.at * fps)} layout="none">
          <Audio src={staticFile(folder + p.file)} startFrom={Math.round(p.from * fps)} endAt={p.to === null ? undefined : Math.round(p.to * fps)} />
        </Sequence>
      ))}
    </>
  );
};
