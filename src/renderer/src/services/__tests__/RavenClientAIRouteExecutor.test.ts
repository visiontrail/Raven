import type { RavenClientAIRoute } from '@renderer/types/aiServiceAgent'
import { describe, expect, it, vi } from 'vitest'

import { executeRavenClientAIRoutes } from '../RavenClientAIRouteExecutor'

type TestChunk = { type: 'created' | 'text' | 'complete'; response?: Record<string, unknown> }

const route = (slot: 'primary' | 'backup'): RavenClientAIRoute => ({
  slot,
  provider: `provider-${slot}`,
  base_url: `https://${slot}.example.test`,
  api_key: `${slot}-secret`,
  model: `model-${slot}`,
  small_fast_model: null,
  capabilities: {
    image_input: false,
    document_input: false,
    tool_use: true,
    partial_streaming: true,
    thinking_budget: false
  }
})

function options(runAttempt: any) {
  return {
    routes: [route('primary'), route('backup')],
    runAttempt,
    onChunk: vi.fn(),
    isCommitChunk: (chunk: TestChunk) => chunk.type === 'text',
    isTerminalChunk: (chunk: TestChunk) => chunk.type === 'complete',
    readUsage: (chunk: TestChunk) => ({ usage: chunk.response?.usage as Record<string, unknown> | undefined }),
    reportUsage: vi.fn().mockResolvedValue(undefined),
    refreshRoutes: vi.fn().mockResolvedValue(undefined),
    newInvocationId: vi.fn().mockReturnValueOnce('inv-primary').mockReturnValueOnce('inv-backup'),
    now: vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(150).mockReturnValueOnce(200).mockReturnValueOnce(260)
  }
}

describe('executeRavenClientAIRoutes', () => {
  it('fails over before content commits and suppresses failed terminal chunks', async () => {
    const runAttempt = vi.fn(async (current: RavenClientAIRoute, onChunk: (chunk: TestChunk) => void) => {
      onChunk({ type: 'created' })
      if (current.slot === 'primary') {
        onChunk({ type: 'complete' })
        throw Object.assign(new Error('network unavailable'), { status: 503 })
      }
      onChunk({ type: 'text' })
      onChunk({ type: 'complete', response: { usage: { prompt_tokens: 8, completion_tokens: 3 } } })
      return 'backup-result'
    })
    const subject = options(runAttempt)

    await expect(executeRavenClientAIRoutes<TestChunk, string>(subject)).resolves.toBe('backup-result')
    expect(runAttempt.mock.calls.map((call) => call[0].slot)).toEqual(['primary', 'backup'])
    expect(subject.refreshRoutes).toHaveBeenCalledOnce()
    expect(subject.onChunk.mock.calls.map((call) => call[0].type)).toEqual(['created', 'created', 'text', 'complete'])
    expect(subject.reportUsage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ invocation_id: 'inv-primary', slot: 'primary', status: 'failed' })
    )
    expect(subject.reportUsage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        invocation_id: 'inv-backup',
        slot: 'backup',
        status: 'succeeded',
        tokens: expect.objectContaining({ input_tokens: 8, output_tokens: 3 })
      })
    )
    expect(Object.keys(subject.reportUsage.mock.calls[1][0]).sort()).toEqual(
      ['duration_ms', 'invocation_id', 'model', 'outcome', 'provider', 'slot', 'status', 'tokens', 'ttft_ms'].sort()
    )
  })

  it('does not retry after any meaningful content has committed', async () => {
    const failure = new Error('provider failed after streaming')
    const runAttempt = vi.fn(async (_route: RavenClientAIRoute, onChunk: (chunk: TestChunk) => void) => {
      onChunk({ type: 'text' })
      throw failure
    })
    const subject = options(runAttempt)

    await expect(executeRavenClientAIRoutes<TestChunk, string>(subject)).rejects.toBe(failure)
    expect(runAttempt).toHaveBeenCalledOnce()
    expect(subject.refreshRoutes).not.toHaveBeenCalled()
  })

  it('does not retry an explicit cancellation', async () => {
    const aborted = new DOMException('Aborted', 'AbortError')
    const runAttempt = vi.fn().mockRejectedValue(aborted)
    const subject = options(runAttempt)

    await expect(executeRavenClientAIRoutes<TestChunk, string>(subject)).rejects.toBe(aborted)
    expect(runAttempt).toHaveBeenCalledOnce()
    expect(subject.reportUsage).toHaveBeenCalledWith(expect.objectContaining({ status: 'cancelled' }))
  })
})
