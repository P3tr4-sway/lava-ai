const API = '/api/youtube'

export interface YoutubeSearchResult {
  id: string
  title: string
  channel: string
  duration: string
  durationSeconds: number
  views: string
  viewCount: number
  thumbnail: string
  uploadedAt: string
}

export type AnalysisStatus =
  | 'downloading'
  | 'analyzing_chords'
  | 'analyzing_beats'
  | 'processing'
  | 'completed'
  | 'error'

export interface AnalysisScore {
  key: string
  tempo: number
  timeSignature: string
  title: string
  videoId: string
  duration: number
  sections: Array<{
    id: string
    label: string
    type: string
    measures: Array<{ id: string; chords: string[] }>
  }>
}

export interface AnalysisPollResult {
  id: string
  status: AnalysisStatus
  scoreJson: AnalysisScore | null
  error: string | null
  audioFileId: string | null
}

export const youtubeService = {
  /** Search YouTube via yt-dlp */
  async search(query: string, limit = 10): Promise<YoutubeSearchResult[]> {
    const params = new URLSearchParams({ q: query, limit: String(limit) })
    const res = await fetch(`${API}/search?${params}`)
    if (!res.ok) throw new Error(`Search failed: ${res.status}`)
    const data = await res.json()
    return data.results
  },

  /** Start analysis pipeline (returns immediately with transcriptionId) */
  async startAnalysis(videoId: string, title?: string): Promise<string> {
    const res = await fetch(`${API}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, title }),
    })
    if (!res.ok) throw new Error(`Analyze failed: ${res.status}`)
    const data = await res.json()
    return data.transcriptionId
  },

  /** Poll analysis status */
  async pollAnalysis(transcriptionId: string): Promise<AnalysisPollResult> {
    const res = await fetch(`${API}/analyze/${transcriptionId}`)
    if (!res.ok) throw new Error(`Poll failed: ${res.status}`)
    return res.json()
  },
}
