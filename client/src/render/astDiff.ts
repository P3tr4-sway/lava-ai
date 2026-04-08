/**
 * astDiff — computes which bars changed between two AST snapshots.
 *
 * Pure function, no side effects.
 * O(N) in the number of bars.
 */

import type { ScoreNode, BarNode, MetaNode, TrackNode } from '../editor/ast/types'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AstDiff {
  /** Bar IDs that were added, removed, or had their content changed */
  changedBarIds: string[]
  /** Whether the score metadata (tempo, time sig, etc.) changed */
  metaChanged: boolean
  /** Whether track-level properties (tuning, capo, instrument) changed */
  tracksChanged: boolean
  /** Whether the change requires a full re-render (new track, meta change, etc.) */
  requiresFullRender: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Serialize MetaNode to a stable string for comparison.
 */
function serializeMeta(meta: MetaNode): string {
  return JSON.stringify({
    title: meta.title ?? '',
    subtitle: meta.subtitle ?? '',
    artist: meta.artist ?? '',
    album: meta.album ?? '',
    words: meta.words ?? '',
    music: meta.music ?? '',
    copyright: meta.copyright ?? '',
    tab: meta.tab ?? '',
    tempo: meta.tempo,
    tempoLabel: meta.tempoLabel ?? '',
  })
}

/**
 * Serialize track-level properties (excluding bars/staves content).
 */
function serializeTrackMeta(track: TrackNode): string {
  return JSON.stringify({
    name: track.name,
    shortName: track.shortName ?? '',
    color: track.color ?? '',
    solo: track.solo ?? false,
    mute: track.mute ?? false,
    volume: track.volume ?? 8,
    balance: track.balance ?? 8,
    instrument: track.instrument,
    tuning: track.tuning,
    capo: track.capo,
    displayTranspose: track.displayTranspose ?? 0,
    transpose: track.transpose ?? 0,
    chordDefs: track.chordDefs,
  })
}

/**
 * Serialize a single BarNode to a stable string for content comparison.
 * We JSON.stringify the bar but omit the top-level `id` so only content matters.
 */
function serializeBar(bar: BarNode): string {
  // Destructure out `id` so IDs don't affect the content hash
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, ...rest } = bar
  return JSON.stringify(rest)
}

/**
 * Build a Map<barId, serializedContent> for all bars across all tracks/staves.
 * Also returns total bar count for the threshold check.
 */
function buildBarMap(score: ScoreNode): { map: Map<string, string>; count: number } {
  const map = new Map<string, string>()
  for (const track of score.tracks) {
    for (const staff of track.staves) {
      for (const bar of staff.bars) {
        map.set(bar.id, serializeBar(bar))
      }
    }
  }
  return { map, count: map.size }
}

// ---------------------------------------------------------------------------
// diffAst
// ---------------------------------------------------------------------------

/**
 * Diff two ScoreNode snapshots.
 * Uses bar IDs for stable identity (nanoid-generated, never change).
 * O(N) in the number of bars.
 */
export function diffAst(prev: ScoreNode, next: ScoreNode): AstDiff {
  // ---- Meta comparison ----
  const metaChanged = serializeMeta(prev.meta) !== serializeMeta(next.meta)

  // ---- Track-level comparison ----
  let tracksChanged = prev.tracks.length !== next.tracks.length

  if (!tracksChanged) {
    for (let i = 0; i < prev.tracks.length; i++) {
      if (serializeTrackMeta(prev.tracks[i]) !== serializeTrackMeta(next.tracks[i])) {
        tracksChanged = true
        break
      }
    }
  }

  // ---- Bar content comparison ----
  const { map: prevMap, count: prevCount } = buildBarMap(prev)
  const { map: nextMap } = buildBarMap(next)

  const changedBarIds: string[] = []

  // Check all bars in next: new bars or changed bars
  for (const [barId, nextContent] of nextMap) {
    const prevContent = prevMap.get(barId)
    if (prevContent === undefined || prevContent !== nextContent) {
      changedBarIds.push(barId)
    }
  }

  // Check bars that were removed (present in prev but not next)
  for (const barId of prevMap.keys()) {
    if (!nextMap.has(barId)) {
      changedBarIds.push(barId)
    }
  }

  // ---- requiresFullRender heuristic ----
  // Full render if: meta changed, tracks changed, or >50% of bars changed
  const threshold = prevCount > 0 ? prevCount * 0.5 : 0
  const requiresFullRender =
    metaChanged ||
    tracksChanged ||
    changedBarIds.length > threshold

  return {
    changedBarIds,
    metaChanged,
    tracksChanged,
    requiresFullRender,
  }
}
