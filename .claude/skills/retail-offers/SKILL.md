---
name: retail-offers
description: Produces a retail offers video in the animated supermarket-flyer style — product photo, name and size, giant price with a badge, logo and QR code, fast voice-over reading product and price, a new offer every 3–4 s. Use for supermarkets, grocers, pharmacies, butchers, any store with a list of products and prices ("weekly deals", "flyer", "promo video", "store specials", "price list video").
---

# Retail offers (animated flyer)

Template: the **`RetailOffers`** composition (`RetailOffers`, `RetailOffers4x5`, `RetailOffers1x1`; props `{slug, format}`),
data in `remotion/public/<slug>/offers.json`. Free example: `python3 scripts/example.py example-coffee/retail-offers --render`
(source in `examples/example-coffee/retail-offers/`). There's also `WallTv` in `remotion/src/motion/tv.tsx` for an
in-store TV loop. Reference: `docs/reference-analysis.md → Retail offers`.
The **cheapest style**: no AI scene — just product photos, motion and voice-over.

## 1. Input (ask the client)
- List: product, brand, size/volume, **price** (and "each"/"per lb"/"buy 3 pay 2"), offer validity.
- Product photos (white background is ideal) or exact names to look up; store logo; address/WhatsApp/QR.
- No photos: generate a packshot with `scripts/image_openrouter.py` only for **generic** products (bananas, meat,
  bread) — never invent the packaging of a real brand.

## 2. Script and voice-over
- 6–10 offers in a 30–40 s video (3–4 s each) or 15 offers in 60 s; open with the store name + "deals of the week",
  close with address/WhatsApp and validity.
- Energetic retail read, fast (3.5+ words/s): "Shampoo, four hundred ml, five seventy-five!" — price
  spelled out in the voice text, digits in the video. `scripts/voice.py` (the alignment pins each offer to the
  product's word).

## 3. Layout and motion
- **Centered block** product → name → detail → price, inside a **12% safe margin** on each side (the video gets
  cropped inside a phone frame and the Reels UI covers the edges). Badge also inside the margin. In 1:1 and 4:5:
  product on the left, text on the right.
- **Trim the photos first**: `python3 scripts/trim_png.py videos/<brand>/<job>/products/*.png` (transparent borders
  off-center the product; `--bg white` erases a flat background first). The image sits in a fixed box
  (`position:absolute; inset:0; objectFit:contain`) — never loose `maxWidth/maxHeight` (small images won't scale up
  and tall ones overflow).
- **Price** in a condensed flyer font (e.g. Anton), yellow with a solid 3D shadow, smaller raised cents; the unit
  ("each", "per lb") in a small yellow tag under the cents.
- **Scale per product** (default 1 after trimming): images with a lot of transparent margin need more; tall packages
  need less — judge the visual size, not the box.
- **No hard cuts**: a new offer comes in with a **circle of its color opening** over the previous color; the product
  drops from the center (position doesn't overshoot — only the scale bounces, so it never invades the text); text in
  cascade; exit in the last 7 frames moving up with blur.
- **Never still**: product breathing and turning slowly, sparks, a shine sweeping the price, rotating rays.
- Coins/shockwave **behind** the text, coming out from under the price. Upbeat retail music, low; a "ding" on each price.
- Check the transition between offers **frame by frame** (render ~6 consecutive stills).

## 4. Check
Price and name **exactly** as the client sent them (a wrong price in an offer is the worst possible mistake) — check
every price frame against the list before rendering and show the table to the user. Ask the delivery formats
(default 9:16 + 4:5; for an in-store TV use `WallTv`), render, `scripts/check.py`, and send the client a watermarked
preview first (`scripts/approval_preview.py`).
