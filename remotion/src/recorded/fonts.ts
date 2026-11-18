import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadGeist } from "@remotion/google-fonts/Geist";
import { loadFont as loadInstrumentSans } from "@remotion/google-fonts/InstrumentSans";
import { loadFont as loadInstrumentSerif } from "@remotion/google-fonts/InstrumentSerif";
import { loadFont as loadNewsreader } from "@remotion/google-fonts/Newsreader";
import { loadFont as loadJetBrains } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadGeistMono } from "@remotion/google-fonts/GeistMono";
import { loadFont as loadPlexMono } from "@remotion/google-fonts/IBMPlexMono";
import { loadFont as loadEmoji } from "@remotion/google-fonts/NotoColorEmoji";
import type { Theme } from "./types";

const lat = { subsets: ["latin", "latin-ext"] as ("latin" | "latin-ext")[] };
const emoji = loadEmoji().fontFamily;
const SANS = {
  inter: loadInter("normal", { weights: ["400", "500", "600", "700"], ...lat }).fontFamily,
  geist: loadGeist("normal", { weights: ["400", "500", "600", "700"], ...lat }).fontFamily,
  "instrument-sans": loadInstrumentSans("normal", { weights: ["400", "500", "600", "700"], ...lat }).fontFamily,
};
const SERIF = {
  "instrument-serif": loadInstrumentSerif("normal", { weights: ["400"], ...lat }).fontFamily,
  newsreader: loadNewsreader("normal", { weights: ["400", "500"], ...lat }).fontFamily,
};
const MONO = {
  jetbrains: loadJetBrains("normal", { weights: ["400", "500", "700"], ...lat }).fontFamily,
  "geist-mono": loadGeistMono("normal", { weights: ["400", "500", "700"], ...lat }).fontFamily,
  plex: loadPlexMono("normal", { weights: ["500", "600"], subsets: ["latin", "latin-ext"] }).fontFamily,
};

export const fonts = (t: Theme) => ({
  sans: `${SANS[t.sans]}, ${emoji}, sans-serif`,
  serif: `${SERIF[t.serif]}, ${emoji}, serif`,
  mono: `${MONO[t.mono]}, ${emoji}, monospace`,
});
