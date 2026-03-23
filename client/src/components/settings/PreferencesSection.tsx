import { Sun, Moon, Monitor } from 'lucide-react'
import { Slider } from '@/components/ui'
import { cn } from '@/components/ui/utils'
import { useTheme } from '@/hooks/useTheme'
import { useAudioStore } from '@/stores/audioStore'

interface PreferencesSectionProps {
  className?: string
}

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const THEME_OPTIONS = [
  { value: 'system' as const, label: 'System', icon: Monitor },
  { value: 'light' as const, label: 'Light', icon: Sun },
  { value: 'dark' as const, label: 'Dark', icon: Moon },
]

export function PreferencesSection({ className }: PreferencesSectionProps) {
  const { theme, setTheme } = useTheme()
  const bpm = useAudioStore((s) => s.bpm)
  const setBpm = useAudioStore((s) => s.setBpm)
  const key = useAudioStore((s) => s.key)
  const setKey = useAudioStore((s) => s.setKey)

  return (
    <div className={cn('flex flex-col gap-8', className)}>
      {/* Theme */}
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-3">Theme</h3>
        <div className="flex gap-1 bg-surface-2 border border-border rounded p-0.5 w-fit">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 text-sm rounded transition-colors',
                theme === value
                  ? 'bg-surface-4 text-text-primary'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Default BPM */}
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-3">Default BPM</h3>
        <div className="flex items-center gap-4">
          <Slider
            min={40}
            max={240}
            step={1}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
          />
          <span className="text-sm font-mono text-text-secondary w-10 text-right shrink-0">
            {bpm}
          </span>
        </div>
      </div>

      {/* Default Key */}
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-3">Default Key</h3>
        <div className="flex flex-wrap gap-1">
          {KEYS.map((k) => (
            <button
              key={k}
              onClick={() => setKey(k)}
              className={cn(
                'px-3 py-1 text-sm rounded transition-colors border',
                key === k
                  ? 'bg-accent text-surface-0 border-accent'
                  : 'bg-surface-2 text-text-secondary border-border hover:border-border-hover hover:text-text-primary',
              )}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {/* Audio */}
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-3">Audio</h3>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs text-text-secondary mb-1 block">Input Device</label>
            <select className="w-full h-8 rounded bg-surface-3 border border-border px-3 text-sm text-text-primary focus:outline-none focus:border-border-hover transition-colors">
              <option>Default Microphone</option>
              <option>Built-in Microphone</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-text-secondary mb-1 block">Output Device</label>
            <select className="w-full h-8 rounded bg-surface-3 border border-border px-3 text-sm text-text-primary focus:outline-none focus:border-border-hover transition-colors">
              <option>Default Speakers</option>
              <option>Built-in Speakers</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}
