// Delivery formats. 9:16 = Reels/Stories/Status, 4:5 = feed (1080x1350), 1:1 = square feed, 16:9 = YouTube/landscape.
export type Format = "9:16" | "4:5" | "1:1";
export type FormatWithLandscape = Format | "16:9";

export const SIZE: Record<FormatWithLandscape, [number, number]> = {
  "9:16": [1080, 1920],
  "4:5": [1080, 1350],
  "1:1": [1080, 1080],
  "16:9": [1920, 1080],
};

export const FPS = 30;
/** Duration used when a composition has no data yet (empty slug or nothing in public/<slug>/). */
export const PLACEHOLDER_SECONDS = 5;
