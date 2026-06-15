import type { AIServiceAgentKind } from '@renderer/types/aiServiceAgent'
import type { LucideIcon } from 'lucide-react'
import { FileSearch, FolderGit2, ScrollText } from 'lucide-react'

export interface AgentMeta {
  kind: AIServiceAgentKind
  /** Project repo selection: 'required' blocks send without one, 'optional' allows none. */
  projectRepo: 'required' | 'optional'
  /** Whether this agent accepts a file attachment. */
  supportsFile: boolean
  icon: LucideIcon
}

export const AGENT_METAS: AgentMeta[] = [
  {
    kind: 'project-expert',
    projectRepo: 'required',
    supportsFile: false,
    icon: FolderGit2
  },
  {
    kind: 'log-analysis',
    projectRepo: 'optional',
    supportsFile: true,
    icon: ScrollText
  },
  {
    kind: 'package-search',
    projectRepo: 'required',
    supportsFile: false,
    icon: FileSearch
  }
]

export const AGENT_META_BY_KIND: Record<AIServiceAgentKind, AgentMeta> = AGENT_METAS.reduce(
  (acc, meta) => {
    acc[meta.kind] = meta
    return acc
  },
  {} as Record<AIServiceAgentKind, AgentMeta>
)

/** Accepted file extensions for the log-analysis attachment picker. */
export const ACCEPTED_LOG_EXTENSIONS = [
  '.zip',
  '.tar',
  '.tgz',
  '.gz',
  '.tar.gz',
  '.tar.bz2',
  '.bz2',
  '.tar.xz',
  '.xz',
  '.7z',
  '.rar',
  '.log',
  '.txt',
  '.out',
  '.err',
  '.trace',
  '.json',
  '.xml',
  '.csv',
  '.tsv'
].join(',')
