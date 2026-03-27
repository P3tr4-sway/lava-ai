export const AGENT_WORKSPACE_EMBED_PARAM = 'embed'
export const AGENT_WORKSPACE_EMBED_VALUE = 'agent-workspace'

export interface AgentWorkspacePreview {
  route: string
  title: string
  description: string
  action: string
  updatedAt: number
}

export function isAgentWorkspaceEmbedded(search: string) {
  const params = new URLSearchParams(search)
  return params.get(AGENT_WORKSPACE_EMBED_PARAM) === AGENT_WORKSPACE_EMBED_VALUE
}

export function toAgentWorkspaceRoute(route: string) {
  const [pathWithSearch, hash = ''] = route.split('#')
  const [pathname = '/', search = ''] = pathWithSearch.split('?')
  const params = new URLSearchParams(search)
  params.set(AGENT_WORKSPACE_EMBED_PARAM, AGENT_WORKSPACE_EMBED_VALUE)

  const nextSearch = params.toString()
  const nextHash = hash ? `#${hash}` : ''
  return `${pathname}${nextSearch ? `?${nextSearch}` : ''}${nextHash}`
}
