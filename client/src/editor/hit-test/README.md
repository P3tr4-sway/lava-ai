# editor/hit-test

Coordinate → AST position resolution using alphaTab's `boundsLookup`.

- `hitTest.ts` — Input: mouse `(x, y)`. Output: `{ trackId, barId, beatId, stringIndex } | null`. Falls back to nearest-beat heuristic for empty areas.
