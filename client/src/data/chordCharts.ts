export interface ChordChart {
  id: string
  title: string
  artist?: string
  style: string
  key: string
  tempo?: number
  timeSignature?: string
  tuning?: string
  pdfUrl?: string
}

export const CHORD_CHARTS: ChordChart[] = [
  { id: '1', title: 'Autumn Leaves', style: 'Jazz Standard', key: 'Gm', tempo: 120, timeSignature: '4/4' },
  { id: '2', title: '12 Bar Blues', style: 'Blues', key: 'A', tempo: 100, timeSignature: '4/4' },
  { id: '3', title: 'ii-V-I Progressions', style: 'Jazz', key: 'C', tempo: 110, timeSignature: '4/4' },
  { id: '4', title: 'Canon in D', style: 'Classical', key: 'D', tempo: 72, timeSignature: '4/4' },
  { id: '5', title: 'Rhythm Changes', style: 'Jazz', key: 'Bb', tempo: 140, timeSignature: '4/4' },
  { id: '6', title: 'Minor Swing', style: 'Gypsy Jazz', key: 'Am', tempo: 190, timeSignature: '4/4' },
  { id: '7', title: 'Bossa Nova Basics', style: 'Bossa Nova', key: 'Dm', tempo: 130, timeSignature: '4/4' },
  { id: '8', title: 'Pop Punk Essentials', style: 'Pop Punk', key: 'G', tempo: 170, timeSignature: '4/4' },
  { id: '9', title: 'Soul Progressions', style: 'Soul', key: 'F', tempo: 85, timeSignature: '4/4' },
  { id: 'anjo-de-mim', title: 'Anjo De Mim', artist: 'O Rappa', style: 'Brazilian Rock', key: 'Em', tempo: 92, timeSignature: '4/4', tuning: 'Standard', pdfUrl: '/scores/anjo-de-mim.pdf' },
  { id: 'wonderwall', title: 'Wonderwall', artist: 'Oasis', style: 'Pop', key: 'G', tempo: 87, timeSignature: '4/4' },
  { id: 'wish-you-were-here', title: 'Wish You Were Here', artist: 'Pink Floyd', style: 'Rock', key: 'G', tempo: 60, timeSignature: '4/4' },
  { id: 'let-her-go', title: 'Let Her Go', artist: 'Passenger', style: 'Pop', key: 'C', tempo: 75, timeSignature: '4/4' },
]
