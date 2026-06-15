import { agentKindToBackend, backendToAgentKind } from '@renderer/types/aiServiceAgent'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { conversationStore, THINKING_PLACEHOLDER } from '../conversationStore'

function sseResponse(frames: object[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const f of frames) controller.enqueue(encoder.encode(`data: ${JSON.stringify(f)}\n\n`))
      controller.close()
    }
  })
  return { ok: true, status: 200, body: stream } as unknown as Response
}

function makeClient(overrides: Record<string, unknown> = {}) {
  return {
    listSessions: vi.fn().mockResolvedValue([]),
    fetchMessages: vi.fn().mockResolvedValue([]),
    getActiveRun: vi.fn().mockResolvedValue({ ok: false, status: 404 }),
    cancelRun: vi.fn().mockResolvedValue(undefined),
    startProjectExpertRun: vi.fn(),
    startLogAnalysisRun: vi.fn(),
    startPackageSearchRun: vi.fn(),
    ...overrides
  }
}

afterEach(() => {
  conversationStore.reset()
  conversationStore.setClient(null)
  vi.restoreAllMocks()
})

describe('agent kind mapping', () => {
  it('maps frontend <-> backend kinds', () => {
    expect(agentKindToBackend('log-analysis')).toBe('log_analysis')
    expect(agentKindToBackend('project-expert')).toBe('project_expert')
    expect(agentKindToBackend('package-search')).toBe('package_search')
    expect(backendToAgentKind('log_analysis')).toBe('log-analysis')
    expect(backendToAgentKind('package_search')).toBe('package-search')
    expect(backendToAgentKind('project_expert')).toBe('project-expert')
    expect(backendToAgentKind(undefined)).toBeNull()
    expect(backendToAgentKind('device')).toBeNull()
  })
})

describe('conversationStore.startRun', () => {
  it('streams answer deltas into a succeeded assistant message', async () => {
    const client = makeClient({
      startProjectExpertRun: vi.fn().mockResolvedValue(
        sseResponse([
          { event: 'session', session_id: 's1', run_id: 'r1' },
          { type: 'answer_delta', run_id: 'r1', seq: 1, text_chunk: 'Hello ' },
          { type: 'answer_delta', run_id: 'r1', seq: 2, text_chunk: 'world' },
          { type: 'run_complete', run_id: 'r1', seq: 3, final_text: 'Hello world' }
        ])
      )
    })
    conversationStore.setClient(client as never)

    await conversationStore.startRun('s1', {
      agentKind: 'project-expert',
      message: 'explain auth',
      projectRepoId: 7
    })

    const state = conversationStore.ensureState('s1')
    expect(state.messages).toHaveLength(2)
    expect(state.messages[0]).toMatchObject({ role: 'user', content: 'explain auth' })
    expect(state.messages[1].role).toBe('ai')
    expect(state.messages[1].content).toBe('Hello world')
    expect(state.runStatus).toBe('succeeded')
    expect(state.isSending).toBe(false)
    expect(client.startProjectExpertRun).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'explain auth', projectRepoId: 7, sessionId: 's1' })
    )
  })

  it('marks the run failed on an error frame', async () => {
    const client = makeClient({
      startLogAnalysisRun: vi.fn().mockResolvedValue(
        sseResponse([
          { event: 'session', session_id: 's2', run_id: 'r2' },
          { type: 'error', run_id: 'r2', seq: 1, message: 'boom' }
        ])
      )
    })
    conversationStore.setClient(client as never)

    await conversationStore.startRun('s2', { agentKind: 'log-analysis', message: 'check logs' })

    const state = conversationStore.ensureState('s2')
    expect(state.runStatus).toBe('failed')
    expect(state.messages[1].content).toBe('boom')
    expect(state.messages[1].content).not.toBe(THINKING_PLACEHOLDER)
  })

  it('supports a second turn reusing the same session id', async () => {
    const client = makeClient({
      startPackageSearchRun: vi
        .fn()
        .mockResolvedValueOnce(
          sseResponse([
            { event: 'session', session_id: 's3', run_id: 'r3a' },
            { type: 'answer_delta', run_id: 'r3a', seq: 1, text_chunk: 'first' },
            { type: 'run_complete', run_id: 'r3a', seq: 2, final_text: 'first' }
          ])
        )
        .mockResolvedValueOnce(
          sseResponse([
            { event: 'session', session_id: 's3', run_id: 'r3b' },
            { type: 'answer_delta', run_id: 'r3b', seq: 1, text_chunk: 'second' },
            { type: 'run_complete', run_id: 'r3b', seq: 2, final_text: 'second' }
          ])
        )
    })
    conversationStore.setClient(client as never)

    await conversationStore.startRun('s3', { agentKind: 'package-search', message: 'q1', projectRepoId: 1 })
    await conversationStore.startRun('s3', { agentKind: 'package-search', message: 'q2', projectRepoId: 1 })

    const state = conversationStore.ensureState('s3')
    expect(state.messages).toHaveLength(4)
    expect(state.messages.map((m) => m.content)).toEqual(['q1', 'first', 'q2', 'second'])
    expect(client.startPackageSearchRun).toHaveBeenCalledTimes(2)
  })
})

describe('conversationStore.cancelActiveRun', () => {
  it('calls cancelRun with the active run id and mapped agent kind', async () => {
    const client = makeClient()
    conversationStore.setClient(client as never)
    const state = conversationStore.ensureState('s4')
    state.isSending = true
    state.activeRunId = 'r4'
    state.runAgentKind = 'project_expert'

    await conversationStore.cancelActiveRun('s4')

    expect(client.cancelRun).toHaveBeenCalledWith({
      agentKind: 'project-expert',
      runId: 'r4',
      sessionId: 's4'
    })
  })
})
