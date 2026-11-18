---
name: system-explainer
description: Produces an internal explainer video of a system or database architecture (16:9, no voice, big captions, low music) — database tables that assemble as cards with PK/FK badges, before → after per area, relationship lines drawing between cards, old tables flying into the new one. Use for "explain the database", "architecture video", "before and after of the system", "redesign explainer", "walk the team through the new schema", "show the migration". AI cost is zero.
---

# System explainer (motion graphics, no voice)

Template: the **`SystemExplainer`** composition (1920x1080, props `{slug}`), data in
`remotion/public/<slug>/explainer.json`. Schema: `docs/data-formats.md → SystemExplainer`. Free example (a fictional
coffee shop moving from two spreadsheets to five tables):
`python3 scripts/example.py example-coffee/system-explainer --render` (source in
`examples/example-coffee/system-explainer/`). Pure Remotion: AI cost is zero; music optional.

Audience: the owner, the team, a new developer. It replaces a meeting with a 1–3 minute video they can rewatch, so
the captions carry the whole message — there is no narration.

## 1. Read the real schema (structure only)
Find the source of truth and read it, don't guess:
- **Migrations** (`migrations/`, `db/migrate/`, `prisma/migrations/`, `alembic/versions/`, `supabase/migrations/`):
  replay them in order — the last `ALTER` wins.
- **ORM models** (Prisma `schema.prisma`, Django `models.py`, SQLAlchemy, TypeORM/Sequelize entities, Rails
  `schema.rb`, Ecto schemas): `@id`/`primary_key` → `pk`, `ForeignKey`/`@relation`/`references`/`belongs_to` → `fk:
  "table.column"`.
- **SQL dump / DDL** (`pg_dump --schema-only`, `SHOW CREATE TABLE`): `PRIMARY KEY`, `REFERENCES t(col)`.
- **A redesign doc / proposal**: the "after" side. If there is no written proposal, ask what changes — never invent a
  target schema and present it as the plan.
Write down per area: tables today, tables proposed, which old tables feed which new one (`merges`), what is removed.

## 2. What to show (pick, don't dump)
- **3–6 columns per card**: the PK, the FKs, and the 1–3 columns that tell the story (the one that was free text, the
  one that moves). Everything else → leave out (or let `maxRows` show "+ n more"). Use `type` for short types (`uuid`,
  `text`, `money`, `time`); use a column `note` (≤ 2 words: "free text", "copy", "retyped") for the problem.
- **≤ 6 cards per screen**, ≤ 5 on the "after" side of a `beforeAfter`. More than that: split the area into two scenes.
- One `beforeAfter` per area of the system (customers, billing, catalog…). `status`: `new` (default on the after side),
  `changed`, `removed` (struck through at the turn), `kept` (dashed — "already shown"; use it to put context tables
  next to the new ones so their lines have somewhere to go).
- Close with a `tables` scene of the whole new picture (FK lines everywhere) and a `summary` of what changes for people.
- Order cards so related tables are neighbours (same row): the line between neighbours is a short curve; others go
  around through the gutters.

## 3. Script = explainer.json
Write it directly (it is the script); mirror it in `script.md` only if the user wants to review in prose.
- `intro`: title + subtitle + up to 3 `stats` ("2 → 5" tables, "5" relationships).
- `tables`: "today" (the current mess) and "the whole picture" at the end.
- `beforeAfter`: first caption(s) describe the problem, the caption at `turn` (default the 2nd) starts the after side.
- `summary`: 3–5 items, one line each.

## 4. Pacing and captions
- ~4–6 s per scene of reading; scenes with many cards take longer on their own (each card ~0.7–1.2 s to assemble
  plus a ~2.4 s hold with everything visible). Leave `seconds` out unless you need a fixed length.
- Captions: **one idea, ≤ 12 words**, 2–3 per scene. `*emphasis*` for the key word, `` `code` `` for a table or column
  name. A 3-minute video is ~12–15 scenes; 1–2 minutes is usually enough.
- Music: low (`volume` 0.12–0.18), calm, no drops. Optional.

## 5. Theme and labels
Neutral dark default. For a brand, set `theme` from `brand.md → Visual identity` (hex colors; `display`/`body` from the
kit font list, `mono`: `JetBrains Mono` or `IBM Plex Mono`). On-screen words (`BEFORE`, `NEW`, `+ n more`) come from
`labels` — translate them for a non-English team.

## 6. Render and check
```bash
mkdir -p remotion/public/<slug> && cp explainer.json remotion/public/<slug>/
cd remotion && npx remotion render src/index.ts SystemExplainer ../videos/<brand>/<job>/final.mp4 --props '{"slug":"<slug>"}'
ffmpeg -i final.mp4 -vf "fps=1/4,scale=640:-1,tile=4x3" -frames:v 1 sheet.png   # contact sheet
```
Look at a frame at the **end of every scene** (everything assembled) and one mid-animation: names cut off, cards
going below y≈880 (the caption bar starts at 906), lines crossing a card (only possible with hand-placed `x`/`y`), a
label sitting on a card, empty frames. Run `scripts/check.py` when there is music.

## Safety
- **Structure only.** Table and column names, types and relationships — never rows, never real values (no customer
  names, e-mails, phone numbers, IDs, amounts), never connection strings, hosts, keys or `.env` contents. If an example
  row helps, invent an obviously fake one.
- Don't put security-sensitive structure on screen when the video may leave the team (auth/token tables, internal
  admin flags); ask first.
- Only describe a target schema the user confirmed; mark proposals as proposals in the captions.
