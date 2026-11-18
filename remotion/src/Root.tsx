import { Composition } from "remotion";
import { UgcNarrated, calculateUgcNarratedMetadata } from "./videos/UgcNarrated";
import { VibeText, calculateVibeTextMetadata } from "./videos/vibe/VibeText";
import { Recorded, calculateRecordedMetadata } from "./recorded/Recorded";
import { Elegant, calculateElegantMetadata } from "./elegant/Elegant";
import { Lesson, calculateLessonMetadata } from "./lesson/Lesson";
import { MotionAd, calculateMotionAdMetadata } from "./videos/MotionAd";
import { RetailOffers, calculateRetailOffersMetadata } from "./videos/RetailOffers";
import { AppShowcase, calculateAppShowcaseMetadata } from "./videos/AppShowcase";
import { FPS, Format, PLACEHOLDER_SECONDS, SIZE } from "./components/formats";
import type { Format as RecordedFormat } from "./recorded/types";

// Generic compositions: each video is data in public/<slug>/ (or out/pub-<slug>/ with --public-dir), selected with
// --props '{"slug": "...", "format": "..."}'. Duration and size come from calculateMetadata; with no data the
// composition shows a placeholder, so the Studio opens even when public/ is empty.
const VARIANTS: [string, Format][] = [["", "9:16"], ["4x5", "4:5"], ["1x1", "1:1"]];
const PH = PLACEHOLDER_SECONDS * FPS;

export const Root: React.FC = () => (
  <>
    {/* Narrated UGC (scripts/ugc_narrated.py): persona shots from the library + narration + app screens + end card */}
    {VARIANTS.map(([suffix, format]) => (
      <Composition key={"ugc" + suffix} id={`UgcNarratedJob${suffix}`} component={UgcNarrated} calculateMetadata={calculateUgcNarratedMetadata}
        durationInFrames={PH} fps={FPS} width={SIZE[format][0]} height={SIZE[format][1]} defaultProps={{ slug: "", format }} />
    ))}

    {/* Recorded (scripts/recording.py + edit.json): your own talking-head footage, also 16:9 for long videos */}
    {([["", "9:16"], ["4x5", "4:5"], ["1x1", "1:1"], ["16x9", "16:9"]] as [string, RecordedFormat][]).map(([suffix, format]) => (
      <Composition key={"rec" + suffix} id={`Recorded${suffix}`} component={Recorded} calculateMetadata={calculateRecordedMetadata}
        durationInFrames={PH} fps={FPS} width={SIZE[format][0]} height={SIZE[format][1]} defaultProps={{ slug: "", format }} />
    ))}

    {/* Elegant brand video (scripts/elegant.py): real photos/videos + calm narration + serif titles */}
    {VARIANTS.map(([suffix, format]) => (
      <Composition key={"el" + suffix} id={`ElegantJob${suffix}`} component={Elegant} calculateMetadata={calculateElegantMetadata}
        durationInFrames={PH} fps={FPS} width={SIZE[format][0]} height={SIZE[format][1]} defaultProps={{ slug: "", format }} />
    ))}

    {/* Narrated 16:9 lesson (scripts/lesson.py): chapters, lists, plans, objections */}
    <Composition id="Lesson" component={Lesson} calculateMetadata={calculateLessonMetadata} durationInFrames={PH} fps={FPS} width={1920} height={1080} defaultProps={{ slug: "" }} />

    {/* Vibe + text (10 s organic post): selfie clip + native-style text + list on the beat */}
    {VARIANTS.map(([suffix, format]) => (
      <Composition key={"vibe" + suffix} id={`VibeText${suffix}`} component={VibeText} calculateMetadata={calculateVibeTextMetadata}
        durationInFrames={PH} fps={FPS} width={SIZE[format][0]} height={SIZE[format][1]} defaultProps={{ slug: "", format }} />
    ))}

    {/* Motion ad (ad.json): giant type, colors switching on the beat, icons, price counter, bursts, end card */}
    {VARIANTS.map(([suffix, format]) => (
      <Composition key={"ad" + suffix} id={`MotionAd${suffix}`} component={MotionAd} calculateMetadata={calculateMotionAdMetadata}
        durationInFrames={PH} fps={FPS} width={SIZE[format][0]} height={SIZE[format][1]} defaultProps={{ slug: "", format }} />
    ))}

    {/* Retail offers (offers.json): animated store flyer, one product + giant price every 3–4 s */}
    {VARIANTS.map(([suffix, format]) => (
      <Composition key={"ro" + suffix} id={`RetailOffers${suffix}`} component={RetailOffers} calculateMetadata={calculateRetailOffersMetadata}
        durationInFrames={PH} fps={FPS} width={SIZE[format][0]} height={SIZE[format][1]} defaultProps={{ slug: "", format }} />
    ))}

    {/* App showcase (showcase.json): music only, app screens in 3D, pulsing button, orbiting objects, cuts on the beat */}
    {VARIANTS.map(([suffix, format]) => (
      <Composition key={"as" + suffix} id={`AppShowcase${suffix}`} component={AppShowcase} calculateMetadata={calculateAppShowcaseMetadata}
        durationInFrames={PH} fps={FPS} width={SIZE[format][0]} height={SIZE[format][1]} defaultProps={{ slug: "", format }} />
    ))}
  </>
);
