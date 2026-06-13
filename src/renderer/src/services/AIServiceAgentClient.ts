import type { AIServiceAgentKind, AIServiceConfig, ProjectRepoOption } from '@renderer/types/aiServiceAgent'

export class AIServiceAgentClient {
  private baseUrl: string
  private token?: string

  constructor(config: AIServiceConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '')
    this.token = config.token
  }

  updateConfig(config: AIServiceConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '')
    this.token = config.token
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {}
    if (this.token) {
      h['Authorization'] = `Bearer ${this.token}`
    }
    return h
  }

  private async handleResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
      let detail = ''
      try {
        const body = await res.json()
        detail = body?.detail || body?.message || JSON.stringify(body)
      } catch {
        detail = res.statusText
      }
      if (res.status === 401 || res.status === 403) {
        throw new AIServiceAuthError(detail || 'Authentication failed', res.status)
      }
      throw new AIServiceError(detail || `HTTP ${res.status}`, res.status)
    }
    return res.json() as Promise<T>
  }

  async listProjectRepos(): Promise<ProjectRepoOption[]> {
    const res = await fetch(`${this.baseUrl}/api/v1/project-repos?limit=200`, {
      headers: this.headers()
    }).catch((err) => {
      throw new AIServiceConnectionError(this.baseUrl, err)
    })
    const data = await this.handleResponse<{ items: ProjectRepoOption[] } | ProjectRepoOption[]>(res)
    return Array.isArray(data) ? data : data.items ?? []
  }

  startLogAnalysisRun(params: {
    message: string
    sessionId?: string
    projectRepoId?: number
    file?: File
    remember?: boolean
    signal?: AbortSignal
  }): Promise<Response> {
    const form = new FormData()
    form.append('message', params.message || '请分析这个日志文件')
    if (params.sessionId) form.append('session_id', params.sessionId)
    if (params.projectRepoId != null) form.append('project_repo_id', String(params.projectRepoId))
    if (params.file) form.append('file', params.file)
    if (params.remember != null) form.append('remember', String(params.remember))

    return fetch(`${this.baseUrl}/api/v1/ai-chat/log-analysis/stream`, {
      method: 'POST',
      headers: this.headers(),
      body: form,
      signal: params.signal
    }).catch((err) => {
      if (err.name === 'AbortError') throw err
      throw new AIServiceConnectionError(this.baseUrl, err)
    })
  }

  startProjectExpertRun(params: {
    message: string
    projectRepoId: number
    sessionId?: string
    remember?: boolean
    signal?: AbortSignal
  }): Promise<Response> {
    const form = new FormData()
    form.append('message', params.message)
    form.append('project_repo_id', String(params.projectRepoId))
    if (params.sessionId) form.append('session_id', params.sessionId)
    if (params.remember != null) form.append('remember', String(params.remember))

    return fetch(`${this.baseUrl}/api/v1/ai-chat/project-expert/stream`, {
      method: 'POST',
      headers: this.headers(),
      body: form,
      signal: params.signal
    }).catch((err) => {
      if (err.name === 'AbortError') throw err
      throw new AIServiceConnectionError(this.baseUrl, err)
    })
  }

  async cancelRun(params: {
    agentKind: AIServiceAgentKind
    runId?: string | null
    sessionId?: string | null
  }): Promise<void> {
    if (params.runId) {
      const res = await fetch(`${this.baseUrl}/api/v1/ai-chat/chat/runs/${params.runId}/cancel`, {
        method: 'POST',
        headers: { ...this.headers(), 'Content-Type': 'application/json' }
      }).catch((err) => {
        throw new AIServiceConnectionError(this.baseUrl, err)
      })
      if (!res.ok && res.status !== 404) {
        await this.handleResponse(res)
      }
      if (res.ok) return
    }

    if (params.sessionId) {
      const endpoint = `${this.baseUrl}/api/v1/ai-chat/${params.agentKind}/cancel`
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { ...this.headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: params.sessionId })
      }).catch((err) => {
        throw new AIServiceConnectionError(this.baseUrl, err)
      })
      if (!res.ok) {
        await this.handleResponse(res)
      }
    }
  }

  async getRunResult(agentKind: AIServiceAgentKind, sessionId: string): Promise<Record<string, unknown>> {
    const res = await fetch(
      `${this.baseUrl}/api/v1/ai-chat/${agentKind}/result?session_id=${encodeURIComponent(sessionId)}`,
      { headers: this.headers() }
    ).catch((err) => {
      throw new AIServiceConnectionError(this.baseUrl, err)
    })
    return this.handleResponse(res)
  }
}

export class AIServiceError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message)
    this.name = 'AIServiceError'
  }
}

export class AIServiceAuthError extends AIServiceError {
  constructor(message: string, statusCode: number) {
    super(message, statusCode)
    this.name = 'AIServiceAuthError'
  }
}

export class AIServiceConnectionError extends AIServiceError {
  constructor(
    public baseUrl: string,
    public cause?: unknown
  ) {
    super(`Cannot connect to RavenAIService at ${baseUrl}`)
    this.name = 'AIServiceConnectionError'
  }
}
