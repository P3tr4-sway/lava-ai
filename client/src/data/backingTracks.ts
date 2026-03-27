export interface BackingTrackAsset {
  id: string
  title: string
  style: string
  bpm: number
  key: string
  gradient: string
  description: string
}

export const BACKING_TRACKS: BackingTrackAsset[] = [
  {
    id: '1',
    title: 'Midnight Blues Groove',
    style: 'Blues',
    bpm: 85,
    key: 'Am',
    gradient: 'from-indigo-600 to-slate-900',
    description: 'Loose pocket with space for phrasing and bends.',
  },
  {
    id: '2',
    title: 'Funk City Jam',
    style: 'Funk',
    bpm: 110,
    key: 'E',
    gradient: 'from-orange-500 to-rose-700',
    description: 'Tight syncopation for groove practice and muting.',
  },
  {
    id: '3',
    title: 'Smooth Jazz Vibes',
    style: 'Jazz',
    bpm: 72,
    key: 'Dm',
    gradient: 'from-teal-500 to-blue-800',
    description: 'Slow harmonic movement for comping and lines.',
  },
  {
    id: '4',
    title: 'Rock Anthem',
    style: 'Rock',
    bpm: 130,
    key: 'G',
    gradient: 'from-red-600 to-stone-900',
    description: 'Big eighth-note drive for rhythm consistency.',
  },
  {
    id: '5',
    title: 'Lo-fi Chill Session',
    style: 'Lo-fi',
    bpm: 78,
    key: 'C',
    gradient: 'from-violet-500 to-indigo-800',
    description: 'Relaxed loop for pocket, timing, and tone work.',
  },
  {
    id: '6',
    title: 'Latin Fiesta',
    style: 'Latin',
    bpm: 105,
    key: 'Bm',
    gradient: 'from-amber-500 to-red-700',
    description: 'Percussive feel focused on rhythmic articulation.',
  },
  {
    id: '7',
    title: 'R&B Slow Burn',
    style: 'R&B',
    bpm: 68,
    key: 'F',
    gradient: 'from-pink-500 to-purple-800',
    description: 'Warm slow groove with room for melodic fills.',
  },
  {
    id: '8',
    title: 'Electronic Pulse',
    style: 'Electronic',
    bpm: 128,
    key: 'Cm',
    gradient: 'from-cyan-500 to-blue-900',
    description: 'Steady pulse for precision timing practice.',
  },
  {
    id: '9',
    title: 'Country Roads Strum',
    style: 'Country',
    bpm: 95,
    key: 'D',
    gradient: 'from-yellow-500 to-orange-700',
    description: 'Open strumming feel for groove and transitions.',
  },
]
