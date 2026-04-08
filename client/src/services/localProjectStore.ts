import type { CreateProject, Project, ProjectVersion, UpdateProject, Version } from '@lava/shared'

const PROJECTS_KEY = 'lava:projects:v1'
const VERSIONS_KEY = 'lava:project-versions:v1'

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function readProjects(): Project[] {
  if (typeof localStorage === 'undefined') return []
  return safeParse<Project[]>(localStorage.getItem(PROJECTS_KEY), [])
}

function writeProjects(projects: Project[]) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects))
  } catch {
    // ignore quota errors — demo-grade persistence
  }
}

function readVersions(): Record<string, ProjectVersion[]> {
  if (typeof localStorage === 'undefined') return {}
  return safeParse<Record<string, ProjectVersion[]>>(localStorage.getItem(VERSIONS_KEY), {})
}

function writeVersions(versions: Record<string, ProjectVersion[]>) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(VERSIONS_KEY, JSON.stringify(versions))
  } catch {
    // ignore
  }
}

function makeId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

export const localProjectStore = {
  list(): Project[] {
    return readProjects().slice().sort((a, b) => b.updatedAt - a.updatedAt)
  },

  get(id: string): Project | null {
    return readProjects().find((p) => p.id === id) ?? null
  },

  create(data: CreateProject): Project {
    const now = Date.now()
    const project: Project = {
      id: makeId('proj'),
      name: data.name,
      description: data.description,
      space: data.space,
      createdAt: now,
      updatedAt: now,
      metadata: data.metadata ?? {},
    }
    const projects = readProjects()
    projects.unshift(project)
    writeProjects(projects)
    return project
  },

  update(id: string, data: UpdateProject): Project | null {
    const projects = readProjects()
    const idx = projects.findIndex((p) => p.id === id)
    if (idx < 0) return null
    const existing = projects[idx]
    const updated: Project = {
      ...existing,
      name: data.name ?? existing.name,
      description: data.description ?? existing.description,
      space: data.space ?? existing.space,
      metadata: data.metadata ?? existing.metadata,
      updatedAt: Date.now(),
    }
    projects[idx] = updated
    writeProjects(projects)
    return updated
  },

  delete(id: string): void {
    const projects = readProjects().filter((p) => p.id !== id)
    writeProjects(projects)
    const versions = readVersions()
    if (id in versions) {
      delete versions[id]
      writeVersions(versions)
    }
  },

  listVersions(projectId: string): ProjectVersion[] {
    return readVersions()[projectId] ?? []
  },

  createVersion(projectId: string, data: Version): ProjectVersion {
    const versions = readVersions()
    const existing = versions[projectId] ?? []
    const record: ProjectVersion = {
      id: makeId('ver'),
      projectId,
      version: existing.length + 1,
      snapshot: data as unknown as Record<string, unknown>,
      createdAt: Date.now(),
    }
    versions[projectId] = [...existing, record]
    writeVersions(versions)
    return record
  },
}
