/**
 * AST ↔ JSON serialization + localStorage auto-save.
 *
 * Functions:
 *   serializeAst   — ScoreNode → JSON string (pretty-printed)
 *   deserializeAst — JSON string → ScoreNode (throws on invalid)
 *   autoSave       — save to localStorage
 *   loadAutoSave   — load from localStorage (null if none)
 *   downloadAst    — trigger browser download of .json file
 *   loadAstFromFile — parse a .json File → ScoreNode
 */

import type { ScoreNode } from '../editor/ast/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const AUTOSAVE_KEY = 'lava-tab-editor-autosave'
export const AUTOSAVE_INTERVAL_MS = 10_000

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function isValidScoreNode(value: unknown): value is ScoreNode {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.id === 'string' &&
    typeof obj.meta === 'object' &&
    obj.meta !== null &&
    Array.isArray(obj.tracks)
  )
}

// ---------------------------------------------------------------------------
// Core serialization
// ---------------------------------------------------------------------------

/**
 * Serialize the AST to a JSON string (pretty-printed for readability).
 */
export function serializeAst(ast: ScoreNode): string {
  return JSON.stringify(ast, null, 2)
}

/**
 * Deserialize a JSON string back to ScoreNode.
 * Throws on invalid JSON or invalid structure.
 */
export function deserializeAst(json: string): ScoreNode {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch (err) {
    throw new Error(`[lava-tab] deserializeAst: invalid JSON — ${(err as Error).message}`)
  }
  if (!isValidScoreNode(parsed)) {
    throw new Error('[lava-tab] deserializeAst: parsed value is not a valid ScoreNode')
  }
  return parsed
}

// ---------------------------------------------------------------------------
// localStorage auto-save
// ---------------------------------------------------------------------------

/**
 * Save AST to localStorage. Silent on failure (storage quota, etc.).
 */
export function autoSave(ast: ScoreNode): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY, serializeAst(ast))
  } catch (err) {
    console.warn('[lava-tab] autoSave: localStorage write failed', err)
  }
}

/**
 * Load last auto-saved AST from localStorage.
 * Returns null if nothing is saved or the saved data is invalid.
 */
export function loadAutoSave(): ScoreNode | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY)
    if (!raw) return null
    return deserializeAst(raw)
  } catch (err) {
    console.warn('[lava-tab] loadAutoSave: could not restore saved state', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// File download
// ---------------------------------------------------------------------------

/**
 * Trigger browser download of the AST as a .json file.
 */
export function downloadAst(ast: ScoreNode, filename?: string): void {
  const title = ast.meta.title ?? 'untitled'
  const safeName = (filename ?? `${title}.lava-tab`).replace(/[^\w\-.]/g, '_')
  const finalName = safeName.endsWith('.json') ? safeName : `${safeName}.json`

  const blob = new Blob([serializeAst(ast)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = finalName
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)

  // Revoke after a tick to let the browser finish the download
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ---------------------------------------------------------------------------
// File import
// ---------------------------------------------------------------------------

/**
 * Parse a .json file selected by the user and return the AST.
 * Rejects if the file cannot be read or has an invalid structure.
 */
export async function loadAstFromFile(file: File): Promise<ScoreNode> {
  const text = await file.text()
  return deserializeAst(text)
}
