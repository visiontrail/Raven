import type { RavenClientAIRoute, RavenClientAIUsageReport } from '@renderer/types/aiServiceAgent'
import { isAbortError } from '@renderer/utils/error'

interface ExecuteOptions<TChunk, TResult> {
  routes: RavenClientAIRoute[]
  onRouteSelected?: (route: RavenClientAIRoute) => Promise<void> | void
  runAttempt: (route: RavenClientAIRoute, onChunk: (chunk: TChunk) => void) => Promise<TResult>
  onChunk: (chunk: TChunk) => void
  isCommitChunk: (chunk: TChunk) => boolean
  isTerminalChunk: (chunk: TChunk) => boolean
  readUsage: (chunk: TChunk) => {
    usage?: Record<string, unknown>
    metrics?: Record<string, unknown>
  }
  reportUsage: (payload: RavenClientAIUsageReport) => Promise<void>
  refreshRoutes: () => Promise<unknown>
  newInvocationId: () => string
  now?: () => number
}

export function classifyClientAIError(error: any): {
  status: 'failed' | 'cancelled' | 'timeout'
  outcome?: 'timeout' | 'hard_failure'
  kind: string
} {
  if (isAbortError(error)) return { status: 'cancelled', kind: 'aborted' }
  const message = String(error?.message || '').toLowerCase()
  const code = Number(error?.status || error?.statusCode || error?.code)
  if (message.includes('timeout') || message.includes('timed out') || code === 408) {
    return { status: 'timeout', outcome: 'timeout', kind: 'timeout' }
  }
  if (code === 401 || code === 403) return { status: 'failed', outcome: 'hard_failure', kind: 'upstream_auth' }
  if (code === 429) return { status: 'failed', outcome: 'hard_failure', kind: 'rate_limited' }
  if (message.includes('network') || message.includes('fetch') || message.includes('connect')) {
    return { status: 'failed', outcome: 'hard_failure', kind: 'network_error' }
  }
  return { status: 'failed', outcome: 'hard_failure', kind: 'provider_error' }
}

function tokensFrom(usage?: Record<string, unknown>) {
  return {
    input_tokens: Number(usage?.prompt_tokens || usage?.input_tokens || 0),
    output_tokens: Number(usage?.completion_tokens || usage?.output_tokens || 0),
    cache_read_tokens: Number(usage?.cache_read_tokens || 0),
    cache_write_tokens: Number(usage?.cache_write_tokens || 0)
  }
}

export async function executeRavenClientAIRoutes<TChunk, TResult>(
  options: ExecuteOptions<TChunk, TResult>
): Promise<TResult> {
  const now = options.now ?? Date.now
  let lastError: unknown

  for (let index = 0; index < options.routes.length; index++) {
    const route = options.routes[index]
    const invocationId = options.newInvocationId()
    const startedAt = now()
    let committed = false
    let usage: Record<string, unknown> | undefined
    let metrics: Record<string, unknown> | undefined
    const terminalChunks: TChunk[] = []
    const onAttemptChunk = (chunk: TChunk) => {
      if (options.isCommitChunk(chunk)) committed = true
      const observed = options.readUsage(chunk)
      if (observed.usage) usage = observed.usage
      if (observed.metrics) metrics = observed.metrics
      if (options.isTerminalChunk(chunk)) terminalChunks.push(chunk)
      else options.onChunk(chunk)
    }
    try {
      await options.onRouteSelected?.(route)
      const result = await options.runAttempt(route, onAttemptChunk)
      terminalChunks.forEach(options.onChunk)
      await options.reportUsage({
        invocation_id: invocationId,
        slot: route.slot,
        provider: route.provider,
        model: route.model,
        status: 'succeeded',
        outcome: 'ok',
        tokens: tokensFrom(usage),
        duration_ms: now() - startedAt,
        ttft_ms: Number(metrics?.time_first_token_millsec || 0)
      })
      return result
    } catch (error) {
      lastError = error
      const failure = classifyClientAIError(error)
      await options.reportUsage({
        invocation_id: invocationId,
        slot: route.slot,
        provider: route.provider,
        model: route.model,
        status: failure.status,
        outcome: failure.outcome,
        tokens: tokensFrom(usage),
        duration_ms: now() - startedAt,
        ttft_ms: metrics?.time_first_token_millsec ? Number(metrics.time_first_token_millsec) : undefined,
        error_kind: failure.kind
      })

      if (failure.status === 'cancelled' || committed || index === options.routes.length - 1) throw error
      await options.refreshRoutes().catch(() => undefined)
    }
  }

  throw lastError || new Error('RavenAIService model capabilities are unavailable')
}
