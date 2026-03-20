import * as Tone from 'tone'
import {
  METRONOME_FREQ_BAR,
  METRONOME_FREQ_BEAT,
  METRONOME_DECAY_SEC,
} from './constants'

/**
 * Metronome built on Tone.js Transport scheduling.
 *
 * Replaces the older MetronomeScheduler / Scheduler / Metronome classes
 * which relied on raw Web Audio + setInterval timing.  ToneMetronome
 * delegates timing to `Tone.getTransport().scheduleRepeat()` so clicks
 * stay locked to the Transport clock and automatically follow BPM changes.
 */
export class ToneMetronome {
  private enabled = false
  private beatsPerBar: number
  private bpm: number
  private beatCount = 0
  private scheduleId: number | null = null

  /** Reusable synths — one per pitch so we avoid per-tick allocation. */
  private downbeatSynth: Tone.Synth
  private beatSynth: Tone.Synth

  constructor(beatsPerBar = 4, bpm = 120) {
    this.beatsPerBar = beatsPerBar
    this.bpm = bpm

    const envelope: Partial<Tone.EnvelopeOptions> = {
      attack: 0.001,
      decay: METRONOME_DECAY_SEC,
      sustain: 0,
      release: 0.01,
    }

    this.downbeatSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope,
      volume: Tone.gainToDb(0.5),
    }).toDestination()

    this.beatSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope,
      volume: Tone.gainToDb(0.3),
    }).toDestination()
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Begin scheduling metronome clicks on the Transport.
   *
   * @param fromBar  – the bar number to start from (used to seed the beat counter)
   * @param beatsPerBar – optionally override the beats-per-bar value
   */
  start(fromBar: number, beatsPerBar?: number): void {
    // Clean up any previous schedule
    this.clearSchedule()

    if (beatsPerBar !== undefined) {
      this.beatsPerBar = beatsPerBar
    }

    this.beatCount = Math.round(fromBar * this.beatsPerBar)

    const transport = Tone.getTransport()

    // Schedule a repeating callback every quarter note.
    // '4n' is BPM-aware — when Transport.bpm changes the interval adapts.
    this.scheduleId = transport.scheduleRepeat(
      (time: number) => {
        this.onTick(time)
      },
      '4n',
    )
  }

  /** Stop the metronome and clear the scheduled repeat. */
  stop(): void {
    this.clearSchedule()
    this.beatCount = 0
  }

  /** Toggle whether clicks produce audible sound. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  /**
   * Store the BPM value locally.
   *
   * Tone.Transport.bpm is managed externally (by ToneEngine / AudioController),
   * so this only keeps the internal bookkeeping in sync.
   */
  setBpm(bpm: number): void {
    this.bpm = bpm
  }

  /** Update the beats-per-bar value used for downbeat detection. */
  setBeatsPerBar(beatsPerBar: number): void {
    this.beatsPerBar = beatsPerBar
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  /** Called by the Transport on every quarter-note boundary. */
  private onTick(time: number): void {
    if (this.enabled) {
      const isDownbeat = this.beatCount % this.beatsPerBar === 0
      if (isDownbeat) {
        this.downbeatSynth.triggerAttackRelease(
          METRONOME_FREQ_BAR,
          METRONOME_DECAY_SEC,
          time,
        )
      } else {
        this.beatSynth.triggerAttackRelease(
          METRONOME_FREQ_BEAT,
          METRONOME_DECAY_SEC,
          time,
        )
      }
    }

    this.beatCount++
  }

  /** Clear the Transport schedule if one exists. */
  private clearSchedule(): void {
    if (this.scheduleId !== null) {
      Tone.getTransport().clear(this.scheduleId)
      this.scheduleId = null
    }
  }
}
