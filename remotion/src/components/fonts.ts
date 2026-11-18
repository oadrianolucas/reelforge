import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadPlexMono } from "@remotion/google-fonts/IBMPlexMono";
import { loadFont as loadEmoji } from "@remotion/google-fonts/NotoColorEmoji";

// The headless Chrome used for rendering may have no system emoji font: Noto Color Emoji goes at the end of the stack.
const inter = loadInter("normal", { weights: ["400", "500", "600", "700", "800"], subsets: ["latin", "latin-ext"] });
const mono = loadPlexMono("normal", { weights: ["500", "600"], subsets: ["latin"] });
const emoji = loadEmoji();

export const FONT = `${inter.fontFamily}, ${emoji.fontFamily}, sans-serif`;
export const FONT_MONO = `${mono.fontFamily}, ${emoji.fontFamily}, monospace`;
