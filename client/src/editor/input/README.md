# editor/input

Input state machine (XState v5). States: `idle` | `inserting` | `selecting`.

- `InputMachine.ts` — Handles keydown, mousedown, mousemove, mouseup, blur. Key mappings match Guitar Pro conventions (digits 0–9 for frets, Q–Y for durations, H/P/S/B/V for techniques).
