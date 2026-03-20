import * as Tone from 'tone'

interface LoopTrack {
  id: string
  player: Tone.Player
  channel: Tone.Channel
}

export class LoopEngine {
  private tracks = new Map<string, LoopTrack>()
  private isPlaying = false

  async loadLoop(id: string, url: string): Promise<void> {
    const buffer = new Tone.ToneAudioBuffer()
    await buffer.load(url)

    const player = new Tone.Player(buffer)
    player.loop = true

    const channel = new Tone.Channel(0, 0).toDestination()
    player.connect(channel)

    this.tracks.set(id, { id, player, channel })
  }

  activateLoop(id: string) {
    const track = this.tracks.get(id)
    if (!track || !this.isPlaying) return
    track.player.start()
  }

  deactivateLoop(id: string) {
    const track = this.tracks.get(id)
    if (!track) return
    track.player.stop()
  }

  start() {
    this.isPlaying = true
    for (const [id] of this.tracks) {
      this.activateLoop(id)
    }
  }

  stop() {
    this.isPlaying = false
    for (const [id] of this.tracks) {
      this.deactivateLoop(id)
    }
  }

  setLoopVolume(id: string, volume: number) {
    const track = this.tracks.get(id)
    if (track) {
      track.channel.volume.value = Tone.gainToDb(volume)
    }
  }
}
