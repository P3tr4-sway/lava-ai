# render

Render Adapter — bridges the editor core to alphaTab.

- `alphaTabBridge.ts` — Singleton wrapper: `renderAst(ast)` calls `printer(ast)` → `api.tex(text)`. Exposes `onReady`, `onBeatClick`, `getBoundingBoxLookup()`.
- `overlayLayer.ts` — SVG overlay logic: maps Selection → screen rects via boundsLookup.
