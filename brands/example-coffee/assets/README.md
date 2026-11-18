# Assets (not in git)

Media is never committed. Create these locally before rendering:

- `persona.png` — generate once from the appearance prompt in `../brand.md`:
  `python3 scripts/image_openrouter.py --prompt "<appearance + setting>" --out brands/example-coffee/assets/persona.png`
- `logo.png` / `logo-dark.png` — any transparent PNG works for testing.
