import type { AIServiceAgentKind } from '@renderer/types/aiServiceAgent'
import type { LucideIcon } from 'lucide-react'
import { FileSearch, FolderGit2, ScrollText } from 'lucide-react'

export interface AgentMeta {
  kind: AIServiceAgentKind
  name: string
  description: string
  /** Project repo selection: 'required' blocks send without one, 'optional' allows none. */
  projectRepo: 'required' | 'optional'
  /** Whether this agent accepts a file attachment. */
  supportsFile: boolean
  icon: LucideIcon
}

export const AGENT_METAS: AgentMeta[] = [
  {
    kind: 'project-expert',
    name: '项目专家',
    description: '基于项目仓库代码与文档回答工程问题，需先选择项目。',
    projectRepo: 'required',
    supportsFile: false,
    icon: FolderGit2
  },
  {
    kind: 'log-analysis',
    name: '日志分析',
    description: '上传日志包或文本，定位异常、根因与修复建议，可选关联项目。',
    projectRepo: 'optional',
    supportsFile: true,
    icon: ScrollText
  },
  {
    kind: 'package-search',
    name: '包检索',
    description: '在所选项目中检索与推荐依赖包、版本与用法，需先选择项目。',
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
