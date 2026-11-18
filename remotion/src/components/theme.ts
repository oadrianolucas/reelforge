// Brand theme shared by the templates that draw brand UI (end card, motion beats, phone screens, caption highlight).
// Every template merges `script.theme` (from the job JSON) over this neutral default — never hardcode brand colors.
export type Theme = {
  background: string; // near-black frame behind cards and screens
  surface: string; // cards inside phone screens
  text: string;
  textDim: string;
  accent: string; // main brand color (buttons, filled backgrounds)
  highlight: string; // lighter accent: caption highlight, numbers, emphasis on dark backgrounds
};

export const DEFAULT_THEME: Theme = {
  background: "#0b0c0f",
  surface: "#17191f",
  text: "#eeeeee",
  textDim: "#a3a3a3",
  accent: "#3b6ef5",
  highlight: "#8fb4ff",
};

export const withTheme = (t?: Partial<Theme>): Theme => ({ ...DEFAULT_THEME, ...(t ?? {}) });

export function rgba(hex: string, a: number) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** fetch + JSON that returns null instead of throwing (missing file in public/, empty slug in the Studio). */
export async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}
