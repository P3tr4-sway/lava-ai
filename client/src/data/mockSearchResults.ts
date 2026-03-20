export interface YoutubeResult {
  id: string
  title: string
  artist: string
  channel: string
  duration: string
  views: string
  uploadedAt: string
  gradient: string
  songId?: string
}

export const MOCK_SEARCH_RESULTS: YoutubeResult[] = [
  {
    id: 'yt-1',
    title: 'Wonderwall - Oasis (Full Guitar Tutorial)',
    artist: 'Oasis',
    channel: 'GuitarLessonsHub',
    duration: '8:24',
    views: '4.2M',
    uploadedAt: '3 years ago',
    gradient: 'from-amber-800 to-stone-900',
    songId: 'wonderwall',
  },
  {
    id: 'yt-2',
    title: 'Wonderwall Guitar Lesson for Beginners',
    artist: 'Oasis',
    channel: 'JustinGuitar',
    duration: '12:35',
    views: '8.1M',
    uploadedAt: '5 years ago',
    gradient: 'from-blue-800 to-slate-900',
    songId: 'wonderwall',
  },
  {
    id: 'yt-3',
    title: 'How to Play Wonderwall — Complete Tab Breakdown',
    artist: 'Oasis',
    channel: 'TabsAndChords',
    duration: '15:02',
    views: '2.8M',
    uploadedAt: '2 years ago',
    gradient: 'from-emerald-800 to-slate-900',
    songId: 'wonderwall',
  },
  {
    id: 'yt-4',
    title: 'Wonderwall Acoustic Cover — Full Song',
    artist: 'Oasis',
    channel: 'AcousticCovers',
    duration: '4:18',
    views: '1.1M',
    uploadedAt: '1 year ago',
    gradient: 'from-rose-800 to-slate-900',
  },
  {
    id: 'yt-5',
    title: 'Wonderwall Strumming Pattern Tutorial',
    artist: 'Oasis',
    channel: 'GuitarKing',
    duration: '6:45',
    views: '987K',
    uploadedAt: '4 years ago',
    gradient: 'from-cyan-800 to-slate-900',
    songId: 'wonderwall',
  },
  {
    id: 'yt-6',
    title: 'Oasis — Wonderwall (Karaoke Version)',
    artist: 'Oasis',
    channel: 'KaraokeWorld',
    duration: '4:18',
    views: '512K',
    uploadedAt: '6 years ago',
    gradient: 'from-violet-800 to-slate-900',
  },
  {
    id: 'yt-7',
    title: 'Oasis Greatest Hits Guitar Compilation',
    artist: 'Oasis',
    channel: 'RockGuitarPro',
    duration: '18:30',
    views: '3.4M',
    uploadedAt: '3 years ago',
    gradient: 'from-orange-800 to-stone-900',
  },
  {
    id: 'yt-8',
    title: 'Wonderwall Fingerstyle Arrangement',
    artist: 'Oasis',
    channel: 'FingerstyleGuru',
    duration: '5:21',
    views: '445K',
    uploadedAt: '2 years ago',
    gradient: 'from-teal-800 to-slate-900',
    songId: 'wonderwall',
  },
  {
    id: 'yt-9',
    title: 'Wonderwall Easy Chords — Beginner Friendly',
    artist: 'Oasis',
    channel: 'EasyGuitar',
    duration: '7:15',
    views: '2.1M',
    uploadedAt: '4 years ago',
    gradient: 'from-lime-800 to-slate-900',
    songId: 'wonderwall',
  },
  {
    id: 'yt-10',
    title: 'Oasis — Live Forever Guitar Tutorial',
    artist: 'Oasis',
    channel: 'ClassicRockGuitars',
    duration: '9:50',
    views: '1.8M',
    uploadedAt: '5 years ago',
    gradient: 'from-red-800 to-slate-900',
  },
]
