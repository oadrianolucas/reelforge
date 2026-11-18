# Data formats

What each Remotion composition reads from `remotion/public/<slug>/` and the JSON files the scripts write. Generated files only — you rarely edit them by hand, except the template JSONs (`ad.json`, `offers.json`, `showcase.json`; see `examples/`).

## Compositions

## Expected files per composition

### UgcNarratedJob* — `public/<slug>/`
- `script.json` (written by `scripts/ugc_narrated.py` as `media/script.json`):
  ```
  { "persona": "<persona-id>",
    "narration": "narration.mp3", "alignment": "narration.alignment.json",
    "music"?: "<id>"                       // library/music/<id>.mp3; omitted = no music
    "theme"?: { background, surface, text, textDim, accent, highlight },   // neutral default (components/theme.ts)
    "app"?: { "name" },                    // app name on notifications/screens (default "App")
    "store"?: { "name", "email"? },        // passed to the phone screens as `store`
    "locale"?: "en-US",                    // number formatting in motion beats
    "scenes": [
      { "shot": "name" | "persona:name", "from", "to", "start"?, "speed"?, "zoom"?: [a, b] },
      { "screen": "<screen id>", "background": "name" | "persona:name", "from", "to", "value"?, "props"?: {...} },
      { "motion": { "text"?, "sub"?, "background"?: "dark"|"accent"|"light", "icon"?, "cross"?, "shake"?,
                    "number"?: { "from", "to", "prefix"?, "suffix"? } }, "from", "to" } ],
    "overlays"?: [ { "type"?: "notification", "from", "to", "title", "text" },
                   { "type"?: "messages", "from", "to", "items": [{ "name", "text", "at" }], "unread"? } ],
                   // kind is inferred: an overlay with "items" is a message stack, otherwise a notification
    "highlights"?: ["word", ...],          // lowercase, no punctuation
    "card": { "from", "title", "highlight"?, "subtitle"?, "cta"? },        // end card (cta = button text)
    "duration",                            // narration + card, without the opening
    "opening"?: { "file": "<hook file in library/hooks>" | null, "start", "dur",
                  "continuation"?: { "file", "dur", "captions": "<scribe transcript json>" } } }
  ```
  Times in seconds of the narration. Motion icons: `clock sms star box team money cart question eye-off code email
  gift alert whatsapp bolt truck`.
- `narration.mp3`, `narration.alignment.json` (`{"words": [{text,start,end}]}`), `logo.svg` (white), `favicon.svg`,
  and the continuation clip + its transcript when there is an opening.
- Library (under the same public dir): `library/personas/<p>/shots.json` **and** the clips it points to
  (`library/personas/<p>/<clip>`, `clip` is relative to the persona folder, e.g. `scenes/clips/x.mp4`),
  `library/music/<id>.mp3`, `library/hooks/<file>`, `library/sfx/{whoosh,pop,chime,ding}.mp3`.
  (`chime.mp3` is the notification sound.)
- Phone screens: id registered in `src/components/screens/index.ts` (`PHONE_SCREENS`). Shipped example:
  `"sales-stats"` (props: `title`, `currency`, `locale`, `rows: [{label, value}]`, `bars: number[]`, plus `value`).
  Every screen receives `{ theme, icon, appName, store, duration, value, ...props }`.

### Recorded* — `public/<slug>/`
- `edl.json` (`scripts/recording.py`): `{ "fps", "duration", "factor"?, "segments": [{ "src_start", "src_end", "start", "end" }],
  "words": [{ "i", "src_i"?, "text", "start", "end" }] }`.
- `cut.mp4`, `edit.json` (optional), media files referenced by it, `logo.svg`/`favicon.svg`
  when used, beats file (`{"onsets": [...]}`, path relative to public/) when `rhythm.beats` is set, `library/sfx/whoosh.mp3`, `pop.mp3`.
- `edit.json` (every time reference is a WORD INDEX of edl.json):
  ```
  { "theme"?: { dark, paper, ink, light, accent, sans: inter|geist|instrument-sans, serif: instrument-serif|newsreader,
               mono: jetbrains|geist-mono|plex },
    "brand"?: { background, surface, text, textDim, accent, highlight },   // app screens + branded end card
    "captions"?: { "style": "editorial"|"mono"|"minimal"|"impact"|"none", "max", "highlights": [i], "hide": [[a,b]], "size" },
    "camera"?: { "alternate": [z0, z1], "push", "focus" },
    "punches"?: [{ "word", "zoom"? }],
    "rhythm"?: { "beats": "<path>.beats.json", "pulse", "snap", "autoPunches" },
    "blocks"?: [
      { "type": "split", "from", "to", "media", "side"?: "top"|"bottom"|"left"|"right", "background"?: "dark"|"paper", "label"? },
      { "type": "full", "from", "to", "media", "background"?, "label"? },
      { "type": "title", "word", "text", "seconds"?, "font"?: "serif"|"sans"|"mono", "position"?: "top"|"center"|"bottom", "size"? },
      { "type": "chapter", "word", "number", "title", "media"?, "seconds"?, "label"? (default "Chapter") } ],
    "music"?: { "file", "volume"?, "start"? },
    "sfx"?: true | false | { "whoosh"?, "pop"? },
    "endCard"?: { "text", "sub"?, "seconds"?, "branded"?: true, "cta"? } }
  ```
  `media` = `"file.png|mp4"` | `{ "screenshot", "zoom"?, "focus"?, "frame"? }` | `{ "diagram": { "root", "items": [{ "text", "word", "icon"?, "sub"? }], "done"? } }`
  | `{ "steps": { "items": [{ "text", "word" }], "center"? } }` | `{ "canvas": { "items": [{ "img", "label"?, "word" }], "title"?: { "text", "word" } } }`
  | `{ "list": { "title"?, "items": [{ "text", "word", "ok"? }] } }` | `{ "ui": "<phone screen id>", "props"? }`.
  Diagram icons: `file email chat ok code terminal robot search person github ai bolt calendar chart`.

### ElegantJob* — `public/<slug>/` (`scripts/elegant.py publish`)
- `script.json`:
  ```
  { "theme"?: { background, primary, dark, accent, text, logo }, // neutral default; logo = file name (default logo.svg)
    "alignment"?: "alignment.json", "narration"?: "narration.mp3",
    "music"?: { "file", "volume"?, "start"? },
    "captions"?: { "hide": [[a,b]], "display": { "<i>": "text" }, "join": [[a,b]], "off"? },
    "scenes": [
      { "type": "photo", "from", "media", "focus"?, "zoom"?, "darken"?, "label"?, "titles"?: [line], "sub"?: { "text", "at" }, "position"?: "bottom"|"center" },
      { "type": "sequence", "from", "items": [{ "media", "at", "focus"? }], "numbers"?: [{ "n", "label", "italic"?, "at" }], "label"? },
      { "type": "quote", "from", "background", "label"?, "lines": [line] },
      { "type": "app", "from", "screen": "<screen id>", "label"?, "groups"?: [[line]], "marks"?: { "<name>": wordIndex } },
      { "type": "signoff", "from", "title", "at", "site"?, "cta"?, "siteAt"? } ] }
  ```
  `line` = `{ "text" (*accent* in italics), "at", "size"?: n | { "9:16"?, "4:5"?, "1:1"? } }`;
  `label` = `"text"` (hidden in 1:1) | `{ "text", "formats"?: ["9:16", ...] }`. Every `from`/`at` is a WORD INDEX of the alignment.
- Files: `narration.mp3`, `alignment.json`, the media files, `logo.svg`, music file.
- App screens: registry `src/elegant/screens/index.ts` (`SCREENS`). Shipped example `"stats-dashboard"`, marks `open`, `grow`,
  `highlight`. Screen props: `{ marks: Record<name, frame>, portrait: boolean }`.

### Lesson — `public/<slug>/` (`scripts/lesson.py build`)
- `timeline.json`: `{ "duration", "title"?, "audios": [{ "file", "at", "from"?, "to"? }], "music"?: { "file", "volume"?, "duration"? } | null,
  "words": [{ "text", "start", "end" }], "scenes": [scene], "theme"?: {...elegant theme}, "chapters"?: { "<chapter id>": "footer text" } }`.
  Each scene: `{ "type", "from", "to", "start", "speechEnd", "marks": { "<marker>": seconds }, "chapter", ...visual fields }`;
  visual `"at"` values are marker names (resolved through `marks`).
- Scene types and fields (written in the lesson `script.json` by the user, passed through by lesson.py):
  - `opening`: `photo`, `label`, `title`, `subtitle`?
  - `index`: `label`, `title`?, `items`: `[["Title", "<marker>"], ...]` (numbered I., II., …)
  - `chapter`: `photo`, `number`, `title`
  - `numbers`: `label`, `title`, `items`: `[{ "n", "label", "at" }]`
  - `list`: `photo`, `side`: `"left"|"right"` (photo side), `label`, `title`, `items`: `[{ "title", "desc", "at", "icon" }]`
  - `quote`: `label`, `lines`: `[{ "text", "at" }]`, `photo`? (default `abstract`)
  - `chat`: `label`, `title`, `subtitle`?, `contact`?: `{ "name", "status" }`, `messages`: `[{ "from": "user"|"assistant"|"ok"|"team", "text", "at" }]`
  - `grid`: `label`, `title`, `items`: `[{ "title", "desc", "at", "icon" }]`, `highlight`?: `{ "text", "at" }`
  - `steps`: `label`, `title`, `items`: `[{ "title", "desc", "at" }]`
  - `plans`: `label`, `title`?, `items`: `[{ "name", "price", "desc", "at", "featured"? }]`, `badge`? ("Recommended"), `period`? ("/mo")
  - `recommend`: `label`, `title`, `question`: `{ "text", "at" }`, `items`: `[{ "profile", "plan", "at" }]`
  - `objection`: `n`, `question`, `answers`: `[{ "text", "at" }]`, `label`? ("Objection n"), `answerLabel`? ("How to answer")
  - `caveats`: `label`, `title`, `soon`: `{ "label"?, "items": [string], "at" }`, `careful`: `{ "label"?, "items": [{ "title", "desc", "at" }], "at" }`
  - `signoff`: `title`, `site`?, `cta`?, `photo`?
- Files: `timeline.json`, the chapter mp3s, `<photo>.jpg` for each photo field, `logo.svg` (theme.logo), the music file.

### VibeText* — `public/<slug>/`
- `vibe.json`: `{ "clip", "music", "block": [lines], "list": [lines], "listTimes": [s], "duration"? (default 10),
  "adjust"?: { "9:16"|"4:5"|"1:1": { "top"?, "fontSize"?, "focus"? } } }` — clip and music are files in the same folder.

## Motion templates

Three data-driven templates written for reelforge (no source equivalent as a generic composition). Same conventions as
above: props `{ slug, format }`, ids `<Name>` (1080x1920), `<Name>4x5` (1080x1350), `<Name>1x1` (1080x1080), duration
from `calculateMetadata`, placeholder card when `public/<slug>/<file>.json` is missing. Shared code: `src/videos/kit.tsx`.
Ready-to-render examples (no media at all): `examples/example-coffee/{motion-ad,retail-offers,app-showcase}/`,
`python3 scripts/example.py example-coffee/<template> [--format 9:16,1:1] [--render]`.

**Common fields**
- `theme`: `{ background, surface, text, textDim, accent, highlight, light, ink, display, body }` — merged over a neutral
  default. `light` = paper/cream background, `ink` = text on light backgrounds, `display`/`body` = font names:
  `Inter`, `Fraunces`, `Anton`, `DM Sans`, `Space Grotesk`, `Instrument Serif`, `Playfair Display`, `Poppins`,
  `Montserrat`, `Bricolage Grotesque`, and the monospace `JetBrains Mono`, `IBM Plex Mono` (unknown → Inter; add more in
  `FONTS` in kit.tsx).
- Backgrounds (`background`/`color`): `"dark" | "accent" | "light" | "highlight"` or any CSS color.
- `music`: `{ "file", "volume"?, "start"?, "beats"? }` — file in `public/<slug>/` (or `library/...`); beats from
  `<file minus extension>.beats.json` (`onsets`, `interval`, scripts/music_beats.py) unless `beats` names another file.
  No music / no beats file → fixed grid from `bpm`. Every scene lasts whole beats (`beats`) or `seconds`.
- Text: `"\n"` breaks lines; `*word*` = emphasis color (italic when the display font is a serif). Titles fit the width.
- Icons: Remix component names (`"RiCupLine"`) or aliases `coffee cup time timer walk phone cart bag store pin gift coupon
  percent star heart check bolt fire sparkle leaf cake food money truck chat bell download qr user calendar`.
- Missing media never breaks a render: no image/video → drawn fallback; no audio file → silent.

### MotionAd* — `public/<slug>/ad.json` (`videos/MotionAd.tsx`)
```
{ "theme"?, "locale"?: "en-US", "currency"?: "USD", "music"?, "bpm"?: 112, "beatsPerScene"?: 4, "sfx"?: false,
  "narration"?: { "file", "alignment", "highlights"?: [word] },        // word-synced captions (pill) until the end scene
  "scenes": [   // each: "background"?, "beats"? | "seconds"?, "word"? (narration word index it starts on), "burst"?: confetti|coins|icons|none
    { "type": "title",  "kicker"?, "text", "sub"?, "icon"? },
    { "type": "price",  "label"?, "from"?: 0, "to", "prefix"?, "suffix"?, "decimals"?, "currency"?, "was"?, "note"?, "icon"? },
    { "type": "list",   "title"?, "items": [{ "icon"?, "text" }] },     // one item per beat
    { "type": "cross",  "kicker"?, "text", "sub"? },                    // word struck through, then the twist
    { "type": "coupon", "kicker"?, "value", "code", "note"? },
    { "type": "scene",  "video"?, "image"?, "text"?, "focus"?, "icon"? }, // the single AI scene (fallback: brand gradient + icon)
    { "type": "end",    "title", "subtitle"?, "cta"?, "logo"?: "logo.svg", "name"?, "icon"? } ] } // wordmark when no logo file
```
Price: `prefix`/`suffix` → plain number; otherwise `currency` (scene or ad) formats it with Intl.
SFX (when `sfx` and the files exist): `library/sfx/whoosh.mp3` on each cut.

### RetailOffers* — `public/<slug>/offers.json` (`videos/RetailOffers.tsx`)
```
{ "theme"?, "store": { "name", "logo"?, "icon"? }, "title"?: "This week's\n*offers*", "validity"?, "currency"?: "$",
  "decimalSeparator"?: ".", "badge"?: "Special", "qr"?: { "image"?, "label"?, "text"? }, "outro"?: { "title"?, "text"? },
  "secondsPerOffer"?: 3.5, "bpm"?: 120, "music"?, "narration"?: { "file", "alignment"? }, "intro"?: { "beats"?|"seconds"? },
  "offers": [{ "name", "size"?, "price": 12.99 | "12.99", "was"?, "unit"?, "image"?, "icon"?, "color"?, "badge"?, "scale"?,
               "beats"?|"seconds"?, "word"? }] }
```
Opening (5 beats) → one offer per `secondsPerOffer` (rounded to beats) → closing card (7 beats). Header (store mark +
validity) and footer (QR + label/text; hidden in 1:1) stay inside a 12% margin. No `image` file → paper tile with the
product initial (or `icon`); no `qr.image` → QR icon tile; no `store.logo` → icon tile + name. With an alignment,
`word` pins an offer to the word that names it.

### AppShowcase* — `public/<slug>/showcase.json` (`videos/AppShowcase.tsx`)
```
{ "theme"?, "app": { "name", "tagline"?, "logo"?, "icon"? }, "music"?, "bpm"?: 128, "shotSeconds"?: 1.4,
  "shots": [   // each: "beats"? | "seconds"? (default: shotSeconds rounded to beats; logo/end twice that)
    { "type": "logo" },
    { "type": "title",  "text" },
    { "type": "screen", "screen"?: "<PHONE_SCREENS id>", "image"?, "props"?, "title"?, "tilt"?: left|right|none, "focus"?: top|center|bottom },
    { "type": "button", "text", "title"? },
    { "type": "orbit",  "screen"?, "image"?, "props"?, "icons"?: [icon], "title"? },
    { "type": "end",    "title"?, "subtitle"?, "cta"? } ] }
```
Screen content: registered component (`screen`), else `image` file, else a neutral skeleton UI in the theme colors.
New generic phone screens in `src/components/screens/` (also usable by UgcNarrated/Recorded):
- `"menu"`: `greeting`, `title`, `chips: [string]`, `items: [{ name, desc?, price, icon? }]`, `selected` (index), `button`.
- `"order-status"`: `title`, `item`, `place`, `eta` (min), `etaLabel`, `steps: [string]`.
- `"stamp-card"`: `title`, `stamps`, `total`, `reward`, `stampIcon` (Remix name).

### SystemExplainer — `public/<slug>/explainer.json` (`explainer/SystemExplainer.tsx`)
Internal explainer of a system/database architecture: one composition, 1920x1080, props `{ slug }`, **no voice**, big
caption bar, optional low music. Data model, auto-layout, link routing and timing in `explainer/layout.ts`. Example:
`examples/example-coffee/system-explainer/` (`python3 scripts/example.py example-coffee/system-explainer --render`).
```
{ "title"?: "Project name",                // top right of every scene
  "theme"?: { ...common theme, "mono"?: "JetBrains Mono", "card"?, "pk"?, "fk"?, "new"?, "changed"?, "removed"? },  // hex colors
  "labels"?: { "before", "after", "new", "changed", "removed", "kept", "more" },   // on-screen words (default English)
  "music"?: { "file", "volume"?: 0.15, "start"? },
  "maxRows"?: 7,                            // columns per card; beyond it the card shows "+ n more"
  "tables"?: [ table ],                     // shared definitions, referenced by id in the scenes
  "scenes": [   // each: "seconds"? (default: build time + ~2.4 s hold, or the captions' reading time), "caption"?: text | [text]
    { "type": "intro",       "title", "subtitle"?, "kicker"?, "stats"?: [{ "value", "label" }] },
    { "type": "tables",      "title", "tables": [ref], "links"?: [link], "autoLinks"?: true, "columns"? },
    { "type": "beforeAfter", "area", "before": [ref], "after": [ref], "merges"?: [{ "from": [id], "into": id }],
                             "links"?: [link], "autoLinks"?: true, "columns"?, "turn"? },
    { "type": "summary",     "title", "items": [text | { "text", "icon"? }] } ] }
```
- `table` = `{ "id", "name"? (default id), "icon"?, "status"?: "new"|"changed"|"removed"|"kept", "note"? (one short line),
  "x"?, "y"? (explicit top-left in the frame; otherwise auto-laid), "columns": [{ "name", "type"?, "pk"?, "fk"?: "table.column", "note"? }] }`.
  A column `note` (e.g. "free text") replaces the type, in the warning color. `ref` = an id from `tables` or an inline
  table (`{ "id": "orders", "status": "kept" }` overrides fields of the shared one).
- `link` = `{ "from": "table[.column]", "to": "table[.column]", "label"? }`. With `autoLinks` (default) every `fk` whose
  target is on screen draws a line too, from the FK row to the referenced row.
- **Layout**: cards share one width per scene and fill a grid (rows balanced, last row centered); `columns` forces the
  grid width. When the board does not fit, types are hidden first, then the board scales down. Lines run only through
  the gutters between cards (side → gutter → channel between rows → gutter → side), so they never cross a card;
  hand-placed (`x`,`y`) cards get a plain curve instead.
- **beforeAfter**: before cards on the left (header-only chips when they don't fit), after cards on the right
  (`status` defaults to `new`; use `kept` for tables already shown — dashed). The after side starts at caption `turn`
  (default 1 with 2+ captions). Each merge lights its sources and flies a copy of their name into the target just before
  it assembles; a source fully merged dims; a source with `status: "removed"` is struck through at the turn.
- **Captions**: `*emphasis*` in the highlight color, `` `code` `` in mono. Split over the scene by reading time
  (~1.3 s + 0.3 s/word, 2.6–5.6 s). Icons: Remix names or the kit aliases.

## Script outputs


**Alignment** (`*.alignment.json`, ElevenLabs forced alignment; read by every script): `{"words": [{"text", "start", "end"}], ...}`;
estimated ones add `"estimated": true`.

**Scribe transcript** (`transcript.json`, `*.transcript.json`): raw ElevenLabs output, `{"words": [{"text", "start", "end", "type"}], "language_code", "text"}`.

**beats.json**: `{"onsets": [s], "interval": s|null, "energy_per_s": [0–100]}`.

**narration.patched.json**: `{"segments": [{"file", "from", "to"|null, "at"}], "delta", "speech_end"}` — `from`/`to` = trim
inside the file, `at` = position on the timeline.

**edl.json** (recording.py → Recorded composition, check.py): `{"fps", "duration", "factor"? (speedup only),
"segments": [{"src_start", "src_end", "start", "end"}], "words": [{"i", "src_i", "text", "start", "end"}]}`.

**tutorial.json** (timeline.py): `{"title", "section", "narration": "narration.mp3", "alignment": "narration.alignment.json",
"steps": "steps.json", "screens": [{"png", "at"}], "cursor": [{"target", "at", "click"?}], "zoom": [{"target", "at", "scale"?, "focus"?}],
"highlights": [{"target", "from", "to"}]}`; word marker `{"w": index, "d"?: offset_s, "end"?: true}`.

**UgcNarrated `media/script.json`** (ugc_narrated.py): `{"persona", "narration", "alignment", "music", "scenes": [...], "overlays": [...],
"highlights": [words], "card": {"from", "title", "highlight", "subtitle"}, "duration", "opening"?: {"file": null, "start", "dur",
"continuation": {"file", "dur", "captions"}}, "store"?}`. Scene kinds: `{"shot", "from", "to", "start"?}` (shot `"name"` or
`"persona:name"`; `start` = offset into the shot), `{"screen", "background", "from", "to", "props"}`, `{"motion": {...}, "from", "to"}`.
In screen props any key ending in `W` holding a word index (or list) becomes the same key without `W`, in seconds since
the screen came in (e.g. `atW` → `at`). Overlays: `{"fromW", "toW", "items"?: [(name, text, wordIdx)]}` → `{"from", "to", "items": [{"name", "text", "at"}]}`.

**hook.json** (`media/hook.json`): `{"hook": id|null, "bridge", "why", "note"?, "continuation"?: {"file", "dur", "captions", "line"}}`.

**library/hooks/hooks.json**: `{"hooks": [{"id", "file", "start", "end", "theme", "description"?: {"action", "emotion", "impact_s", "metaphors": []}}]}`.

**library/personas/<p>/shots.json**: `{"shots": [{"id", "clip", "start", "end", "action", "framing"}]}` (scripts read `id`, `start`, `end`).

**batch.json**: `{"brand", "model", "usd_per_s", "max_usd_per_video", "language"?, "persona": {"image", "description", "setting", "voice"},
"videos": [{"id", "title", "approved", "takes": [{"id", "line", "action"?, "frame"?, "duration"?}]}]}`.
**costs.json**: `[{"date", "video", "take", "model", "seconds", "usd"}]`.

**image_openrouter / video_openrouter / heygen_speech stdout** (last line): `{"out", "cost_usd", "seconds"?}`.

**brands/<brand>/outliers.json** (config): `{"tiktok": {"hashtags", "searches"}, "instagram": {"hashtags", "searches"}, "min_views", "max_duration", "language"?}`.
**references/outliers/.../outliers.json** (output): `[{"platform", "url", "author", "followers", "views", "likes", "comments", "shares",
"duration", "date", "caption", "video_url", "factor", "engagement", "score", "class"?, "file"?}]`; classes `creator | tip | showcase | off`.

**<video>.breakdown.json**: `{"hook": {"speech", "on_screen_text", "visual", "type", "why_it_hooks"}, "format", "who_speaks",
"takes": [{"start", "end", "framing", "action", "speech", "on_screen_text"}], "pacing": {"duration_s", "takes", "avg_take_s",
"words_per_s", "music", "captions"}, "script", "cta", "why_it_works": [], "weaknesses": [], "template", "adaptation"?, "_model", "_cost_usd"}`.

**analysis.json**: `{"video", "duration", "resolution", "cuts", "cuts_per_min", "avg_shot_s", "longest_shot_s", "language", "words", "words_per_s", "text"}`.

**radar history.json**: `{"owner/repo": {"stars", "when"}}`.

**Elegant `script.json`** (fields the script reads; the rest is the Remotion schema): `"narration"` (default `narration.mp3`),
`"alignment"` (default `alignment.json`), `"music": {"file"}`, `"theme": {"logo"}`.
Publish writes `remotion/out/pub-<slug>/props.json` = `{"slug"}`.

**Lesson `script.json`** (input): `{"title", "brand", "voice": {"id", "model", "stability", "pronunciation"}, "music": {"file", ...},
"chapters": [{"id", "scenes": [{"type" ("chapter" for the chapter card), "text" (with {marker}s), ...visual fields with "at": "marker"}]}]}`.
**Lesson `timeline.json`** (output, read by `Lesson`): `{"duration", "title", "audios": [{"file", "at", "to"?, "from"?}],
"music": {..., "duration"}|null, "words": [{"text", "start", "end"}], "scenes": [{...scene fields, "start", "speechEnd",
"marks": {name: s}, "chapter", "from", "to"}]}`.

**brand.md** sections the scripts read: `## Essence` and `## Audience…` (breakdown.py), the `**Who it's for**` line (outliers.py).
