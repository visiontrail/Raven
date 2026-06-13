import { describe, expect, it } from 'vitest'

import type { AgentRunState, SSEFrame } from '@renderer/types/aiServiceAgent'

import { applyAIServiceAgentEvent } from '../useAIServiceAgentRun'

function makeState(overrides: Partial<AgentRunState> = {}): AgentRunState {
  return {
    status: 'running',
    agentKind: 'log-analysis',
    sessionId: null,
    runId: null,
    message: 'analyze',
    answerSoFar: '',
    traceEvents: [],
    selectedProjectRepoId: null,
    selectedFile: null,
    error: null,
    ...overrides
  }
}

describe('applyAIServiceAgentEvent', () => {
  describe('session_id and run_id extraction', () => {
    it('should capture session_id from frame data', () => {
      const frame: SSEFrame = { data: { session_id: 'sess-42' } }
      const next = applyAIServiceAgentEvent(makeState(), frame)
      expect(next.sessionId).toBe('sess-42')
    })

    it('should capture run_id from frame data', () => {
      const frame: SSEFrame = { data: { run_id: 'run-99' } }
      const next = applyAIServiceAgentEvent(makeState(), frame)
      expect(next.runId).toBe('run-99')
    })

    it('should not overwrite sessionId with non-string values', () => {
      const state = makeState({ sessionId: 'existing' })
      const frame: SSEFrame = { data: { session_id: 123 } }
      const next = applyAIServiceAgentEvent(state, frame)
      expect(next.sessionId).toBe('existing')
    })
  })

  describe('answer_delta accumulation', () => {
    it('should append content from top-level answer_delta', () => {
      const state = makeState({ answerSoFar: 'Hello' })
      const frame: SSEFrame = { data: { type: 'answer_delta', content: ' world' } }
      const next = applyAIServiceAgentEvent(state, frame)
      expect(next.answerSoFar).toBe('Hello world')
    })

    it('should append content from agent_trace answer_delta', () => {
      const state = makeState({ answerSoFar: 'A' })
      const frame: SSEFrame = {
        data: {
          type: 'agent_trace',
          trace: { type: 'answer_delta', content: 'B' }
        }
      }
      const next = applyAIServiceAgentEvent(state, frame)
      expect(next.answerSoFar).toBe('AB')
    })

    it('should accumulate multiple deltas', () => {
      let state = makeState()
      const deltas = ['one', ' two', ' three']
      for (const content of deltas) {
        const frame: SSEFrame = { data: { type: 'answer_delta', content } }
        state = applyAIServiceAgentEvent(state, frame)
      }
      expect(state.answerSoFar).toBe('one two three')
    })
  })

  describe('trace event appending', () => {
    it('should append agent_trace events', () => {
      const frame: SSEFrame = {
        data: {
          type: 'agent_trace',
          trace: { type: 'step_start', tool: 'read_file' }
        }
      }
      const next = applyAIServiceAgentEvent(makeState(), frame)
      expect(next.traceEvents).toHaveLength(1)
      expect(next.traceEvents[0].type).toBe('step_start')
    })

    it('should preserve existing trace events', () => {
      const state = makeState({
        traceEvents: [{ type: 'run_start', timestamp: 1000, data: {} }]
      })
      const frame: SSEFrame = {
        data: { type: 'agent_trace', trace: { type: 'system_notice', message: 'hi' } }
      }
      const next = applyAIServiceAgentEvent(state, frame)
      expect(next.traceEvents).toHaveLength(2)
      expect(next.traceEvents[0].type).toBe('run_start')
      expect(next.traceEvents[1].type).toBe('system_notice')
    })
  })

  describe('terminal states', () => {
    it('should set succeeded on done event', () => {
      const frame: SSEFrame = { data: { type: 'done', answer: 'final answer' } }
      const next = applyAIServiceAgentEvent(makeState(), frame)
      expect(next.status).toBe('succeeded')
      expect(next.answerSoFar).toBe('final answer')
    })

    it('should set succeeded on run_complete event', () => {
      const frame: SSEFrame = { data: { type: 'run_complete' } }
      const next = applyAIServiceAgentEvent(makeState(), frame)
      expect(next.status).toBe('succeeded')
    })

    it('should set cancelled on cancelled event', () => {
      const frame: SSEFrame = { data: { type: 'cancelled' } }
      const next = applyAIServiceAgentEvent(makeState(), frame)
      expect(next.status).toBe('cancelled')
    })

    it('should set failed on error event', () => {
      const frame: SSEFrame = { data: { type: 'error', message: 'timeout' } }
      const next = applyAIServiceAgentEvent(makeState(), frame)
      expect(next.status).toBe('failed')
      expect(next.error).toBe('timeout')
    })

    it('should use detail field when message is absent in error', () => {
      const frame: SSEFrame = { data: { type: 'error', detail: 'rate limited' } }
      const next = applyAIServiceAgentEvent(makeState(), frame)
      expect(next.error).toBe('rate limited')
    })

    it('should use fallback error message', () => {
      const frame: SSEFrame = { data: { type: 'error' } }
      const next = applyAIServiceAgentEvent(makeState(), frame)
      expect(next.error).toBe('Agent run failed')
    })
  })

  describe('immutability', () => {
    it('should not mutate the original state', () => {
      const state = makeState()
      const original = { ...state, traceEvents: [...state.traceEvents] }
      applyAIServiceAgentEvent(state, { data: { type: 'answer_delta', content: 'x' } })
      expect(state.answerSoFar).toBe(original.answerSoFar)
      expect(state.traceEvents.length).toBe(original.traceEvents.length)
    })
  })

  describe('done event with final answer override', () => {
    it('should replace accumulated answer with final answer from done event', () => {
      const state = makeState({ answerSoFar: 'partial...' })
      const frame: SSEFrame = { data: { type: 'done', answer: 'Complete answer.' } }
      const next = applyAIServiceAgentEvent(state, frame)
      expect(next.answerSoFar).toBe('Complete answer.')
    })

    it('should keep accumulated answer when done has no answer field', () => {
      const state = makeState({ answerSoFar: 'streamed content' })
      const frame: SSEFrame = { data: { type: 'done' } }
      const next = applyAIServiceAgentEvent(state, frame)
      expect(next.answerSoFar).toBe('streamed content')
    })
  })
})
