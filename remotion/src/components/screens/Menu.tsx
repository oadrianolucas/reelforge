import { Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import * as Remix from "@remixicon/react";
import type { RemixiconComponentType } from "@remixicon/react";
import { FONT } from "../fonts";
import { rgba } from "../theme";
import type { PhoneScreenProps } from "./types";

type Item = { name: string; desc?: string; price: string; icon?: string };

const ri = (name: string | undefined, fallback: string) => {
  const lib = Remix as unknown as Record<string, RemixiconComponentType>;
  return lib[name ?? ""] ?? lib[fallback];
};

// Generic ordering screen: greeting, category chips, "your usual" card in the accent, item list, order button.
// Extra props (all optional): greeting, title, chips: string[], items: { name, desc?, price, icon? (Remix name) }[],
// selected (index of the item that gets tapped, default 0), button ("Order").
export const Menu: React.FC<PhoneScreenProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { theme } = p;
  const items = (p.items as Item[] | undefined) ?? [
    { name: "Flat white", desc: "Double shot, silky milk", price: "$3.80", icon: "RiCupLine" },
    { name: "Cold brew", desc: "Steeped 18 hours", price: "$4.20", icon: "RiDrinks2Line" },
    { name: "Croissant", desc: "Baked this morning", price: "$2.75", icon: "RiCake3Line" },
  ];
  const chips = (p.chips as string[] | undefined) ?? ["Popular", "Hot", "Iced", "Bakery"];
  const sel = (p.selected as number | undefined) ?? 0;
  const enter = (d: number) => spring({ frame: frame - d, fps, config: { damping: 18, stiffness: 160 } });
  const tap = interpolate(frame, [22, 26, 32], [1, 0.96, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const Usual = ri(items[sel]?.icon, "RiCupLine");
  const border = `1px solid ${rgba(theme.text.startsWith("#") ? theme.text : "#ffffff", 0.08)}`;
  return (
    <div style={{ position: "absolute", inset: 0, background: theme.background, color: theme.text, fontFamily: FONT, padding: "62px 20px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {p.icon ? <Img src={p.icon} style={{ width: 30, height: 30, borderRadius: 8 }} /> : <div style={{ width: 30, height: 30, borderRadius: 9, background: `linear-gradient(140deg, ${theme.highlight}, ${theme.accent})` }} />}
          <div style={{ fontWeight: 700, fontSize: 18 }}>{p.appName ?? "App"}</div>
        </div>
        <div style={{ width: 34, height: 34, borderRadius: 17, background: theme.surface, border }} />
      </div>
      <div style={{ marginTop: 22, fontSize: 14, color: theme.textDim, fontWeight: 500, opacity: enter(0) }}>{(p.greeting as string) ?? "Good morning"}</div>
      <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", marginTop: 2, opacity: enter(2) }}>{(p.title as string) ?? "What's it today?"}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        {chips.map((c, i) => (
          <div key={c} style={{ padding: "7px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, background: i === 0 ? theme.text : theme.surface, color: i === 0 ? theme.background : theme.textDim, border, opacity: enter(4 + i * 2) }}>{c}</div>
        ))}
      </div>
      {items[sel] && (
        <div style={{ marginTop: 18, borderRadius: 22, padding: 18, background: `linear-gradient(140deg, ${theme.accent}, ${rgba(theme.accent, 0.75)})`, color: "#fff", display: "flex", alignItems: "center", gap: 14, transform: `scale(${tap * (0.94 + 0.06 * enter(6))})`, opacity: enter(6), boxShadow: `0 14px 30px ${rgba(theme.accent, 0.35)}` }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(255,255,255,0.18)", display: "grid", placeItems: "center" }}>
            <Usual size={30} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.8, letterSpacing: "0.06em", textTransform: "uppercase" }}>Your usual</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{items[sel].name}</div>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{items[sel].price}</div>
        </div>
      )}
      <div style={{ marginTop: 14 }}>
        {items.map((it, i) => {
          const g = enter(10 + i * 3);
          const I = ri(it.icon, "RiCupLine");
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 4px", borderBottom: border, opacity: g, transform: `translateY(${(1 - g) * 14}px)` }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, background: theme.surface, display: "grid", placeItems: "center", border }}>
                <I size={24} color={theme.highlight} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{it.name}</div>
                {it.desc && <div style={{ fontSize: 13, color: theme.textDim, marginTop: 2 }}>{it.desc}</div>}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{it.price}</div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 20, right: 20, bottom: 30, height: 56, borderRadius: 18, background: theme.text, color: theme.background, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 17, opacity: enter(16) }}>
        {(p.button as string) ?? "Order"} {items[sel] ? `· ${items[sel].price}` : ""}
      </div>
    </div>
  );
};
