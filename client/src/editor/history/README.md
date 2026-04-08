# editor/history

Undo/Redo stack built on command inversion.

- `History.ts` — `push(cmd)`, `undo()`, `redo()`. Consecutive same-type commands within a time window are merged into a `CompositeCommand`. Stack depth capped at 500.
