# Contributing

Thanks for helping. A few rules keep the repo small and safe:

- **Text only.** Code, `.md` and `.json`. Never commit media (mp3, mp4, png, jpg, fonts, pdf…) — `.gitignore`
  blocks it by extension; don't `git add -f` around it. Example assets that need media should be generated or
  downloaded by a script.
- **No secrets, no private data.** Keys stay in `.env`. No real customer data, real people's faces or third-party
  reference videos in commits or screenshots.
- **English everywhere** in code, CLI help and docs. Narration language is a per-brand setting.
- **Spending stays opt-in.** Any script that calls a paid generation API must print an estimate and require
  `--confirm` (or an explicit approval step) before it spends.
- **New style?** Add `.claude/skills/<style>/SKILL.md` (frontmatter `name` = folder name, a description that says when
  to use it), a generic composition in `remotion/` fed by JSON with `{slug, format}` props, and ideally an example
  under `examples/example-coffee/<style>/`. Add it to the styles tables in `CLAUDE.md` and `README.md`.
- **Scripts**: Python 3.10+, standard library where possible, `--help` that shows real usage, paths relative to the
  repo root.
- Before opening a PR: run the script's `--help`, render the affected example or composition, and run the output
  through `scripts/check.py`.
