# editor/validation

Business rules for the score. All rules are pure functions with no side effects.

- `rules.ts` — Bar duration capacity check, tuplet validity, time signature constraints. Returns `ValidationResult[]` — never throws.
