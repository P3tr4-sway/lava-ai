# editor/selection

Cursor and selection model — independent of the renderer.

- `SelectionModel.ts` — `Cursor` type, `Selection` union (`caret` | `range`). Navigation: `moveLeft/Right/Up/Down`, `moveToNextBar`, `selectToRight`, `clearToCaret`.
