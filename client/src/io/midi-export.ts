/**
 * MIDI export via alphaTab's MidiFileGenerator.
 *
 * alphaTab 1.8.1 ships MidiFileGenerator + MidiFile in the `midi` namespace.
 * MidiFile.toBinary() returns a Uint8Array that we wrap in a Blob and download.
 *
 * Usage:
 *   import { exportMidi } from '@/io/midi-export'
 *   await exportMidi(bridge, 'my-song')
 */

import type { AlphaTabBridge } from '../render/alphaTabBridge'

// ---------------------------------------------------------------------------
// Lazy import — keep alphaTab out of the initial bundle chunk
// ---------------------------------------------------------------------------

async function getAlphaTab() {
  return import('@coderline/alphatab')
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Export the current score as a MIDI file and trigger a browser download.
 *
 * Reads the live alphaTab Score object from the bridge's AlphaTabApi instance,
 * runs it through MidiFileGenerator, serialises with MidiFile.toBinary(), and
 * downloads the result as a .mid file.
 *
 * Throws if the bridge is not initialised or has no score loaded.
 */
export async function exportMidi(bridge: AlphaTabBridge, filename?: string): Promise<void> {
  const api = bridge.getApi()
  if (!api) {
    throw new Error('[lava-tab] exportMidi: AlphaTabBridge is not initialised')
  }

  // AlphaTabApi exposes `score` as a public property in 1.8.1.
  const score = (api as unknown as Record<string, unknown>)['score']
  if (!score) {
    throw new Error('[lava-tab] exportMidi: no score is loaded in the bridge')
  }

  const at = await getAlphaTab()

  // Build the MIDI file using alphaTab's generator.
  // We cast through `unknown` to avoid fighting the alphaTab type system —
  // Settings lives at the top-level namespace, not inside `model`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MidiFile = (at as any).midi.MidiFile
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MidiFileGenerator = (at as any).midi.MidiFileGenerator
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const AlphaSynthMidiFileHandler = (at as any).midi.AlphaSynthMidiFileHandler
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Settings = (at as any).Settings

  const midiFile = new MidiFile()
  const settings = new Settings()
  const handler = new AlphaSynthMidiFileHandler(midiFile)
  const generator = new MidiFileGenerator(score, settings, handler)
  generator.generate()

  // Serialise to binary — toBinary() returns Uint8Array
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bytes: Uint8Array = (midiFile as any).toBinary()

  // Copy to a fresh ArrayBuffer to avoid SharedArrayBuffer typing issues
  const arrayBuffer = bytes.buffer instanceof ArrayBuffer
    ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    : new Uint8Array(bytes).buffer

  const blob = new Blob([arrayBuffer], { type: 'audio/midi' })

  // Download
  const title = (score as Record<string, unknown>)['title'] as string | undefined
  const safeName = (filename ?? title ?? 'untitled').replace(/[^\w\-.]/g, '_')
  const finalName = safeName.endsWith('.mid') ? safeName : `${safeName}.mid`

  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = finalName
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)

  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
