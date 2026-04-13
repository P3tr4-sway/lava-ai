# io

Persistence and interop.

- `json.ts` — AST ↔ JSON serialization; auto-save (localStorage, 10s) + manual save (Cmd+S → .json download).
- `gp-import.ts` — .gp/.gp5/.gpx/.gp7 → alphaTab Score → alphaTex → AST (read-only, Phase 9).
- `midi-export.ts` — Uses alphaTab's MIDI export API (Phase 9).
