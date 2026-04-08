# editor/ast

AlphaTex AST — TypeScript node types, recursive-descent parser, and printer.

- `types.ts` — All AST node interfaces; every node has a stable `id: string` (nanoid).
- `parser.ts` — Tokenizer + recursive-descent parser: alphaTex string → `ScoreNode`.
- `printer.ts` — AST printer: `ScoreNode` → alphaTex string. Invariant: `parse(print(ast)) ≡ ast`.
