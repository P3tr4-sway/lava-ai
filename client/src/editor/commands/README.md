# editor/commands

All AST mutations go through `Command` objects. UI components are forbidden from directly writing to AST nodes.

- `Command.ts` — Base interface: `execute`, `invert`, `serialize`, `affectedBarIds`.
- `*.ts` — One file per command group (note, beat, bar, track, technique, selection, meta).
