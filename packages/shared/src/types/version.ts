import type { ArrangementId } from './score.js'

export type VersionSource = 'arrangement' | 'ai-transform'

export interface Version {
  id: string
  name: string
  source: VersionSource
  arrangementId?: ArrangementId
  musicXml: string
  parentVersionId?: string
  createdAt: number
  prompt?: string
}

export interface VersionAction {
  versionId: string
  name: string
  changeSummary: string[]
  state?: 'pending' | 'applied'
}
