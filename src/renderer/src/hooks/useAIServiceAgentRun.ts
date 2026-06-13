import { AIServiceAgentClient, AIServiceAuthError, AIServiceConnectionError } from '@renderer/services/AIServiceAgentClient'
import type {
  AgentRunState,
  AgentRunStatus,
  AgentTraceEvent,
  AIServiceAgentKind,
  AIServiceConfig,
  SSEFrame
} from '@renderer/types/aiServiceAgent'
import { streamSSE } from '@renderer/utils/sseParser'
import { useCallback, useRef, useState } from 'react'

const INITIAL_STATE: AgentRunState = {
  status: 'idle',
  agentKind: null,
  sessionId: null,
  runId: null,
  message: '',
  answerSoFar: '',
  traceEvents: [],
  selectedProjectRepoId: null,
  selectedFile: null,
  error: null
}

export function applyAIServiceAgentEvent(state: AgentRunState, frame: SSEFrame): AgentRunState {
  const next = { ...state }
  const d = frame.data

  if (d.session_id && typeof d.session_id === 'string') {
    next.sessionId = d.session_id
  }
  if (d.run_id && typeof d.run_id === 'string') {
    next.runId = d.run_id
  }

  if (d.type === 'agent_trace' && d.trace) {
    const trace = d.trace as Record<string, unknown>
    const traceType = (trace.type as string) || 'system_notice'
    const event: AgentTraceEvent = {
      type: traceType as AgentTraceEvent['type'],
      timestamp: Date.now(),
      data: trace
    }
    next.traceEvents = [...next.traceEvents, event]

    if (traceType === 'answer_delta' && typeof trace.content === 'string') {
      next.answerSoFar += trace.content
    }
  }

  if (d.type === 'answer_delta' && typeof d.content === 'string') {
    next.answerSoFar += d.content
    next.traceEvents = [
      ...next.traceEvents,
      { type: 'answer_delta', timestamp: Date.now(), data: d }
    ]
  }

  if (d.type === 'done' || d.type === 'run_complete') {
    next.status = 'succeeded'
    if (d.answer && typeof d.answer === 'string') {
      next.answerSoFar = d.answer
    }
    next.traceEvents = [
      ...next.traceEvents,
      { type: 'run_complete', timestamp: Date.now(), data: d }
    ]
  }

  if (d.type === 'cancelled') {
    next.status = 'cancelled'
    next.traceEvents = [
      ...next.traceEvents,
      { type: 'cancelled', timestamp: Date.now(), data: d }
    ]
  }

  if (d.type === 'error') {
    next.status = 'failed'
    next.error = (d.message as string) || (d.detail as string) || 'Agent run failed'
    next.traceEvents = [
      ...next.traceEvents,
      { type: 'error', timestamp: Date.now(), data: d }
    ]
  }

  return next
}

function isTerminal(status: AgentRunStatus): boolean {
  return status === 'succeeded' || status === 'failed' || status === 'cancelled'
}

export function useAIServiceAgentRun() {
  const [runState, setRunState] = useState<AgentRunState>(INITIAL_STATE)
  const abortRef = useRef<AbortController | null>(null)
  const clientRef = useRef<AIServiceAgentClient | null>(null)

  const initClient = useCallback((config: AIServiceConfig) => {
    if (clientRef.current) {
      clientRef.current.updateConfig(config)
    } else {
      clientRef.current = new AIServiceAgentClient(config)
    }
  }, [])

  const startRun = useCallback(
    async (params: {
      agentKind: AIServiceAgentKind
      message: string
      projectRepoId?: number | null
      file?: File | null
      sessionId?: string
    }) => {
      if (!clientRef.current) throw new Error('AIServiceAgentClient not initialized')

      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac

      setRunState(() => ({
        ...INITIAL_STATE,
        status: 'running',
        agentKind: params.agentKind,
        message: params.message,
        selectedProjectRepoId: params.projectRepoId ?? null,
        selectedFile: params.file ?? null,
        sessionId: params.sessionId ?? null
      }))

      try {
        let res: Response
        if (params.agentKind === 'log-analysis') {
          res = await clientRef.current.startLogAnalysisRun({
            message: params.message,
            sessionId: params.sessionId,
            projectRepoId: params.projectRepoId ?? undefined,
            file: params.file ?? undefined,
            remember: true,
            signal: ac.signal
          })
        } else {
          if (!params.projectRepoId) throw new Error('Project repository is required for Project Expert')
          res = await clientRef.current.startProjectExpertRun({
            message: params.message,
            projectRepoId: params.projectRepoId,
            sessionId: params.sessionId,
            remember: true,
            signal: ac.signal
          })
        }

        if (!res.ok) {
          let detail = ''
          try {
            const body = await res.json()
            detail = body?.detail || body?.message || `HTTP ${res.status}`
          } catch {
            detail = `HTTP ${res.status}`
          }
          if (res.status === 401 || res.status === 403) {
            throw new AIServiceAuthError(detail, res.status)
          }
          throw new Error(detail)
        }

        if (!res.body) throw new Error('No response body')
        const reader = res.body.getReader()

        for await (const frame of streamSSE(reader, ac.signal)) {
          if (ac.signal.aborted) break
          setRunState((prev) => applyAIServiceAgentEvent(prev, frame))
        }

        setRunState((prev) => {
          if (!isTerminal(prev.status) && !ac.signal.aborted) {
            return { ...prev, status: 'stale' }
          }
          return prev
        })
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          setRunState((prev) => (prev.status === 'running' ? { ...prev, status: 'cancelled' } : prev))
          return
        }
        const errorMsg =
          err instanceof AIServiceConnectionError
            ? `Cannot connect to RavenAIService at ${(err as AIServiceConnectionError).baseUrl}`
            : err instanceof AIServiceAuthError
              ? `Authentication failed: ${err.message}. Please check your RavenAIService token.`
              : err instanceof Error
                ? err.message
                : 'Unknown error'
        setRunState((prev) => ({ ...prev, status: 'failed', error: errorMsg }))
      }
    },
    []
  )

  const cancelRun = useCallback(async () => {
    abortRef.current?.abort()
    if (clientRef.current && runState.agentKind) {
      try {
        await clientRef.current.cancelRun({
          agentKind: runState.agentKind,
          runId: runState.runId,
          sessionId: runState.sessionId
        })
      } catch {
        // Best effort cancel
      }
    }
    setRunState((prev) => (prev.status === 'running' ? { ...prev, status: 'cancelled' } : prev))
  }, [runState.agentKind, runState.runId, runState.sessionId])

  const retry = useCallback(() => {
    if (!runState.agentKind || !runState.message) return
    startRun({
      agentKind: runState.agentKind,
      message: runState.message,
      projectRepoId: runState.selectedProjectRepoId,
      file: runState.selectedFile
    })
  }, [runState.agentKind, runState.message, runState.selectedProjectRepoId, runState.selectedFile, startRun])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setRunState(INITIAL_STATE)
  }, [])

  return {
    runState,
    initClient,
    startRun,
    cancelRun,
    retry,
    reset,
    client: clientRef
  }
}
