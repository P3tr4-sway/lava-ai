export interface EffectsPreset {
  id: string
  name: string
  style: string
  description: string
  chain: string[]
}

export const EFFECTS_PRESETS: EffectsPreset[] = [
  {
    id: 'blues-crunch',
    name: 'Blues Crunch',
    style: 'Blues',
    description: 'Warm breakup with spring space for expressive lead work.',
    chain: ['tube-808', 'ma-jmp-50', 'ma-412-v2', 'spring-reverb'],
  },
  {
    id: 'clean-jazz',
    name: 'Clean Jazz',
    style: 'Jazz',
    description: 'Round clean tone with chorus and tape depth for comping.',
    chain: ['studio-comp', 'clean-amp', 'chorus', 'tape-delay'],
  },
  {
    id: 'metal-tone',
    name: 'Metal Tone',
    style: 'Metal',
    description: 'High-gain stack focused on tight attack and sustain.',
    chain: ['heavy-metal', 'ma-jmp-50', 'ma-412-v2'],
  },
  {
    id: 'ambient-shimmer',
    name: 'Ambient Shimmer',
    style: 'Ambient',
    description: 'Wide modulated tail for spacious chords and textures.',
    chain: ['chorus', 'tape-delay', 'bright-reverb'],
  },
]
