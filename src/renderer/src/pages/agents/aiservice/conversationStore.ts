import { AIServiceAgentClient, AIServiceConnectionError } from '@renderer/services/AIServiceAgentClient'
import {
  agentKindToBackend,
  type AgentTraceEvent,
  type AIServiceAgentKind,
  type ChatEntry,
  type ChatSessionSummary,
  type ConversationState,
  type RunStatus
} from '@renderer/types/aiServiceAgent'
import { uuid } from '@renderer/utils'
import { streamSSE } from '@renderer/utils/sseParser'

export const THINKING_PLACEHOLDER = '__RAVEN_AI_THINKING__'

const DEFAULT_LOG_MESSAGE = '请分析这个日志文件'

const DEVICE_TRACE_TYPES = new Set([
  'run_start',
  'run_complete',
  'cancelled',
  'step_start',
  'step_delta',
  'step_end',
  'thinking_start',
  'thinking_delta',
  'thinking_end',
  'system_notice',
  'result_validation'
])

type Payload = Record<string, unknown>

/** Return a shallow copy of an SSE payload with the `event` discriminator removed. */
function stripEvent(payload: Payload): Payload {
  const trace: Payload = { ...payload }
  delete trace.event
  return trace
}

/**
 * Framework-agnostic multi-session conversation store, ported from the
 * RavenAIService web client's `conversationRuns` Pinia store. Consumed in React
 * through `useSyncExternalStore` (see hooks below). Non-serialisable values
 * (File, AbortController) live here rather than in Redux.
 */
class ConversationStore {
  private client: AIServiceAgentClient | null = null
  private listeners = new Set<() => void>()
  private version = 0

  readonly bySession: Record<string, ConversationState> = {}
  sessions: ChatSessionSummary[] = []
  sessionsLoading = false
  sessionsError: string | null = null

  // ---- subscription plumbing ---------------------------------------------

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getVersion = (): number => this.version

  private notify() {
    this.version += 1
    this.listeners.forEach((l) => l())
  }

  setClient(client: AIServiceAgentClient | null) {
    this.client = client
  }

  hasClient(): boolean {
    return !!this.client
  }

  // ---- state helpers ------------------------------------------------------

  ensureState(sessionId: string): ConversationState {
    let state = this.bySession[sessionId]
    if (!state) {
      state = {
        sessionId,
        messages: [],
        loadingMessages: false,
        isSending: false,
        activeRunId: null,
        runStatus: 'idle',
        runAgentKind: null,
        seenSeq: {},
        currentAnswerId: null,
        subscription: null,
        loaded: false,
        lastAgentKind: null,
        lastProjectRepoId: null
      }
      this.bySession[sessionId] = state
    }
    return state
  }

  private ensureAnswerMessage(state: ConversationState, answerId: string): ChatEntry {
    const existing = state.messages.find((m) => m.id === answerId)
    if (existing) return existing
    const placeholder: ChatEntry = { id: answerId, role: 'ai', content: THINKING_PLACEHOLDER, kind: 'answer' }
    state.messages.push(placeholder)
    return placeholder
  }

  private terminalStatus(state: ConversationState): RunStatus {
    if (state.runStatus === 'cancelled' || state.runStatus === 'failed' || state.runStatus === 'stale') {
      return state.runStatus
    }
    return 'succeeded'
  }

  private markTerminal(state: ConversationState, status: RunStatus) {
    state.isSending = false
    state.runStatus = status
    state.activeRunId = null
    state.currentAnswerId = null
    state.runAgentKind = null
    state.subscription = null
    this.notify()
    // Refresh the sidebar so a newly-persisted session/title appears.
    void this.loadSessions({ silent: true })
  }

  // ---- event application --------------------------------------------------

  private applyEventToState(state: ConversationState, payload: Payload) {
    const type = (payload?.event || payload?.type) as string | undefined
    const eventRunId = payload?.run_id as string | undefined
    const eventSessionId = payload?.session_id as string | undefined

    if (eventSessionId && eventSessionId !== state.sessionId) return
    if (eventRunId && state.activeRunId && eventRunId !== state.activeRunId) return

    if (eventRunId && !state.activeRunId) {
      state.activeRunId = eventRunId
      state.runStatus = 'running'
      if (!state.currentAnswerId) state.currentAnswerId = `run:${eventRunId}:assistant`
    }

    const seq = typeof payload?.seq === 'number' ? (payload.seq as number) : null
    if (eventRunId && seq !== null) {
      const key = `${eventRunId}:${seq}`
      if (state.seenSeq[key]) return
      state.seenSeq[key] = 1
    }

    const answerId = state.currentAnswerId || `run:${eventRunId || 'pending'}:assistant`
    if (!state.currentAnswerId) state.currentAnswerId = answerId

    if (type === 'session') return

    if (type === 'log_analysis_status') {
      const target = this.ensureAnswerMessage(state, answerId)
      const statusText = (payload?.message as string) || '正在处理...'
      target.content = `**日志分析 Agent**\n\n${statusText}`
      return
    }
    if (type === 'log_analysis_context') return

    if (type === 'agent_trace') {
      const target = this.ensureAnswerMessage(state, answerId)
      if (!target.traceEvents) target.traceEvents = []
      target.traceRunning = true
      const trace = stripEvent(payload)
      if (trace && typeof trace.seq === 'number' && typeof trace.type === 'string') {
        target.traceEvents.push(trace as unknown as AgentTraceEvent)
        if (trace.type === 'run_complete') {
          state.runStatus = 'succeeded'
          target.traceRunning = false
        } else if (trace.type === 'cancelled') {
          state.runStatus = 'cancelled'
          target.traceRunning = false
        } else if (trace.type === 'error') {
          state.runStatus = 'failed'
          target.traceRunning = false
        }
      }
      return
    }

    if (type === 'answer_delta') {
      const chunk = typeof payload?.text_chunk === 'string' ? (payload.text_chunk as string) : ''
      if (!chunk) return
      const target = this.ensureAnswerMessage(state, answerId)
      if (target.content === THINKING_PLACEHOLDER) target.content = chunk.replace(/^\s+/, '')
      else target.content += chunk
      target.kind = 'answer'
      target.traceRunning = true
      return
    }

    if (typeof type === 'string' && DEVICE_TRACE_TYPES.has(type)) {
      const target = this.ensureAnswerMessage(state, answerId)
      if (!target.traceEvents) target.traceEvents = []
      if (type === 'run_start') target.traceRunning = true
      const trace = stripEvent(payload)
      if (trace && typeof trace.seq === 'number' && typeof trace.type === 'string') {
        target.traceEvents.push(trace as unknown as AgentTraceEvent)
      }
      if (type === 'run_complete') {
        const finalText = payload?.final_text
        if (typeof finalText === 'string' && finalText.trim()) target.content = finalText.trimStart()
        state.runStatus = 'succeeded'
        target.traceRunning = false
      } else if (type === 'cancelled') {
        state.runStatus = 'cancelled'
        target.traceRunning = false
      }
      return
    }

    const target = this.ensureAnswerMessage(state, answerId)
    if (type === 'chunk' && typeof payload?.content === 'string') {
      const chunk = payload.content as string
      if (target.content === THINKING_PLACEHOLDER) {
        const trimmed = chunk.trimStart()
        if (trimmed) target.content = trimmed
      } else {
        target.content += chunk
      }
    } else if (type === 'done') {
      if (typeof payload?.answer === 'string' && payload.answer) target.content = (payload.answer as string).trimStart()
      else if (!target.content || target.content === THINKING_PLACEHOLDER) target.content = '（无内容）'
      const result = payload?.result as Payload | undefined
      const resultStatus = String(result?.status || '').toLowerCase()
      if (resultStatus === 'cancelled') state.runStatus = 'cancelled'
      else if (resultStatus === 'stale') state.runStatus = 'stale'
      else if (resultStatus === 'failed' || resultStatus === 'error') state.runStatus = 'failed'
      else if (state.runStatus !== 'cancelled' && state.runStatus !== 'failed') state.runStatus = 'succeeded'
      target.traceRunning = false
    } else if (type === 'error') {
      const backendMsg = typeof payload?.message === 'string' ? (payload.message as string).trim() : ''
      target.content = backendMsg || '运行出现错误，请稍后重试。'
      state.runStatus = 'failed'
      target.traceRunning = false
    }
  }

  // ---- SSE pump -----------------------------------------------------------

  private async pump(
    state: ConversationState,
    response: Response,
    ac: AbortController,
    pendingAnswerId: string
  ): Promise<{ terminal: boolean }> {
    if (!response.body) throw new Error('Empty response body; cannot stream')
    const reader = response.body.getReader()
    let terminal = false
    for await (const frame of streamSSE(reader, ac.signal)) {
      if (ac.signal.aborted) break
      const payload = frame.data as Payload
      const newRunId = payload?.run_id as string | undefined
      if (newRunId && state.currentAnswerId === pendingAnswerId) {
        const stableId = `run:${newRunId}:assistant`
        const target = state.messages.find((m) => m.id === pendingAnswerId)
        if (target) target.id = stableId
        state.currentAnswerId = stableId
      }
      this.applyEventToState(state, payload)
      const type = (payload?.event || payload?.type) as string | undefined
      if (type === 'done' || type === 'error' || type === 'run_complete' || type === 'cancelled') {
        terminal = true
      }
      this.notify()
    }
    return { terminal }
  }

  // ---- snapshot merge -----------------------------------------------------

  private mergeSnapshot(state: ConversationState, snapshot: Payload) {
    if (!snapshot || typeof snapshot !== 'object') return
    const runId = snapshot.run_id as string | undefined
    if (!runId) return
    state.activeRunId = runId
    state.runStatus = ((snapshot.status as RunStatus) || 'running') as RunStatus
    state.runAgentKind = (snapshot.agent_kind as ConversationState['runAgentKind']) || null
    state.currentAnswerId = `run:${runId}:assistant`
    if (state.runStatus === 'running') state.isSending = true

    const snapshotUserMessage = typeof snapshot.user_message === 'string' ? (snapshot.user_message as string) : ''
    const trimmedUserMessage = snapshotUserMessage.trim()
    if (trimmedUserMessage) {
      const userMsgId = `run:${runId}:user`
      const alreadyPresent = state.messages.some(
        (m) => m.role === 'user' && (m.id === userMsgId || (m.content || '').trim().startsWith(trimmedUserMessage))
      )
      if (!alreadyPresent) {
        state.messages.push({ id: userMsgId, role: 'user', content: snapshotUserMessage, kind: 'user' })
      }
    }

    const trace = Array.isArray(snapshot.trace_events) ? (snapshot.trace_events as Payload[]) : []
    const target = this.ensureAnswerMessage(state, state.currentAnswerId)
    target.traceEvents = []
    target.traceRunning = state.runStatus === 'running'
    for (const ev of trace) {
      if (ev && typeof ev.seq === 'number' && typeof ev.type === 'string') {
        target.traceEvents.push(ev as unknown as AgentTraceEvent)
        state.seenSeq[`${runId}:${ev.seq}`] = 1
      }
    }
    const answerSoFar = snapshot.answer_so_far
    if (typeof answerSoFar === 'string' && answerSoFar.trim()) target.content = answerSoFar.trimStart()
  }

  // ---- public API ---------------------------------------------------------

  abortSubscription(sessionId: string) {
    const state = this.bySession[sessionId]
    if (state?.subscription) {
      try {
        state.subscription.abort()
      } catch {
        /* ignore */
      }
      state.subscription = null
    }
  }

  clearSession(sessionId: string) {
    const state = this.bySession[sessionId]
    if (state?.subscription) {
      try {
        state.subscription.abort()
      } catch {
        /* ignore */
      }
    }
    delete this.bySession[sessionId]
    this.notify()
  }

  reset() {
    for (const id of Object.keys(this.bySession)) this.clearSession(id)
    this.sessions = []
    this.notify()
  }

  async loadSession(sessionId: string, opts: { force?: boolean } = {}): Promise<ConversationState> {
    const state = this.ensureState(sessionId)
    if (!this.client) return state
    if (state.loaded && !opts.force) return state

    state.loadingMessages = true
    this.notify()
    let subscribeRunId: string | null = null
    try {
      try {
        const records = await this.client.fetchMessages(sessionId)
        state.messages = records.map((item) => ({
          id: item.id || uuid(),
          role: item.role,
          content: item.content || '',
          kind: item.role === 'user' ? 'user' : 'answer',
          traceEvents: Array.isArray(item.trace_events) ? (item.trace_events as never[]) : undefined,
          traceRunning: item.run_status === 'running'
        }))
        const lastWithAgent = [...records].reverse().find((m) => m.run_agent_kind)
        if (lastWithAgent?.run_agent_kind) {
          state.lastAgentKind = lastWithAgent.run_agent_kind as ConversationState['lastAgentKind']
        }
      } catch (err) {
        console.warn('Failed to load session messages', err)
      }

      try {
        const resp = await this.client.getActiveRun(sessionId)
        if (resp.ok) {
          const snapshot = (await resp.json()) as Payload
          this.mergeSnapshot(state, snapshot)
          if (state.activeRunId && state.runStatus === 'running') subscribeRunId = state.activeRunId
          else if (state.activeRunId) this.markTerminal(state, this.terminalStatus(state))
        } else if (resp.status === 404 && (state.activeRunId || state.isSending)) {
          this.markTerminal(state, this.terminalStatus(state))
        }
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') console.debug('active-run query skipped', err)
      }

      state.loaded = true
    } finally {
      state.loadingMessages = false
      this.notify()
    }
    if (subscribeRunId) void this.subscribeRun(sessionId, subscribeRunId)
    return state
  }

  private async subscribeRun(sessionId: string, runId: string) {
    const state = this.ensureState(sessionId)
    if (!this.client) return
    if (state.subscription) {
      try {
        state.subscription.abort()
      } catch {
        /* ignore */
      }
    }
    const ac = new AbortController()
    state.subscription = ac
    state.isSending = true
    this.notify()
    try {
      const resp = await this.client.subscribeRun(runId, ac.signal)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const pending = state.currentAnswerId || `run:${runId}:assistant`
      const { terminal } = await this.pump(state, resp, ac, pending)
      if (terminal) this.markTerminal(state, state.runStatus === 'idle' ? 'succeeded' : state.runStatus)
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return
      console.warn('Failed to subscribe to run', err)
      this.markTerminal(state, 'failed')
    } finally {
      if (state.subscription === ac) state.subscription = null
      this.notify()
    }
  }

  async startRun(
    sessionId: string,
    params: {
      agentKind: AIServiceAgentKind
      message: string
      projectRepoId?: number | null
      file?: File | null
      remember?: boolean
    }
  ): Promise<void> {
    if (!this.client) throw new Error('AIServiceAgentClient not initialized')
    const state = this.ensureState(sessionId)
    if (state.isSending) return

    const backendKind = agentKindToBackend(params.agentKind)
    const userDisplay = params.file
      ? `${params.message || DEFAULT_LOG_MESSAGE}\n\n附件: ${params.file.name}`
      : params.message

    state.messages.push({ id: uuid(), role: 'user', content: userDisplay, kind: 'user' })
    const pendingAnswerId = `run:pending:${uuid()}:assistant`
    state.currentAnswerId = pendingAnswerId
    state.messages.push({
      id: pendingAnswerId,
      role: 'ai',
      content: THINKING_PLACEHOLDER,
      kind: 'answer',
      traceEvents: [],
      traceRunning: true
    })
    state.isSending = true
    state.runStatus = 'running'
    state.runAgentKind = backendKind
    state.lastAgentKind = backendKind
    state.lastProjectRepoId = params.projectRepoId ?? null
    this.notify()

    const ac = new AbortController()
    state.subscription = ac

    try {
      let resp: Response
      if (params.agentKind === 'log-analysis') {
        resp = await this.client.startLogAnalysisRun({
          message: params.message,
          sessionId,
          projectRepoId: params.projectRepoId ?? undefined,
          file: params.file ?? undefined,
          remember: params.remember ?? true,
          signal: ac.signal
        })
      } else if (params.agentKind === 'package-search') {
        resp = await this.client.startPackageSearchRun({
          message: params.message,
          sessionId,
          projectRepoId: params.projectRepoId as number,
          remember: params.remember ?? true,
          signal: ac.signal
        })
      } else {
        resp = await this.client.startProjectExpertRun({
          message: params.message,
          sessionId,
          projectRepoId: params.projectRepoId as number,
          remember: params.remember ?? true,
          signal: ac.signal
        })
      }

      if (!resp.ok) {
        let detail = ''
        try {
          const body = (await resp.json()) as Payload
          const det = body?.detail as Payload | string | undefined
          detail =
            (typeof det === 'object' ? (det?.message as string) || (det?.reason as string) : (det as string)) ||
            (body?.message as string) ||
            ''
        } catch {
          /* ignore */
        }
        throw new Error(detail || `HTTP ${resp.status}`)
      }

      const { terminal } = await this.pump(state, resp, ac, pendingAnswerId)
      if (terminal) this.markTerminal(state, this.terminalStatus(state))
      // If the SSE closed early without a terminal frame, leave isSending true
      // so the user can reopen the session and resume via the active-run snapshot.
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return
      const target = state.messages.find((m) => m.id === state.currentAnswerId)
      if (target) {
        target.content =
          err instanceof AIServiceConnectionError
            ? `无法连接到 RavenAIService（${err.baseUrl}），请确认本地服务已启动。`
            : `运行失败：${(err as Error)?.message || String(err)}`
        target.traceRunning = false
      }
      this.markTerminal(state, 'failed')
    } finally {
      if (state.subscription === ac) state.subscription = null
      this.notify()
    }
  }

  private finalizeCancelledLocally(state: ConversationState) {
    const answerId = state.currentAnswerId
    const target = answerId ? state.messages.find((m) => m.id === answerId) : null
    if (target) {
      if (target.content === THINKING_PLACEHOLDER) target.content = '已被用户取消。'
      target.traceRunning = false
    }
    this.abortSubscription(state.sessionId)
    this.markTerminal(state, 'cancelled')
  }

  async cancelActiveRun(sessionId: string): Promise<void> {
    const state = this.ensureState(sessionId)
    if (!this.client) {
      if (state.isSending) this.finalizeCancelledLocally(state)
      return
    }
    const agentKind = backendKindToAgent(state.runAgentKind)
    try {
      await this.client.cancelRun({
        agentKind: agentKind ?? 'project-expert',
        runId: state.activeRunId,
        sessionId
      })
    } catch (err) {
      console.warn('Failed to cancel run', err)
    }
    // Backend will emit a terminal `cancelled` frame the pump picks up. If there
    // is nothing the backend can act on, unstick the panel locally.
    if (!state.activeRunId && !agentKind && state.isSending) this.finalizeCancelledLocally(state)
  }

  // ---- sessions list ------------------------------------------------------

  async loadSessions(opts: { silent?: boolean } = {}): Promise<void> {
    if (!this.client) return
    if (!opts.silent) {
      this.sessionsLoading = true
      this.notify()
    }
    try {
      this.sessions = await this.client.listSessions()
      this.sessionsError = null
    } catch (err) {
      this.sessionsError = (err as Error)?.message || '加载会话历史失败'
    } finally {
      this.sessionsLoading = false
      this.notify()
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (!this.client) return
    this.sessions = await this.client.deleteSession(sessionId)
    this.clearSession(sessionId)
  }

  async renameSession(sessionId: string, title: string): Promise<void> {
    if (!this.client) return
    this.sessions = await this.client.renameSession(sessionId, title)
    this.notify()
  }

  async pinSession(sessionId: string, pinned: boolean): Promise<void> {
    if (!this.client) return
    this.sessions = await this.client.pinSession(sessionId, pinned)
    this.notify()
  }
}

function backendKindToAgent(kind: ConversationState['runAgentKind']): AIServiceAgentKind | null {
  switch (kind) {
    case 'log_analysis':
      return 'log-analysis'
    case 'package_search':
      return 'package-search'
    case 'project_expert':
      return 'project-expert'
    default:
      return null
  }
}

export const conversationStore = new ConversationStore()
