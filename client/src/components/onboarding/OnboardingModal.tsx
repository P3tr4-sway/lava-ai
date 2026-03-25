import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star, Zap, Trophy, Music, Mic, FilePlus2 } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/components/ui/utils'
import { useAuthStore } from '@/stores/authStore'

type SkillLevel = 'beginner' | 'intermediate' | 'advanced'

const SKILL_OPTIONS: { value: SkillLevel; label: string; icon: typeof Star }[] = [
  { value: 'beginner', label: 'Beginner', icon: Star },
  { value: 'intermediate', label: 'Intermediate', icon: Zap },
  { value: 'advanced', label: 'Advanced', icon: Trophy },
]

const FIRST_ACTIONS = [
  { label: 'Practice a Song', icon: Music, path: '/' },
  { label: 'Open Play Center', icon: Mic, path: '/jam' },
  { label: 'Create a Chart', icon: FilePlus2, path: '/editor' },
] as const

export function OnboardingModal() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const hasCompletedOnboarding = useAuthStore((s) => s.hasCompletedOnboarding)
  const userName = useAuthStore((s) => s.user?.name ?? '')
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding)
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [skillLevel, setSkillLevel] = useState<SkillLevel | null>(null)

  // Only render when authenticated and onboarding not yet done
  if (!isAuthenticated || hasCompletedOnboarding) {
    return null
  }

  function handleNext() {
    setStep((prev) => prev + 1)
  }

  function handleFirstAction(path: string) {
    completeOnboarding()
    navigate(path, { replace: true })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md mx-4 rounded-xl bg-surface-0 p-8 shadow-2xl">
        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="space-y-4 text-center">
            <h2 className="text-2xl font-semibold text-text-primary">
              Welcome to LAVA AI, {userName}!
            </h2>
            <p className="text-sm text-text-secondary">
              Your AI-powered practice center is ready. Let&apos;s tailor it to
              how you play.
            </p>
            <Button size="lg" className="w-full" onClick={handleNext}>
              Next
            </Button>
          </div>
        )}

        {/* Step 1: Skill Level */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-center text-2xl font-semibold text-text-primary">
              What&apos;s your playing level?
            </h2>
            <div className="space-y-2">
              {SKILL_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSkillLevel(value)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors',
                    skillLevel === value
                      ? 'border-accent bg-surface-2'
                      : 'border-border hover:border-border-hover hover:bg-surface-1',
                  )}
                >
                  <Icon className="size-5 text-text-secondary" />
                  <span className="text-sm font-medium text-text-primary">
                    {label}
                  </span>
                </button>
              ))}
            </div>
            <Button
              size="lg"
              className="w-full"
              onClick={handleNext}
              disabled={!skillLevel}
            >
              Next
            </Button>
          </div>
        )}

        {/* Step 2: First Action */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-center text-2xl font-semibold text-text-primary">
              What do you want to do first?
            </h2>
            <div className="space-y-2">
              {FIRST_ACTIONS.map(({ label, icon: Icon, path }) => (
                <button
                  key={path}
                  type="button"
                  onClick={() => handleFirstAction(path)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border border-border p-4 text-left transition-colors',
                    'hover:border-border-hover hover:bg-surface-1',
                  )}
                >
                  <Icon className="size-5 text-text-secondary" />
                  <span className="text-sm font-medium text-text-primary">
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step indicator dots */}
        <div className="mt-6 flex items-center justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                'size-2 rounded-full transition-colors',
                i === step ? 'bg-accent' : 'bg-surface-3',
              )}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
