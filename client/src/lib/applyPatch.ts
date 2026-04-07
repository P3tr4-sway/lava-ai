import type { ScorePatch } from '@lava/shared'

/**
 * Apply a single ScorePatch to a MusicXML string.
 *
 * NOTE: All editing operations have been migrated to the ScoreDocument command
 * system (`useScoreDocumentStore.getState().applyCommand()`). This function
 * is kept as a no-op stub so that any callers still compile; it should be
 * removed once all call sites are eliminated.
 */
export function applyPatch(xml: string, _patch: ScorePatch): string {
  console.warn('[applyPatch] applyPatch is deprecated — use applyCommand() instead.')
  return xml
}
