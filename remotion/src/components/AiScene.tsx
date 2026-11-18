import { AbsoluteFill, Img, OffthreadVideo, getStaticFiles, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

type Props = {
  video: string; // path inside public/ (e.g. "my-job/clip-a.mp4")
  image: string; // fallback while the clip has not been generated yet
  clipStart?: number; // seconds to skip at the start of the clip
  zoom?: [number, number]; // Ken Burns on the fallback (and a light push on the video)
  focus?: string; // object-position of the crop (e.g. "50% 35%" to keep the face inside a square)
  speed?: number; // clip playbackRate (0.8 = slow motion)
};

// AI-generated scene. If the .mp4 is not in public/ yet, shows the reference image with Ken Burns
// — so you can assemble and review the whole video before paying for the clips.
export const AiScene: React.FC<Props> = ({ video, image, clipStart = 0, zoom = [1.04, 1.12], focus = "50% 50%", speed = 1 }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const hasVideo = getStaticFiles().some((f) => f.name === video);
  const s = interpolate(frame, [0, durationInFrames], zoom);
  const style: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", objectPosition: focus, transformOrigin: focus, transform: `scale(${hasVideo ? 1 + (s - zoom[0]) * 0.4 : s})` };
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {hasVideo ? (
        <OffthreadVideo src={staticFile(video)} startFrom={Math.round(clipStart * fps)} playbackRate={speed} muted style={style} />
      ) : (
        <Img src={staticFile(image)} style={style} />
      )}
    </AbsoluteFill>
  );
};
