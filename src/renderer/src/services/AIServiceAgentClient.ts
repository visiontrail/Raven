import { loggerService } from '@logger'
import i18n from '@renderer/i18n'
import type {
  AIServiceAgentKind,
  AIServiceConfig,
  ChatMessageRecord,
  ChatSessionSummary,
  HistoryTurn,
  ProjectRepoOption,
  RavenClientAICapabilitySnapshot,
  RavenClientAIUsageReport,
  UserAuthPayload,
  UserProfile,
  UserRegistrationRequest
} from '@renderer/types/aiServiceAgent'

const logger = loggerService.withContext('AIServiceAgentClient')

interface ApiEnvelope<T> {
  success?: boolean
  data?: T
  message?: string
}

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

  setToken(token?: string) {
    this.token = token
  }

  getBaseUrl(): string {
    return this.baseUrl
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {}
    if (this.token) {
      h['Authorization'] = `Bearer ${this.token}`
    }
    return h
  }

  private jsonHeaders(): Record<string, string> {
    return { ...this.headers(), 'Content-Type': 'application/json' }
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

  // ---- auth ---------------------------------------------------------------

  async login(username: string, password: string): Promise<UserAuthPayload> {
    const res = await fetch(`${this.baseUrl}/api/v1/users/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    }).catch((err) => {
      throw new AIServiceConnectionError(this.baseUrl, err)
    })
    const body = await this.handleResponse<ApiEnvelope<UserAuthPayload> | UserAuthPayload>(res)
    const payload = 'token' in body ? (body as UserAuthPayload) : (body as ApiEnvelope<UserAuthPayload>).data
    if (!payload?.token) throw new AIServiceError(i18n.t('agents.aiservice.error.token_missing'))
    this.token = payload.token
    return payload
  }

  async register(payload: UserRegistrationRequest): Promise<UserAuthPayload> {
    const res = await fetch(`${this.baseUrl}/api/v1/users/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch((err) => {
      throw new AIServiceConnectionError(this.baseUrl, err)
    })
    const body = await this.handleResponse<ApiEnvelope<UserAuthPayload> | UserAuthPayload>(res)
    const auth = 'token' in body ? (body as UserAuthPayload) : (body as ApiEnvelope<UserAuthPayload>).data
    if (!auth?.token) throw new AIServiceError(i18n.t('agents.aiservice.error.token_missing'))
    this.token = auth.token
    return auth
  }

  async getProfile(): Promise<UserProfile> {
    const res = await fetch(`${this.baseUrl}/api/v1/users/auth/me`, {
      headers: this.headers()
    }).catch((err) => {
      throw new AIServiceConnectionError(this.baseUrl, err)
    })
    const body = await this.handleResponse<ApiEnvelope<UserProfile>>(res)
    if (!body?.data) throw new AIServiceError(i18n.t('agents.aiservice.error.profile_missing'))
    return body.data
  }

  // ---- RavenClient direct AI runtime ------------------------------------

  async getClientAICapabilities(): Promise<RavenClientAICapabilitySnapshot> {
    const res = await fetch(`${this.baseUrl}/api/v1/client-ai/capabilities`, {
      headers: { ...this.headers(), 'Cache-Control': 'no-cache' },
      cache: 'no-store'
    }).catch((err) => {
      throw new AIServiceConnectionError(this.baseUrl, err)
    })
    const body = await this.handleResponse<ApiEnvelope<RavenClientAICapabilitySnapshot>>(res)
    if (!body?.data?.routes?.length) {
      throw new AIServiceError(i18n.t('ravenAccount.error.capabilities_missing'), res.status)
    }
    return body.data
  }

  async reportClientAIUsage(payload: RavenClientAIUsageReport): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/v1/client-ai/usage`, {
      method: 'POST',
      headers: this.jsonHeaders(),
      body: JSON.stringify(payload)
    }).catch((err) => {
      throw new AIServiceConnectionError(this.baseUrl, err)
    })
    await this.handleResponse<ApiEnvelope<{ invocation_id: string }>>(res)
  }

  // ---- project repos ------------------------------------------------------

  async listProjectRepos(): Promise<ProjectRepoOption[]> {
    const res = await fetch(`${this.baseUrl}/api/v1/project-repos?limit=200`, {
      headers: this.headers()
    }).catch((err) => {
      throw new AIServiceConnectionError(this.baseUrl, err)
    })
    const data = await this.handleResponse<
      { data?: ProjectRepoOption[]; items?: ProjectRepoOption[] } | ProjectRepoOption[]
    >(res)
    if (Array.isArray(data)) return data
    return data.data ?? data.items ?? []
  }

  // ---- chat sessions (per-user history) -----------------------------------

  async listSessions(): Promise<ChatSessionSummary[]> {
    const res = await fetch(`${this.baseUrl}/api/v1/users/chat-sessions`, {
      headers: this.headers()
    }).catch((err) => {
      throw new AIServiceConnectionError(this.baseUrl, err)
    })
    const body = await this.handleResponse<ApiEnvelope<ChatSessionSummary[]>>(res)
    return body?.data ?? []
  }

  async fetchMessages(sessionId: string): Promise<ChatMessageRecord[]> {
    const res = await fetch(`${this.baseUrl}/api/v1/users/chat-sessions/${encodeURIComponent(sessionId)}/messages`, {
      headers: this.headers()
    }).catch((err) => {
      throw new AIServiceConnectionError(this.baseUrl, err)
    })
    const body = await this.handleResponse<ApiEnvelope<ChatMessageRecord[]>>(res)
    return body?.data ?? []
  }

  async deleteSession(sessionId: string): Promise<ChatSessionSummary[]> {
    const res = await fetch(`${this.baseUrl}/api/v1/users/chat-sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
      headers: this.headers()
    }).catch((err) => {
      throw new AIServiceConnectionError(this.baseUrl, err)
    })
    const body = await this.handleResponse<ApiEnvelope<ChatSessionSummary[]>>(res)
    return body?.data ?? []
  }

  async renameSession(sessionId: string, title: string): Promise<ChatSessionSummary[]> {
    const res = await fetch(`${this.baseUrl}/api/v1/users/chat-sessions/${encodeURIComponent(sessionId)}/rename`, {
      method: 'PATCH',
      headers: this.jsonHeaders(),
      body: JSON.stringify({ title })
    }).catch((err) => {
      throw new AIServiceConnectionError(this.baseUrl, err)
    })
    const body = await this.handleResponse<ApiEnvelope<ChatSessionSummary[]>>(res)
    return body?.data ?? []
  }

  async pinSession(sessionId: string, pinned: boolean): Promise<ChatSessionSummary[]> {
    const res = await fetch(`${this.baseUrl}/api/v1/users/chat-sessions/${encodeURIComponent(sessionId)}/pin`, {
      method: 'PATCH',
      headers: this.jsonHeaders(),
      body: JSON.stringify({ pinned })
    }).catch((err) => {
      throw new AIServiceConnectionError(this.baseUrl, err)
    })
    const body = await this.handleResponse<ApiEnvelope<ChatSessionSummary[]>>(res)
    return body?.data ?? []
  }

  // ---- run lifecycle ------------------------------------------------------

  /** Query the active-run snapshot for a session. Returns the raw Response (may be 404). */
  getActiveRun(sessionId: string, signal?: AbortSignal): Promise<Response> {
    return fetch(`${this.baseUrl}/api/v1/ai-chat/chat/sessions/${encodeURIComponent(sessionId)}/active-run`, {
      headers: this.headers(),
      signal
    }).catch((err) => {
      if (err?.name === 'AbortError') throw err
      throw new AIServiceConnectionError(this.baseUrl, err)
    })
  }

  /** Subscribe to an existing run's SSE stream. */
  async subscribeRun(runId: string, signal?: AbortSignal): Promise<Response> {
    const url = `${this.baseUrl}/api/v1/ai-chat/chat/runs/${encodeURIComponent(runId)}/stream`
    const startedAt = Date.now()
    logger.info('subscribeRun: GET stream request', { runId, url, hasToken: !!this.token }, { logToMain: true })
    try {
      const res = await fetch(url, { headers: this.headers(), signal })
      logger.info(
        'subscribeRun: GET stream response',
        {
          runId,
          status: res.status,
          ok: res.ok,
          contentType: res.headers?.get?.('content-type') ?? null,
          latencyMs: Date.now() - startedAt
        },
        { logToMain: true }
      )
      return res
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw err
      logger.error('subscribeRun: GET stream connection failed', err as Error, {
        runId,
        url,
        latencyMs: Date.now() - startedAt
      })
      throw new AIServiceConnectionError(this.baseUrl, err)
    }
  }

  async startLogAnalysisRun(params: {
    message: string
    sessionId?: string
    projectRepoId?: number | null
    file?: File | null
    history?: HistoryTurn[]
    remember?: boolean
    signal?: AbortSignal
  }): Promise<Response> {
    const form = new FormData()
    form.append('message', params.message || i18n.t('agents.aiservice.message.default_log_prompt'))
    if (params.sessionId) form.append('session_id', params.sessionId)
    if (params.projectRepoId != null) form.append('project_repo_id', String(params.projectRepoId))
    if (params.file) form.append('file', params.file)
    if (params.history && params.history.length) form.append('history', JSON.stringify(params.history))
    if (params.remember != null) form.append('remember', String(params.remember))

    const url = `${this.baseUrl}/api/v1/ai-chat/log-analysis/stream`
    const startedAt = Date.now()
    logger.info(
      'startLogAnalysisRun: POST stream request',
      {
        url,
        sessionId: params.sessionId,
        projectRepoId: params.projectRepoId ?? null,
        hasFile: !!params.file,
        hasToken: !!this.token
      },
      { logToMain: true }
    )
    try {
      const res = await fetch(url, { method: 'POST', headers: this.headers(), body: form, signal: params.signal })
      logger.info(
        'startLogAnalysisRun: POST stream response',
        {
          status: res.status,
          ok: res.ok,
          contentType: res.headers?.get?.('content-type') ?? null,
          latencyMs: Date.now() - startedAt
        },
        { logToMain: true }
      )
      return res
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw err
      logger.error('startLogAnalysisRun: POST stream connection failed', err as Error, {
        url,
        latencyMs: Date.now() - startedAt
      })
      throw new AIServiceConnectionError(this.baseUrl, err)
    }
  }

  startProjectExpertRun(params: {
    message: string
    projectRepoId: number
    sessionId?: string
    history?: HistoryTurn[]
    remember?: boolean
    signal?: AbortSignal
  }): Promise<Response> {
    return this.startProjectBoundRun('project-expert', params)
  }

  startPackageSearchRun(params: {
    message: string
    projectRepoId: number
    sessionId?: string
    history?: HistoryTurn[]
    remember?: boolean
    signal?: AbortSignal
  }): Promise<Response> {
    return this.startProjectBoundRun('package-search', params)
  }

  private async startProjectBoundRun(
    path: 'project-expert' | 'package-search',
    params: {
      message: string
      projectRepoId: number
      sessionId?: string
      history?: HistoryTurn[]
      remember?: boolean
      signal?: AbortSignal
    }
  ): Promise<Response> {
    const form = new FormData()
    form.append('message', params.message)
    form.append('project_repo_id', String(params.projectRepoId))
    if (params.sessionId) form.append('session_id', params.sessionId)
    if (params.history && params.history.length) form.append('history', JSON.stringify(params.history))
    if (params.remember != null) form.append('remember', String(params.remember))

    const url = `${this.baseUrl}/api/v1/ai-chat/${path}/stream`
    const startedAt = Date.now()
    logger.info(
      'startProjectBoundRun: POST stream request',
      { path, url, projectRepoId: params.projectRepoId, sessionId: params.sessionId, hasToken: !!this.token },
      { logToMain: true }
    )
    try {
      const res = await fetch(url, { method: 'POST', headers: this.headers(), body: form, signal: params.signal })
      logger.info(
        'startProjectBoundRun: POST stream response',
        {
          path,
          status: res.status,
          ok: res.ok,
          contentType: res.headers?.get?.('content-type') ?? null,
          latencyMs: Date.now() - startedAt
        },
        { logToMain: true }
      )
      return res
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw err
      logger.error('startProjectBoundRun: POST stream connection failed', err as Error, {
        path,
        url,
        latencyMs: Date.now() - startedAt
      })
      throw new AIServiceConnectionError(this.baseUrl, err)
    }
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
