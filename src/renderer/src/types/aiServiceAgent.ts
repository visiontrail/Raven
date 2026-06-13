export type AIServiceAgentKind = 'log-analysis' | 'project-expert'

export type AgentRunStatus = 'idle' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'stale'

export interface ProjectRepoOption {
  id: number
  project_name: string
  project_code: string
  default_branch: string
  description?: string
  is_enabled: boolean
}

export interface AgentTraceEvent {
  type:
    | 'run_start'
    | 'step_start'
    | 'step_delta'
    | 'step_end'
    | 'thinking_start'
    | 'thinking_delta'
    | 'thinking_end'
    | 'system_notice'
    | 'answer_delta'
    | 'run_complete'
    | 'cancelled'
    | 'error'
  timestamp: number
  data?: Record<string, unknown>
}

export interface SSEFrame {
  event?: string
  data: Record<string, unknown>
}

export interface AgentRunState {
  status: AgentRunStatus
  agentKind: AIServiceAgentKind | null
  sessionId: string | null
  runId: string | null
  message: string
  answerSoFar: string
  traceEvents: AgentTraceEvent[]
  selectedProjectRepoId: number | null
  selectedFile: File | null
  error: string | null
}

export interface AIServiceConfig {
  host: string
  port: number
  baseUrl: string
  hasToken: boolean
  token?: string
}
