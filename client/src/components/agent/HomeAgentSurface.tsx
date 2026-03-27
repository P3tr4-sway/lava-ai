import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Bot,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  FolderOpen,
  LoaderCircle,
  Music2,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react'
import { SPACE_ROUTES, type ToolResult } from '@lava/shared'
import { useAgentStore, type AgentToolActivity } from '@/stores/agentStore'
import { useCalendarStore, type PracticePlan } from '@/stores/calendarStore'
import { useAgent } from '@/hooks/useAgent'
import { useIsMobile } from '@/hooks/useIsMobile'
import { Button } from '@/components/ui/Button'
import { ChatInput } from './ChatInput'
import { ChatMessage } from './ChatMessage'
import { cn } from '@/components/ui/utils'

type ActivityItem =
  | { kind: 'message'; id: string; createdAt: number; message: ReturnType<typeof useAgentStore.getState>['messages'][number] }
  | { kind: 'tool'; id: string; createdAt: number; activity: AgentToolActivity }

interface ActionCardData {
  id: string
  title: string
  description: string
  ctaLabel: string
  onClick: () => void
}

const STARTER_INTENTS = [
  {
    icon: Search,
    label: 'Find a song',
    prompt: 'Find me a song to practice tonight',
    blurb: 'Search and go.',
  },
  {
    icon: CalendarDays,
    label: 'Build a practice plan',
    prompt: 'Build me a practice plan for a song I want to learn',
    blurb: 'Get a plan fast.',
  },
  {
    icon: Music2,
    label: 'Set up a jam session',
    prompt: 'Set up a jam session for me with a relaxed groove',
    blurb: 'Open tools with context.',
  },
  {
    icon: FolderOpen,
    label: 'Open or create a project',
    prompt: 'Open one of my projects or create a new one for me',
    blurb: 'Jump into work.',
  },
] as const

const TOOL_LABELS: Record<string, string> = {
  open_search_results: 'Finding results',
  create_practice_plan: 'Building plan',
  navigate_to_space: 'Opening workspace',
  create_project: 'Creating project',
  load_project: 'Opening project',
  start_jam: 'Setting up jam',
  set_tempo: 'Updating tempo',
  set_key: 'Updating key',
}

function parseResult(result?: ToolResult) {
  if (!result?.content) return null
  try {
    return JSON.parse(result.content)
  } catch {
    return null
  }
}

function getToolDetail(activity: AgentToolActivity) {
  const input = activity.input
  if (activity.name === 'open_search_results') {
    const selectedSong = [input.songTitle, input.artist]
      .map((value) => String(value ?? '').trim())
      .filter(Boolean)
      .join(' · ')
    if (selectedSong) return `"${selectedSong}"`
    return input.query ? `"${String(input.query)}"` : 'Opening results'
  }
  if (activity.name === 'create_practice_plan') {
    return input.songTitle ? String(input.songTitle) : 'Building plan'
  }
  if (activity.name === 'navigate_to_space') {
    return input.space ? String(input.space) : 'Opening space'
  }
  if (activity.name === 'create_project') {
    return input.name ? String(input.name) : 'Creating project'
  }
  if (activity.name === 'load_project') {
    return input.projectId ? `ID ${String(input.projectId)}` : 'Opening project'
  }
  if (activity.name === 'start_jam') {
    const bpm = input.bpm ? `${String(input.bpm)} BPM` : 'default tempo'
    const key = input.key ? String(input.key) : 'default key'
    return `${bpm} · ${key}`
  }
  if (activity.name === 'set_tempo') {
    return input.bpm ? `${String(input.bpm)} BPM` : 'Adjusting tempo'
  }
  if (activity.name === 'set_key') {
    return input.key ? `Key ${String(input.key)}` : 'Adjusting key'
  }
  return 'Working on your request'
}

function getProjectRoute(space: unknown, projectId: unknown) {
  const id = String(projectId ?? '')
  if (!id) return '/projects'
  if (space === 'create') return `/editor/${id}`
  if (space === 'learn') return `/play/${id}`
  if (space === 'tone') return `/tools/new?projectId=${id}`
  if (space === 'jam' || space === 'tools') return `/tools/${id}`
  return '/projects'
}

function buildActionCard(
  activity: AgentToolActivity,
  navigate: ReturnType<typeof useNavigate>,
  reviewPlan: (plan: PracticePlan) => void,
): ActionCardData | null {
  if (activity.status !== 'done' || !activity.result) return null
  const parsed = parseResult(activity.result)
  if (!parsed || parsed.error) return null

  if (parsed.action === 'open_search_results' && parsed.query) {
    const query = String(parsed.query)
    const selectedSong = [parsed.songTitle, parsed.artist]
      .map((value) => String(value ?? '').trim())
      .filter(Boolean)
      .join(' · ')
    const selectionReason = String(parsed.selectionReason ?? '').trim()
    return {
      id: activity.toolCallId,
      title: 'Results ready',
      description: selectedSong
        ? selectionReason
          ? `"${selectedSong}" · ${selectionReason}`
          : `"${selectedSong}"`
        : `"${query}"`,
      ctaLabel: 'Open results',
      onClick: () => navigate(`/search?q=${encodeURIComponent(query)}`),
    }
  }

  if (parsed.action === 'practice_plan' && parsed.plan) {
    const plan = parsed.plan
    const sessionCount = Array.isArray(plan.sessions) ? plan.sessions.length : 0
    return {
      id: activity.toolCallId,
      title: 'Plan ready',
      description: `${sessionCount} sessions for ${String(plan.songTitle ?? 'your song')}.`,
      ctaLabel: 'Review plan',
      onClick: () => reviewPlan(plan),
    }
  }

  if (parsed.action === 'navigate' && parsed.space) {
    const space = String(parsed.space)
    const route = SPACE_ROUTES[space as keyof typeof SPACE_ROUTES] ?? '/'
    return {
      id: activity.toolCallId,
      title: 'Ready',
      description: space,
      ctaLabel: `Open ${space}`,
      onClick: () => navigate(route),
    }
  }

  if ((parsed.id || parsed.projectId) && parsed.space) {
    const route = getProjectRoute(parsed.space, parsed.id ?? parsed.projectId)
    return {
      id: activity.toolCallId,
      title: 'Project ready',
      description: String(parsed.name ?? 'your project'),
      ctaLabel: 'Open project',
      onClick: () => navigate(route),
    }
  }

  if (parsed.action === 'start_jam' || parsed.action === 'set_tempo' || parsed.action === 'set_key') {
    return {
      id: activity.toolCallId,
      title: 'Jam ready',
      description: 'Open tools.',
      ctaLabel: 'Open tools',
      onClick: () => navigate('/?tab=tools'),
    }
  }

  return null
}

function ActionCard({ card }: { card: ActionCardData }) {
  return (
    <div className="rounded-[22px] border border-border bg-surface-0/90 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.08)] backdrop-blur">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-text-primary">{card.title}</p>
          <p className="text-sm leading-6 text-text-secondary">{card.description}</p>
        </div>
        <Button onClick={card.onClick} className="rounded-full px-5">
          {card.ctaLabel}
          <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  )
}

function StarterIntentGrid({
  disabled,
  compact = false,
  onSelect,
}: {
  disabled?: boolean
  compact?: boolean
  onSelect: (prompt: string) => void
}) {
  return (
    <div className={cn('grid gap-3', compact ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4')}>
      {STARTER_INTENTS.map(({ icon: Icon, label, prompt, blurb }) => (
        <button
          key={label}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(prompt)}
          className={cn(
            'rounded-[20px] border text-left transition-all disabled:opacity-50',
            compact
              ? 'border-border bg-surface-0 p-4 hover:-translate-y-0.5 hover:border-border-hover hover:bg-surface-0'
              : 'border-white/35 bg-white/55 p-4 hover:-translate-y-0.5 hover:border-white/60 hover:bg-white/70 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20 dark:hover:bg-white/10',
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div
              className={cn(
                'flex size-10 items-center justify-center rounded-full border',
                compact
                  ? 'border-border bg-surface-1 text-text-primary'
                  : 'border-white/40 bg-white/60 text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-white/80',
              )}
            >
              <Icon size={18} />
            </div>
            <ArrowRight size={16} className="text-text-muted" />
          </div>
          <p className="mt-4 text-sm font-semibold text-text-primary">{label}</p>
          <p className="mt-1 text-sm leading-6 text-text-secondary">{blurb}</p>
        </button>
      ))}
    </div>
  )
}

function ToolActivityRow({ activity }: { activity: AgentToolActivity }) {
  const isRunning = activity.status === 'running'
  const isError = activity.status === 'error'
  const Icon = isRunning ? LoaderCircle : isError ? AlertCircle : CheckCircle2
  const parsed = parseResult(activity.result)
  const errorMessage = isError ? String(parsed?.error ?? 'Something went wrong while running this action.') : null

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface-0/70 px-4 py-3">
      <div
        className={cn(
          'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border',
          isRunning && 'border-border bg-surface-1 text-text-secondary',
          !isRunning && !isError && 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600',
          isError && 'border-red-500/20 bg-red-500/10 text-red-500',
        )}
      >
        <Icon size={16} className={cn(isRunning && 'animate-spin')} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text-primary">
          {TOOL_LABELS[activity.name] ?? 'Handling request'}
        </p>
        <p className="mt-1 text-sm text-text-secondary">
          {errorMessage ?? getToolDetail(activity)}
        </p>
      </div>
      <div className="shrink-0 text-[11px] uppercase tracking-[0.18em] text-text-muted">
        {isRunning ? 'Working' : isError ? 'Retry' : 'Done'}
      </div>
    </div>
  )
}

function WorkspacePanel({
  isStreaming,
  onOpen,
  onSelect,
  workspacePreview,
}: {
  isStreaming: boolean
  onOpen: () => void
  onSelect: (prompt: string) => void
  workspacePreview: ReturnType<typeof useAgentStore.getState>['workspacePreview']
}) {
  const [isFrameLoading, setIsFrameLoading] = useState(Boolean(workspacePreview))

  useEffect(() => {
    setIsFrameLoading(Boolean(workspacePreview))
  }, [workspacePreview?.route, workspacePreview?.updatedAt])

  if (!workspacePreview) {
    return (
      <section className="overflow-hidden rounded-[28px] border border-border bg-surface-0 shadow-[0_20px_80px_rgba(0,0,0,0.08)]">
        <div className="border-b border-border px-5 py-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-1 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-text-secondary">
            <span className="lava-agent-tab-orb size-2.5 rounded-full" />
            Workspace
          </div>
          <p className="mt-3 text-xl font-semibold text-text-primary">Agent screen will appear here.</p>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            Ask for songs, tools, projects, or practice help and the left side will switch to the screen the agent is using.
          </p>
        </div>

        <div className="p-5">
          <StarterIntentGrid disabled={isStreaming} compact onSelect={onSelect} />
        </div>
      </section>
    )
  }

  return (
    <section className="overflow-hidden rounded-[28px] border border-border bg-surface-0 shadow-[0_20px_80px_rgba(0,0,0,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-1 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-text-secondary">
            <span className="lava-agent-tab-orb size-2.5 rounded-full" />
            Workspace
          </div>
          <p className="mt-3 text-lg font-semibold text-text-primary">{workspacePreview.title}</p>
          <p className="mt-1 text-sm leading-6 text-text-secondary">{workspacePreview.description}</p>
        </div>

        <Button variant="outline" onClick={onOpen} className="rounded-full">
          Open full page
          <ArrowUpRight size={15} />
        </Button>
      </div>

      <div className="relative h-[min(760px,calc(100vh-7.5rem))] min-h-[620px] bg-surface-1">
        {isFrameLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-3 bg-surface-0/82 backdrop-blur-sm">
            <LoaderCircle size={18} className="animate-spin text-text-secondary" />
            <span className="text-sm text-text-secondary">Loading agent workspace…</span>
          </div>
        )}

        <iframe
          key={workspacePreview.route}
          src={workspacePreview.route}
          title={workspacePreview.title}
          className="h-full w-full border-0 bg-surface-1"
          onLoad={() => setIsFrameLoading(false)}
        />
      </div>
    </section>
  )
}

export function HomeAgentSurface() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { sendMessage } = useAgent()
  const messages = useAgentStore((s) => s.messages)
  const toolActivities = useAgentStore((s) => s.toolActivities)
  const isStreaming = useAgentStore((s) => s.isStreaming)
  const streamingContent = useAgentStore((s) => s.streamingContent)
  const clearMessages = useAgentStore((s) => s.clearMessages)
  const workspacePreview = useAgentStore((s) => s.workspacePreview)
  const setActivePlanPreview = useCalendarStore((s) => s.setActivePlanPreview)

  const feedItems = useMemo<ActivityItem[]>(
    () =>
      [
        ...messages.map((message) => ({
          kind: 'message' as const,
          id: message.id,
          createdAt: message.createdAt,
          message,
        })),
        ...toolActivities.map((activity) => ({
          kind: 'tool' as const,
          id: activity.toolCallId,
          createdAt: activity.startedAt,
          activity,
        })),
      ].sort((a, b) => a.createdAt - b.createdAt),
    [messages, toolActivities],
  )

  const pinnedCards = useMemo(
    () =>
      toolActivities
        .map((activity) => buildActionCard(activity, navigate, setActivePlanPreview))
        .filter(Boolean)
        .reverse()
        .slice(0, 2) as ActionCardData[],
    [navigate, setActivePlanPreview, toolActivities],
  )

  const lastUserPrompt = useMemo(
    () => [...messages].reverse().find((message) => message.role === 'user' && !message.hidden)?.content ?? '',
    [messages],
  )

  const latestError = useMemo(
    () => [...toolActivities].reverse().find((activity) => activity.status === 'error') ?? null,
    [toolActivities],
  )

  const hasConversation = messages.some((message) => !message.hidden) || toolActivities.length > 0 || Boolean(streamingContent)
  const canClearContext = messages.length > 0 || toolActivities.length > 0 || Boolean(streamingContent)
  const showDockedLayout = hasConversation && !isMobile

  const openWorkspacePreview = () => {
    if (!workspacePreview) return
    const [pathWithSearch, hash = ''] = workspacePreview.route.split('#')
    const [pathname = '/', search = ''] = pathWithSearch.split('?')
    const params = new URLSearchParams(search)
    params.delete('embed')
    navigate(`${pathname}${params.toString() ? `?${params.toString()}` : ''}${hash ? `#${hash}` : ''}`)
  }

  const renderFeed = () => {
    if (!hasConversation) {
      return (
        <div className="rounded-[22px] border border-dashed border-border bg-surface-0 px-5 py-14 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-border bg-surface-1">
            <Sparkles size={18} className="text-text-secondary" />
          </div>
          <p className="mt-4 text-sm font-semibold text-text-primary">Ready.</p>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            Start with a task.
          </p>
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-3">
        {feedItems.map((item) =>
          item.kind === 'message' ? (
            <ChatMessage key={item.id} message={item.message} />
          ) : (
            <ToolActivityRow key={item.id} activity={item.activity} />
          ),
        )}

        {isStreaming && streamingContent && (
          <ChatMessage
            message={{ id: 'home-agent-stream', role: 'assistant', content: streamingContent, createdAt: Date.now() }}
            isStreaming
          />
        )}

        {isStreaming && toolActivities.every((activity) => activity.status !== 'running') && (
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface-0/70 px-4 py-3 text-sm text-text-secondary">
            <CircleDashed size={16} className="animate-spin" />
            Thinking.
          </div>
        )}
      </div>
    )
  }

  if (showDockedLayout) {
    return (
      <div className="grid items-start gap-6 pt-2 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <section className="flex items-center justify-between gap-4 rounded-[24px] border border-border bg-surface-0 px-5 py-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-1 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-text-secondary">
              <span className="lava-agent-tab-orb size-2.5 rounded-full" />
              Agent
            </div>

            <Button
              variant="outline"
              onClick={clearMessages}
              disabled={!canClearContext || isStreaming}
              className="rounded-full bg-surface-0"
            >
              <Trash2 size={15} />
              Clear context
            </Button>
          </section>

          <WorkspacePanel
            isStreaming={isStreaming}
            onOpen={openWorkspacePreview}
            onSelect={sendMessage}
            workspacePreview={workspacePreview}
          />

          {pinnedCards.length > 0 ? (
            <section className="space-y-3">
              {pinnedCards.map((card) => (
                <ActionCard key={card.id} card={card} />
              ))}
            </section>
          ) : null}

          {latestError && (
            <section className="rounded-[22px] border border-red-500/20 bg-red-500/5 p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-text-primary">That action hit a snag.</p>
                  <p className="text-sm leading-6 text-text-secondary">
                    Try again or simplify the request.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {lastUserPrompt && (
                    <Button variant="outline" onClick={() => sendMessage(lastUserPrompt)} className="rounded-full">
                      <RotateCcw size={15} />
                      Retry
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => sendMessage('Find me a song to practice')} className="rounded-full">
                    Find a song
                  </Button>
                  <Button variant="ghost" onClick={() => sendMessage('Build me a practice plan')} className="rounded-full">
                    Build plan
                  </Button>
                </div>
              </div>
            </section>
          )}

          {!workspacePreview && (
            <section className="rounded-[24px] border border-border bg-surface-1 p-5">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-full border border-border bg-surface-0">
                  <Sparkles size={16} className="text-text-secondary" />
                </div>
                <p className="text-sm font-semibold text-text-primary">Quick actions</p>
              </div>
              <StarterIntentGrid disabled={isStreaming} compact onSelect={sendMessage} />
            </section>
          )}
        </div>

        <aside className="sticky top-4 h-[min(760px,calc(100vh-6rem))] min-h-[620px] overflow-hidden rounded-[28px] border border-border bg-surface-0 shadow-[0_20px_80px_rgba(0,0,0,0.08)]">
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <div className="flex size-9 items-center justify-center rounded-full border border-border bg-surface-1">
              <Bot size={16} className="text-text-secondary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text-primary">Agent</p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={clearMessages}
              disabled={!canClearContext || isStreaming}
              className="shrink-0"
              title="Clear current context"
              aria-label="Clear current context"
            >
              <Trash2 size={14} />
            </Button>
          </div>

            <div className="flex-1 overflow-y-auto p-4">
              {renderFeed()}
            </div>

            <div className="border-t border-border p-3">
              <ChatInput
                onSend={sendMessage}
                disabled={isStreaming}
                compact
                placeholder="Refine the task..."
              />
            </div>
          </div>
        </aside>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 pt-2">
      <section className="relative overflow-hidden rounded-[28px] border border-border bg-surface-0 px-5 py-6 shadow-[0_20px_80px_rgba(0,0,0,0.08)] md:px-7 md:py-7">
        <div className="pointer-events-none absolute inset-0">
          <div className="lava-agent-spectrum absolute inset-[-18%] rounded-[36px] opacity-60 blur-3xl" />
          <div className="lava-agent-drift absolute inset-x-[10%] top-[8%] h-40 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.9),rgba(255,255,255,0.15)_36%,transparent_68%)] opacity-80 blur-3xl" />
          <div className="lava-agent-drift absolute -bottom-10 right-0 size-56 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,184,77,0.65),transparent_70%)] opacity-70 blur-3xl [animation-delay:-3s]" />
          <div className="lava-agent-drift absolute -left-10 bottom-0 size-52 rounded-full bg-[radial-gradient(circle_at_center,rgba(70,210,255,0.58),transparent_72%)] opacity-70 blur-3xl [animation-delay:-6s]" />
        </div>

        <div className="relative z-10 flex flex-col gap-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/55 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-700 backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-white/70">
                <span className="lava-agent-tab-orb size-2.5 rounded-full" />
                Agent Mode
              </div>
              <div>
                <h2 className="text-[28px] font-semibold tracking-tight text-text-primary md:text-[34px]">
                  Tell LAVA the task.
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-text-secondary md:text-base">
                  Search. Plan. Jam. Open a project.
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={clearMessages}
              disabled={!canClearContext || isStreaming}
              className="rounded-full bg-surface-0/70"
            >
              <Trash2 size={15} />
              Clear context
            </Button>
          </div>

          <ChatInput
            onSend={sendMessage}
            disabled={isStreaming}
            compact
            placeholder="What do you need?"
            className="border-white/40 bg-white/70 shadow-[0_12px_40px_rgba(0,0,0,0.08)] backdrop-blur dark:border-white/10 dark:bg-surface-0/75"
          />

          <StarterIntentGrid disabled={isStreaming} onSelect={sendMessage} />
        </div>
      </section>

      {pinnedCards.length > 0 && (
        <section className="space-y-3">
          {pinnedCards.map((card) => (
            <ActionCard key={card.id} card={card} />
          ))}
        </section>
      )}

      {latestError && (
        <section className="rounded-[22px] border border-red-500/20 bg-red-500/5 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-text-primary">That action hit a snag.</p>
              <p className="text-sm leading-6 text-text-secondary">
                Try again or simplify the request.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {lastUserPrompt && (
                <Button variant="outline" onClick={() => sendMessage(lastUserPrompt)} className="rounded-full">
                  <RotateCcw size={15} />
                  Retry
                </Button>
              )}
              <Button variant="ghost" onClick={() => sendMessage('Find me a song to practice')} className="rounded-full">
                Find a song
              </Button>
              <Button variant="ghost" onClick={() => sendMessage('Build me a practice plan')} className="rounded-full">
                Build plan
              </Button>
            </div>
          </div>
        </section>
      )}

      {hasConversation && (
        <section className="rounded-[28px] border border-border bg-surface-1 p-4 md:p-5">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-full border border-border bg-surface-0">
              <Wand2 size={16} className="text-text-secondary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">Activity</p>
              <p className="text-sm text-text-secondary">Request, progress, result.</p>
            </div>
          </div>

          {renderFeed()}
        </section>
      )}
    </div>
  )
}
