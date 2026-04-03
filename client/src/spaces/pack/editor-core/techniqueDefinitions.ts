export interface TechniqueParamDef {
  key: string
  kind: 'select' | 'number'
  options?: string[]
  min?: number
  max?: number
  step?: number
  default: string | number
}

export interface TechniqueDef {
  type: string
  label: string
  icon: string
  group: string
  params: TechniqueParamDef[]
}

export const GROUP_LABELS: Record<string, string> = {
  bend: 'Bend',
  slide: 'Slide',
  legato: 'Legato',
  mute: 'Mute',
  harmonic: 'Harmonic',
  expression: 'Expression',
  tremolo: 'Tremolo',
  stroke: 'Stroke',
  articulation: 'Articulation',
  sustain: 'Sustain',
}

export const TECHNIQUE_DEFS: TechniqueDef[] = [
  { type: 'bend', label: 'Bend', icon: 'ArrowUpFromLine', group: 'bend', params: [
    { key: 'style', kind: 'select', options: ['full', 'half', 'pre-bend', 'bend-release'], default: 'full' },
    { key: 'semitones', kind: 'number', min: 0.5, max: 4, step: 0.5, default: 2 },
  ]},
  { type: 'slide', label: 'Slide', icon: 'MoveRight', group: 'slide', params: [
    { key: 'style', kind: 'select', options: ['shift', 'legato', 'in-above', 'in-below', 'out-up', 'out-down'], default: 'shift' },
  ]},
  { type: 'hammerOn', label: 'Hammer-On', icon: 'ArrowDown', group: 'legato', params: [] },
  { type: 'pullOff', label: 'Pull-Off', icon: 'ArrowUp', group: 'legato', params: [] },
  { type: 'tap', label: 'Tapping', icon: 'Hand', group: 'legato', params: [] },
  { type: 'ghostNote', label: 'Ghost Note', icon: 'Parentheses', group: 'mute', params: [] },
  { type: 'deadNote', label: 'Dead Note', icon: 'X', group: 'mute', params: [] },
  { type: 'palmMute', label: 'Palm Mute', icon: 'HandMetal', group: 'mute', params: [] },
  { type: 'harmonic', label: 'Harmonic', icon: 'Sparkles', group: 'harmonic', params: [
    { key: 'style', kind: 'select', options: ['natural', 'pinch', 'tap', 'artificial'], default: 'natural' },
  ]},
  { type: 'vibrato', label: 'Vibrato', icon: 'Activity', group: 'expression', params: [
    { key: 'style', kind: 'select', options: ['normal', 'wide'], default: 'normal' },
  ]},
  { type: 'tremoloPicking', label: 'Tremolo Pick', icon: 'Zap', group: 'tremolo', params: [
    { key: 'speed', kind: 'select', options: ['eighth', 'sixteenth', 'thirtySecond'], default: 'sixteenth' },
  ]},
  { type: 'tremoloBar', label: 'Tremolo Bar', icon: 'TrendingDown', group: 'tremolo', params: [
    { key: 'semitones', kind: 'number', min: 0.5, max: 12, step: 0.5, default: 2 },
  ]},
  { type: 'pickStroke', label: 'Pick Stroke', icon: 'ChevronsUp', group: 'stroke', params: [
    { key: 'direction', kind: 'select', options: ['up', 'down'], default: 'down' },
  ]},
  { type: 'arpeggio', label: 'Arpeggio', icon: 'ListMusic', group: 'stroke', params: [
    { key: 'direction', kind: 'select', options: ['up', 'down'], default: 'up' },
  ]},
  { type: 'accent', label: 'Accent', icon: 'ChevronUp', group: 'articulation', params: [
    { key: 'style', kind: 'select', options: ['normal', 'heavy'], default: 'normal' },
  ]},
  { type: 'staccato', label: 'Staccato', icon: 'Circle', group: 'articulation', params: [] },
  { type: 'tenuto', label: 'Tenuto', icon: 'Minus', group: 'articulation', params: [] },
  { type: 'letRing', label: 'Let Ring', icon: 'BellRing', group: 'sustain', params: [] },
  { type: 'fadeIn', label: 'Fade In', icon: 'Volume1', group: 'sustain', params: [] },
]
