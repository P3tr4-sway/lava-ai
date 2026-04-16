/**
 * Barrel export for all editor commands.
 * @module commands
 */

export type { Command, CommandContext, CommandResult, Json } from './Command'

export { InsertNote, DeleteNote, SetFret, SetString } from './noteCommands'

export {
  InsertBeat,
  DeleteBeat,
  SetDuration,
  ToggleDot,
  SetTuplet,
  SetRest,
  makeBeatLoc,
  currentBeatDuration,
} from './beatCommands'

export {
  InsertBar,
  DeleteBar,
  ClearBar,
  SetTimeSignature,
  SetKeySignature,
  SetBarTempo,
  SetRepeat,
} from './barCommands'

export {
  InsertTrack,
  DeleteTrack,
  SetTuning,
  SetCapo,
  RenameTrack,
} from './trackCommands'

export {
  SetHammerOn,
  SetPullOff,
  SetSlide,
  SetBend,
  SetVibrato,
  SetHarmonic,
  SetTie,
  SetGhost,
  SetDeadNote,
  SetTap,
  SetPalmMute,
  SetLetRing,
  SetAccent,
  SetStroke,
  SetDynamics,
  SetStaccato,
  SetSlur,
  SetTrill,
  SetOrnament,
  SetCrescendo,
  SetDecrescendo,
  SetArpeggio,
  SetBrush,
  SetFade,
  SetTremoloPicking,
  SetFermata,
} from './techniqueCommands'
export type { FadeType, FermataValue } from './techniqueCommands'

export {
  BulkTranspose,
  BulkShiftString,
  DeleteSelection,
  BulkSetDuration,
  CopySelection,
  PasteSelection,
} from './selectionCommands'

export type { BeatRef, BeatDurationEntry } from './selectionCommands'

export { SetMeta } from './metaCommands'
export type { MetaPatch } from './metaCommands'

export { CompositeCommand } from '../history/History'
