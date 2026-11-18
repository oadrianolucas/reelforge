// RetailOffers: animated store flyer from data (public/<slug>/offers.json). Opening with the store, one offer every
// 3–4 s (product photo, name + size, giant price with cents, badge, old price struck), store mark and QR area fixed,
// closing card. Each offer opens over the previous color; product breathes, rays turn slowly, price lands on a beat.
// No photo → a clean colored tile with the product initial (or `icon`). Optional voice-over and music.
import { AbsoluteFill, Audio, CalculateMetadataFunction, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Format, FPS, PLACEHOLDER_SECONDS, SIZE } from "../components/formats";
import { fetchJson, rgba } from "../components/theme";
import { Placeholder } from "../components/Placeholder";
import type { Word } from "../components/Captions";
import { Confetti, Explosion, Shockwave } from "../motion/beats";
import { AdTheme, Headline, Music, Rhythm, Slot, Timed, beatPulse, bgColor, hasFile, icon, layoutScenes, loadRhythm, loadWords, mediaPath, onBg, useBrandFonts, useFitSize, useIn, useUnits, withAdTheme } from "./kit";

export type Offer = Timed & {
  name: string;
  size?: string; // "340 g", "1 L"
  price: number | string; // 12.99 or "12.99"
  was?: number | string; // old price, struck through
  unit?: string; // "each", "/kg", "bag"
  image?: string; // product photo (transparent PNG is best) in public/<slug>/
  icon?: string; // drawn in the fallback tile instead of the initial
  color?: string; // background: dark | accent | light | highlight | CSS color
  badge?: string; // overrides the default badge
  scale?: number; // visual size of the photo (default 1)
};
export type OffersData = {
  theme?: Partial<AdTheme>;
  store: { name: string; logo?: string; icon?: string }; // logo file in public/<slug>/ (wordmark fallback)
  title?: string; // opening headline (default "This week's *offers*")
  validity?: string; // "Mon–Sun only"
  currency?: string; // symbol before the price (default "$")
  decimalSeparator?: string; // default "."
  badge?: string; // default badge text (default "Special")
  qr?: { image?: string; label?: string; text?: string }; // QR image in public/<slug>/ (icon fallback)
  outro?: { title?: string; text?: string };
  secondsPerOffer?: number; // default 3.5 (rounded to whole beats)
  bpm?: number; // default 120
  music?: Music;
  narration?: { file: string; alignment?: string }; // voice-over; with an alignment, offers can pin to `word`
  intro?: Timed;
  offers: Offer[];
};
type Props = { slug: string; format: Format; data?: OffersData; rhythm?: Rhythm; words?: Word[] | null; slots?: Slot[] };

const CYCLE = ["accent", "dark", "light"];

export const calculateRetailOffersMetadata: CalculateMetadataFunction<Props> = async ({ props }) => {
  const [width, height] = SIZE[props.format];
  const data = props.slug ? await fetchJson<OffersData>(staticFile(`${props.slug}/offers.json`)) : null;
  if (!data?.offers?.length) return { durationInFrames: PLACEHOLDER_SECONDS * FPS, width, height, props };
  const rhythm = await loadRhythm(props.slug, data.music, data.bpm ?? 120);
  const words = await loadWords(props.slug, data.narration?.alignment);
  const perOffer = Math.max(2, Math.round((data.secondsPerOffer ?? 3.5) / rhythm.interval));
  const items: Timed[] = [{ beats: 5, ...(data.intro ?? {}) }, ...data.offers.map((o) => ({ beats: perOffer, ...o })), { beats: 7 }];
  const slots = layoutScenes(items, rhythm, perOffer, words);
  const last = slots[slots.length - 1];
  const end = Math.max(last.from + last.dur, words?.length ? words[words.length - 1].end + 0.6 : 0);
  slots[slots.length - 1] = { ...last, dur: end - last.from };
  return { durationInFrames: Math.ceil(end * FPS), width, height, props: { ...props, data, rhythm, words, slots } };
};

type Fonts = ReturnType<typeof useBrandFonts>;

export const RetailOffers: React.FC<Props> = ({ slug, format, data, rhythm, slots }) => {
  const theme = withAdTheme(data?.theme);
  const fonts = useBrandFonts(theme);
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  if (!data?.offers?.length || !rhythm || !slots) return <Placeholder title="RetailOffers" hint={`No data: put offers.json in public/${slug || "<slug>"}/ (see examples/).`} />;
  const t = frame / fps;
  const pulse = beatPulse(t, rhythm);
  const bgs = ["dark", ...data.offers.map((o, i) => o.color ?? CYCLE[i % CYCLE.length]), "dark"];
  const f = (s: number) => Math.round(s * fps);
  // the fixed header/footer take the colors of the scene that is mostly on screen (switch mid-wipe)
  let cur = 0;
  slots.forEach((s, i) => {
    if (frame >= f(s.from) + 6) cur = i;
  });
  const showChrome = cur > 0 && cur < slots.length - 1;
  const musicFile = data.music?.file ? mediaPath(slug, data.music.file) : null;
  const voice = data.narration ? `${slug}/${data.narration.file}` : null;
  const musicVolume = (fr: number) => (voice ? 0.15 : 0.65) * interpolate(fr, [durationInFrames - 0.8 * fps, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: bgColor(theme, bgs[0]), fontFamily: fonts.body }}>
      {slots.map((s, i) => (
        <Sequence key={i} from={f(s.from)} durationInFrames={Math.max(1, f(s.from + s.dur) - f(s.from))}>
          <Wipe color={bgColor(theme, bgs[i])} prev={bgColor(theme, bgs[Math.max(0, i - 1)])} pulse={pulse} first={i === 0}>
            {i === 0 ? (
              <Intro data={data} theme={theme} fonts={fonts} slug={slug} />
            ) : i === slots.length - 1 ? (
              <Outro data={data} theme={theme} fonts={fonts} slug={slug} />
            ) : (
              <OfferView o={data.offers[i - 1]} k={i - 1} bg={bgs[i]} data={data} theme={theme} fonts={fonts} slug={slug} format={format} rhythm={rhythm} />
            )}
          </Wipe>
        </Sequence>
      ))}
      {showChrome && <Chrome data={data} theme={theme} fonts={fonts} slug={slug} bg={bgs[cur]} />}
      {voice && hasFile(voice) && <Audio src={staticFile(voice)} />}
      {musicFile && hasFile(musicFile) && <Audio src={staticFile(musicFile)} startFrom={f(data.music?.start ?? 0)} volume={musicVolume} />}
    </AbsoluteFill>
  );
};

// New color opens as a circle over the previous one; slow rays turning behind; light pulse on the beat.
const Wipe: React.FC<{ color: string; prev: string; pulse: number; first?: boolean; children: React.ReactNode }> = ({ color, prev, pulse, first, children }) => {
  const frame = useCurrentFrame();
  const open = useIn(0, 12);
  const light = !first && /^#/.test(color) && parseInt(color.slice(1, 3), 16) > 200;
  return (
    <AbsoluteFill style={{ background: prev, overflow: "hidden" }}>
      <AbsoluteFill style={{ background: color, clipPath: first || open >= 1 ? undefined : `circle(${open * 130}% at 50% 42%)` }}>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: "240%", aspectRatio: "1", flexShrink: 0, borderRadius: "50%", background: `repeating-conic-gradient(${light ? "rgba(0,0,0,0.035)" : "rgba(255,255,255,0.05)"} 0deg 7deg, transparent 7deg 14deg)`, transform: `rotate(${frame * 0.25}deg)` }} />
        </AbsoluteFill>
        <AbsoluteFill style={{ background: `radial-gradient(ellipse 60% 40% at 50% 40%, rgba(255,255,255,${(light ? 0.35 : 0.12) + 0.06 * pulse}), transparent 70%)` }} />
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Wordmark: React.FC<{ data: OffersData; theme: AdTheme; fonts: Fonts; slug: string; size: number; color: string }> = ({ data, theme, fonts, slug, size, color }) => {
  const logo = data.store.logo ? `${slug}/${data.store.logo}` : "";
  if (logo && hasFile(logo)) return <Img src={staticFile(logo)} style={{ height: size * 1.1, objectFit: "contain" }} />;
  const I = icon(data.store.icon ?? "store");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.3 }}>
      <div style={{ width: size, height: size, borderRadius: size * 0.3, background: `linear-gradient(140deg, ${theme.highlight}, ${theme.accent})`, display: "grid", placeItems: "center", flexShrink: 0 }}>
        <I size={size * 0.58} color={theme.light} />
      </div>
      <span style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: size * 0.62, letterSpacing: "-0.02em", color, whiteSpace: "nowrap" }}>{data.store.name}</span>
    </div>
  );
};

const QrTile: React.FC<{ data: OffersData; theme: AdTheme; slug: string; size: number }> = ({ data, theme, slug, size }) => {
  const img = data.qr?.image ? `${slug}/${data.qr.image}` : "";
  const Q = icon("qr");
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.16, background: "#fff", display: "grid", placeItems: "center", flexShrink: 0, boxShadow: `0 ${size * 0.08}px ${size * 0.2}px rgba(0,0,0,0.18)` }}>
      {img && hasFile(img) ? <Img src={staticFile(img)} style={{ width: "86%", height: "86%", objectFit: "contain" }} /> : <Q size={size * 0.7} color={theme.ink} />}
    </div>
  );
};

// Fixed header (store + validity) and footer (QR + text) inside the 12% safe margin.
const Chrome: React.FC<{ data: OffersData; theme: AdTheme; fonts: Fonts; slug: string; bg: string }> = ({ data, theme, fonts, slug, bg }) => {
  const { u, v, tall, square, height } = useUnits();
  const c = onBg(theme, bg);
  const side = (square ? 56 : 90) * u;
  const top = tall ? height * 0.07 : 44 * u;
  return (
    <>
      <div style={{ position: "absolute", top, left: side, right: side, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Wordmark data={data} theme={theme} fonts={fonts} slug={slug} size={(square ? 60 : 76) * u} color={c.fg} />
        {data.validity && (
          <div style={{ fontFamily: fonts.body, fontWeight: 700, fontSize: 30 * u * v, color: c.fg, padding: `${10 * u}px ${24 * u}px`, borderRadius: 999, border: `${2.5 * u}px solid ${rgba(c.fg.startsWith("#") ? c.fg : "#ffffff", 0.45)}`, whiteSpace: "nowrap" }}>{data.validity}</div>
        )}
      </div>
      {data.qr && !square && (
        <div style={{ position: "absolute", bottom: tall ? height * 0.065 : 44 * u, left: side, right: side, display: "flex", alignItems: "center", gap: 26 * u }}>
          <QrTile data={data} theme={theme} slug={slug} size={(tall ? 128 : 104) * u} />
          <div style={{ color: c.fg, lineHeight: 1.2 }}>
            {data.qr.label && <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 40 * u * v }}>{data.qr.label}</div>}
            {data.qr.text && <div style={{ fontFamily: fonts.body, fontWeight: 500, fontSize: 30 * u * v, color: c.dim }}>{data.qr.text}</div>}
          </div>
        </div>
      )}
    </>
  );
};

function splitPrice(p: number | string, sep: string) {
  const s = typeof p === "number" ? p.toFixed(2) : p.trim();
  const m = s.match(/^(\d+)(?:[.,](\d+))?$/);
  if (!m) return { whole: s, cents: "" };
  return { whole: m[1], cents: m[2] ? sep + m[2].padEnd(2, "0").slice(0, 2) : "" };
}

const priceColor = (theme: AdTheme, bg: string) => (bg === "dark" ? theme.highlight : bg === "accent" ? theme.light : bg === "light" ? theme.accent : onBg(theme, bg).fg);

const OfferView: React.FC<{ o: Offer; k: number; bg: string; data: OffersData; theme: AdTheme; fonts: Fonts; slug: string; format: Format; rhythm: Rhythm }> = ({ o, k, bg, data, theme, fonts, slug, format, rhythm }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width } = useVideoConfig();
  const { u, v, square } = useUnits();
  const c = onBg(theme, bg);
  const pc = priceColor(theme, bg);
  const sp = (d: number, cfg = { damping: 15, stiffness: 160 }) => spring({ frame: frame - d, fps, config: cfg });
  const prod = sp(3, { damping: 14, stiffness: 140 });
  const name = useIn(8, 16);
  const size = useIn(11, 16);
  const priceAt = Math.max(14, Math.round(rhythm.interval * fps * 2) - 2);
  const price = sp(priceAt, { damping: 10, stiffness: 220 });
  const badge = sp(priceAt + 6, { damping: 11, stiffness: 200 });
  const exit = interpolate(frame, [durationInFrames - 7, durationInFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const breathe = 1 + Math.sin(frame / 12) * 0.02;
  const sway = Math.sin(frame / 18) * 2.5;
  const box = (square ? 420 : format === "4:5" ? 440 : 600) * u;
  const textW = square ? width * 0.46 : width * 0.76;
  const nameSize = useFitSize([o.name], fonts.display, 800, (square ? 74 : 92) * v, (textW / width) * 0.98, "-0.03em");
  const { whole, cents } = splitPrice(o.price, data.decimalSeparator ?? ".");
  const was = o.was !== undefined ? `${data.currency ?? "$"}${typeof o.was === "number" ? o.was.toFixed(2).replace(".", data.decimalSeparator ?? ".") : o.was}` : null;
  const wholeSize = (square ? 220 : format === "4:5" ? 230 : 300) * u;

  const img = o.image ? `${slug}/${o.image}` : "";
  const product = img && hasFile(img) ? (
    <Img src={staticFile(img)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", transform: `scale(${o.scale ?? 1})`, filter: `drop-shadow(0 ${24 * u}px ${30 * u}px rgba(0,0,0,0.35))` }} />
  ) : (
    <ProductTile o={o} theme={theme} fonts={fonts} bg={bg} box={box} />
  );

  return (
    <AbsoluteFill style={{ transform: `translateY(${-exit * 60 * u}px)`, opacity: 1 - exit * 0.7 }}>
      <Shockwave delay={priceAt} color={rgba(pc.startsWith("#") ? pc : "#ffffff", 0.7)} thickness={18} />
      <Explosion delay={priceAt} seed={"o" + k} n={22} force={0.9} size={[30, 60]} origin={square ? [0.7, 0.62] : [0.5, 0.72]} render={(i, t) => <Confetti size={t} i={i} colors={[theme.highlight, theme.light, theme.accent]} />} />
      <AbsoluteFill style={{ flexDirection: square ? "row" : "column", alignItems: "center", justifyContent: "center", gap: (square ? 40 : 30) * u, padding: square ? `0 ${70 * u}px` : `${(format === "4:5" ? 90 : 120) * u}px 0 0` }}>
        {/* product */}
        <div style={{ position: "relative", width: box, height: box, flexShrink: 0, transform: `translateY(${(1 - Math.min(1, prod)) * -200 * u}px) scale(${(0.4 + 0.6 * prod) * breathe}) rotate(${(1 - Math.min(1, prod)) * 20 + sway}deg)`, opacity: Math.min(1, prod * 2) }}>
          {product}
          <div style={{ position: "absolute", ...(square ? { left: -box * 0.1 } : { right: -box * 0.08 }), top: -box * 0.04, width: box * 0.32, height: box * 0.32, borderRadius: "50%", background: bg === "dark" ? theme.highlight : bg === "light" ? theme.accent : theme.ink, color: bg === "dark" ? theme.ink : theme.light, display: "grid", placeItems: "center", textAlign: "center", fontFamily: fonts.body, fontWeight: 800, fontSize: box * 0.052, lineHeight: 1.05, letterSpacing: "0.04em", textTransform: "uppercase", padding: box * 0.03, boxSizing: "border-box", transform: `scale(${badge}) rotate(${12 + Math.sin(frame / 14) * 5}deg)`, boxShadow: `0 ${10 * u}px ${26 * u}px rgba(0,0,0,0.25)` }}>
            {o.badge ?? data.badge ?? "Special"}
          </div>
        </div>
        {/* texts */}
        <div style={{ width: textW, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: nameSize, lineHeight: 1.02, letterSpacing: "-0.03em", color: c.fg, opacity: name, transform: `translateY(${(1 - name) * 30 * u}px)`, whiteSpace: "nowrap" }}>{o.name}</div>
          {o.size && <div style={{ fontFamily: fonts.body, fontWeight: 600, fontSize: 40 * u * v, color: c.dim, marginTop: 10 * u, opacity: size, transform: `translateY(${(1 - size) * 24 * u}px)` }}>{o.size}</div>}
          <div style={{ display: "flex", alignItems: "center", gap: 20 * u, marginTop: 20 * u * v }}>
            {was && (
              <div style={{ position: "relative", fontFamily: fonts.body, fontWeight: 600, fontSize: 40 * u * v, color: c.dim, opacity: size }}>
                {was}
                <div style={{ position: "absolute", left: "-6%", right: "-6%", top: "52%", height: 4 * u, background: c.dim, transform: "rotate(-8deg)" }} />
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", color: pc, fontFamily: fonts.display, fontWeight: 900, lineHeight: 0.86, letterSpacing: "-0.04em", fontVariantNumeric: "lining-nums", transform: `scale(${0.5 + 0.5 * price}) rotate(${(1 - price) * -8}deg)`, opacity: Math.min(1, price * 2), marginTop: 4 * u }}>
            <span style={{ fontSize: wholeSize * 0.32, marginTop: wholeSize * 0.1, marginRight: wholeSize * 0.03 }}>{data.currency ?? "$"}</span>
            <span style={{ fontSize: wholeSize }}>{whole}</span>
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", marginLeft: wholeSize * 0.03 }}>
              <span style={{ fontSize: wholeSize * 0.42, marginTop: wholeSize * 0.06 }}>{cents}</span>
              {o.unit && <span style={{ fontFamily: fonts.body, fontWeight: 700, fontSize: wholeSize * 0.13, letterSpacing: "0.02em", marginTop: wholeSize * 0.08, marginLeft: wholeSize * 0.03, color: c.dim }}>{o.unit}</span>}
            </span>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Product without a photo: soft tile in the paper color with the initial (or the icon) in the accent.
const ProductTile: React.FC<{ o: Offer; theme: AdTheme; fonts: Fonts; bg: string; box: number }> = ({ o, theme, fonts, bg, box }) => {
  const tile = bg === "light" ? theme.background : theme.light;
  const ink = bg === "light" ? theme.highlight : bg === "accent" ? theme.accent : theme.accent;
  const I = o.icon ? icon(o.icon) : null;
  const s = box * 0.84;
  return (
    <div style={{ position: "absolute", inset: (box - s) / 2, borderRadius: s * 0.28, background: tile, boxShadow: `0 ${s * 0.06}px ${s * 0.16}px rgba(0,0,0,0.28), inset 0 0 0 ${s * 0.012}px rgba(255,255,255,0.4)`, display: "grid", placeItems: "center", overflow: "hidden" }}>
      <div style={{ position: "absolute", width: s * 0.78, height: s * 0.78, borderRadius: "50%", background: rgba(ink, 0.1) }} />
      {I ? <I size={s * 0.46} color={ink} style={{ position: "relative" }} /> : <span style={{ position: "relative", fontFamily: fonts.display, fontWeight: 800, fontSize: s * 0.52, color: ink, lineHeight: 1 }}>{o.name.trim().charAt(0).toUpperCase()}</span>}
    </div>
  );
};

const Intro: React.FC<{ data: OffersData; theme: AdTheme; fonts: Fonts; slug: string }> = ({ data, theme, fonts, slug }) => {
  const { u, v } = useUnits();
  const mark = useIn(0, 16);
  return (
    <>
      <Explosion delay={12} seed="intro" n={34} force={1.2} size={[34, 66]} render={(i, t) => <Confetti size={t} i={i} colors={[theme.highlight, theme.light, theme.accent]} />} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 50 * u * v }}>
        <div style={{ opacity: mark, transform: `translateY(${(1 - mark) * 30 * u}px)` }}>
          <Wordmark data={data} theme={theme} fonts={fonts} slug={slug} size={110 * u * v} color={theme.light} />
        </div>
        <Headline text={data.title ?? "This week's\n*offers*"} font={fonts.display} color={theme.light} em={theme.highlight} max={190 * v} weight={800} delay={6} italicEm={/fraunces|serif|playfair/i.test(fonts.displayName)} />
        {data.validity && <Tag text={data.validity} theme={theme} fonts={fonts} delay={16} />}
      </AbsoluteFill>
    </>
  );
};

const Tag: React.FC<{ text: string; theme: AdTheme; fonts: Fonts; delay: number }> = ({ text, theme, fonts, delay }) => {
  const { u, v } = useUnits();
  const p = useIn(delay, 14);
  return <div style={{ fontFamily: fonts.body, fontWeight: 700, fontSize: 42 * u * v, color: theme.ink, background: theme.highlight, padding: `${12 * u}px ${34 * u}px`, borderRadius: 999, transform: `scale(${0.8 + 0.2 * p})`, opacity: p, whiteSpace: "nowrap" }}>{text}</div>;
};

const Outro: React.FC<{ data: OffersData; theme: AdTheme; fonts: Fonts; slug: string }> = ({ data, theme, fonts, slug }) => {
  const { u, v } = useUnits();
  const q = useIn(10, 16);
  const mark = useIn(0, 16);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 46 * u * v }}>
      <div style={{ opacity: mark }}>
        <Wordmark data={data} theme={theme} fonts={fonts} slug={slug} size={90 * u * v} color={theme.light} />
      </div>
      <Headline text={data.outro?.title ?? data.store.name} font={fonts.display} color={theme.light} em={theme.highlight} max={150 * v} weight={800} delay={4} italicEm={/fraunces|serif|playfair/i.test(fonts.displayName)} />
      {data.qr && (
        <div style={{ display: "flex", alignItems: "center", gap: 30 * u, opacity: q, transform: `translateY(${(1 - q) * 30 * u}px)` }}>
          <QrTile data={data} theme={theme} slug={slug} size={170 * u * v} />
          <div style={{ color: theme.light, lineHeight: 1.25 }}>
            {data.qr.label && <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 50 * u * v }}>{data.qr.label}</div>}
            {data.qr.text && <div style={{ fontFamily: fonts.body, fontWeight: 500, fontSize: 36 * u * v, opacity: 0.7 }}>{data.qr.text}</div>}
          </div>
        </div>
      )}
      {(data.outro?.text ?? data.validity) && <Tag text={(data.outro?.text ?? data.validity)!} theme={theme} fonts={fonts} delay={18} />}
    </AbsoluteFill>
  );
};
