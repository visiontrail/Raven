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
  if (typeof localStorage !== 'undefined') localStorage.clear()
  vi.restoreAllMocks()
})

function makeSummary(id: string, overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString()
  return {
    id,
    title: id,
    last_message_at: now,
    message_count: 2,
    created_at: now,
    updated_at: now,
    run_agent_kind: 'project_expert',
    ...overrides
  }
}

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

  it('coalesces store notifications across a high-frequency stream', async () => {
    // Regression: a real run emits thousands of SSE frames. Notifying React's
    // useSyncExternalStore listeners once per frame mutates the store faster than
    // a render can commit, which React aborts with "Maximum update depth
    // exceeded" and kills the stream. notify() must coalesce.
    const frames: object[] = [{ event: 'session', session_id: 's-burst', run_id: 'rb' }]
    for (let i = 1; i <= 300; i++) {
      frames.push({ type: 'answer_delta', run_id: 'rb', seq: i, text_chunk: 'x' })
    }
    frames.push({ type: 'run_complete', run_id: 'rb', seq: 301, final_text: 'done' })

    const client = makeClient({
      startProjectExpertRun: vi.fn().mockResolvedValue(sseResponse(frames))
    })
    conversationStore.setClient(client as never)

    let notifications = 0
    const unsub = conversationStore.subscribe(() => {
      notifications++
    })

    await conversationStore.startRun('s-burst', { agentKind: 'project-expert', message: 'q', projectRepoId: 1 })
    // Let the coalesced rAF/setTimeout flushes settle.
    await new Promise((resolve) => setTimeout(resolve, 50))
    unsub()

    const state = conversationStore.ensureState('s-burst')
    expect(state.messages[1].content).toBe('done')
    expect(state.runStatus).toBe('succeeded')
    // 300+ frames must collapse into a tiny number of React notifications.
    expect(notifications).toBeGreaterThan(0)
    expect(notifications).toBeLessThan(20)
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

describe('conversationStore session history', () => {
  it('keeps a finished session in the sidebar even when the server list omits it', async () => {
    // Regression for the "history vanishes the moment the run completes" bug:
    // markTerminal triggers a silent loadSessions, and the server may not have
    // surfaced the just-finished session yet. It must not be wiped.
    const client = makeClient({
      listSessions: vi.fn().mockResolvedValue([]),
      startProjectExpertRun: vi.fn().mockResolvedValue(
        sseResponse([
          { event: 'session', session_id: 'keep1', run_id: 'rk1' },
          { type: 'answer_delta', run_id: 'rk1', seq: 1, text_chunk: 'hi' },
          { type: 'run_complete', run_id: 'rk1', seq: 2, final_text: 'hi' }
        ])
      )
    })
    conversationStore.setClient(client as never)

    await conversationStore.startRun('keep1', { agentKind: 'project-expert', message: 'q', projectRepoId: 1 })
    // Let the fire-and-forget silent loadSessions inside markTerminal settle.
    await new Promise((resolve) => setTimeout(resolve, 0))

    const kept = conversationStore.sessions.find((s) => s.id === 'keep1')
    expect(kept).toBeTruthy()
    expect(kept?.run_status).toBe('succeeded')
  })

  it('merges server sessions with local-only sessions on loadSessions', async () => {
    const client = makeClient({ listSessions: vi.fn().mockResolvedValue([makeSummary('srv1')]) })
    conversationStore.setClient(client as never)

    const local = conversationStore.ensureState('loc1')
    local.messages.push({ id: 'u', role: 'user', content: 'local question', kind: 'user' })
    conversationStore.sessions = [makeSummary('loc1', { title: 'Local' })]

    await conversationStore.loadSessions()

    const ids = conversationStore.sessions.map((s) => s.id)
    expect(ids).toContain('srv1')
    expect(ids).toContain('loc1')
  })

  it('hydrates persisted sessions and messages on attachUser', () => {
    const blob = {
      v: 1,
      sessions: [makeSummary('h1', { title: 'Cached' })],
      messages: {
        h1: [
          { id: 'm1', role: 'user', content: 'hello' },
          { id: 'm2', role: 'ai', content: 'world' }
        ]
      }
    }
    localStorage.setItem('raven-ai-conversations::u1', JSON.stringify(blob))

    conversationStore.attachUser('u1')

    expect(conversationStore.sessions.some((s) => s.id === 'h1')).toBe(true)
    const state = conversationStore.ensureState('h1')
    expect(state.messages.map((m) => m.content)).toEqual(['hello', 'world'])
  })

  it('persists a finished conversation so it survives a reset + re-attach', async () => {
    const client = makeClient({
      listSessions: vi.fn().mockResolvedValue([]),
      startProjectExpertRun: vi.fn().mockResolvedValue(
        sseResponse([
          { event: 'session', session_id: 'persist1', run_id: 'rp1' },
          { type: 'answer_delta', run_id: 'rp1', seq: 1, text_chunk: 'answer' },
          { type: 'run_complete', run_id: 'rp1', seq: 2, final_text: 'answer' }
        ])
      )
    })
    conversationStore.setClient(client as never)
    conversationStore.attachUser('u2')

    await conversationStore.startRun('persist1', {
      agentKind: 'project-expert',
      message: 'my question',
      projectRepoId: 1
    })
    // Allow the debounced persist write to flush.
    await new Promise((resolve) => setTimeout(resolve, 600))

    // Simulate logout (reset) then logging back in (attachUser).
    conversationStore.reset()
    expect(conversationStore.sessions).toHaveLength(0)
    conversationStore.attachUser('u2')

    const restored = conversationStore.sessions.find((s) => s.id === 'persist1')
    expect(restored).toBeTruthy()
    const state = conversationStore.ensureState('persist1')
    expect(state.messages.map((m) => m.content)).toEqual(['my question', 'answer'])
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
