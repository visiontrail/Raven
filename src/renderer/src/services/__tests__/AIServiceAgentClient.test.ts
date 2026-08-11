import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  AIServiceAgentClient,
  AIServiceAuthError,
  AIServiceConnectionError,
  AIServiceError
} from '../AIServiceAgentClient'

function mockFetch(overrides: Partial<Response> = {}) {
  const res = {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: vi.fn().mockResolvedValue({}),
    ...overrides
  } as unknown as Response
  return vi.fn<typeof globalThis.fetch>().mockResolvedValue(res)
}

describe('AIServiceAgentClient', () => {
  let client: AIServiceAgentClient

  beforeEach(() => {
    client = new AIServiceAgentClient({
      host: '10.60.11.3',
      port: 8085,
      baseUrl: 'http://10.60.11.3:8085',
      hasToken: true,
      token: 'test-token'
    })
    vi.restoreAllMocks()
  })

  describe('base URL construction', () => {
    it('should strip trailing slashes from baseUrl', () => {
      const c = new AIServiceAgentClient({
        host: 'localhost',
        port: 8085,
        baseUrl: 'http://localhost:8085///',
        hasToken: false
      })
      const fetchSpy = mockFetch({ json: vi.fn().mockResolvedValue([]) })
      globalThis.fetch = fetchSpy
      c.listProjectRepos()
      expect(fetchSpy).toHaveBeenCalledWith('http://localhost:8085/api/v1/project-repos?limit=200', expect.anything())
    })

    it('should update baseUrl on updateConfig', () => {
      const fetchSpy = mockFetch({ json: vi.fn().mockResolvedValue([]) })
      globalThis.fetch = fetchSpy
      client.updateConfig({
        host: '10.0.0.1',
        port: 9000,
        baseUrl: 'http://10.0.0.1:9000/',
        hasToken: false
      })
      client.listProjectRepos()
      expect(fetchSpy).toHaveBeenCalledWith('http://10.0.0.1:9000/api/v1/project-repos?limit=200', expect.anything())
    })
  })

  describe('Authorization header', () => {
    it('should include Bearer token when token is set', async () => {
      const fetchSpy = mockFetch({ json: vi.fn().mockResolvedValue([]) })
      globalThis.fetch = fetchSpy
      await client.listProjectRepos()
      expect(fetchSpy.mock.calls[0][1]?.headers).toEqual({
        Authorization: 'Bearer test-token'
      })
    })

    it('should send no Authorization when token is absent', async () => {
      const c = new AIServiceAgentClient({
        host: 'localhost',
        port: 8085,
        baseUrl: 'http://localhost:8085',
        hasToken: false
      })
      const fetchSpy = mockFetch({ json: vi.fn().mockResolvedValue([]) })
      globalThis.fetch = fetchSpy
      await c.listProjectRepos()
      expect(fetchSpy.mock.calls[0][1]?.headers).toEqual({})
    })
  })

  describe('Raven account and Assistant runtime', () => {
    it('registers a shared RavenAIService account and reuses its token', async () => {
      const auth = {
        token: 'registered-token',
        expires_at: 2_000_000_000,
        user: { id: 7, username: 'raven-user', display_name: 'Raven User', role: 'user', is_active: true }
      }
      const fetchSpy = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValueOnce({ ok: true, status: 200, json: vi.fn().mockResolvedValue({ data: auth }) } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({ data: auth.user })
        } as any)
      globalThis.fetch = fetchSpy

      await client.register({
        username: 'raven-user',
        password: 'strong-password',
        display_name: 'Raven User',
        email: 'raven@example.test'
      })
      await client.getProfile()

      expect(fetchSpy.mock.calls[0]).toEqual([
        'http://10.60.11.3:8085/api/v1/users/auth/register',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            username: 'raven-user',
            password: 'strong-password',
            display_name: 'Raven User',
            email: 'raven@example.test'
          })
        })
      ])
      expect(fetchSpy.mock.calls[1][1]?.headers).toEqual({ Authorization: 'Bearer registered-token' })
    })

    it('loads an authenticated no-store capability snapshot', async () => {
      const snapshot = {
        revision: 'rev-1',
        issued_at: 100,
        expires_at: 200,
        refresh_after_seconds: 60,
        routes: [{ slot: 'primary', provider: 'anthropic', model: 'model-a' }]
      }
      const fetchSpy = mockFetch({ json: vi.fn().mockResolvedValue({ data: snapshot }) })
      globalThis.fetch = fetchSpy

      await expect(client.getClientAICapabilities()).resolves.toEqual(snapshot)
      expect(fetchSpy).toHaveBeenCalledWith('http://10.60.11.3:8085/api/v1/client-ai/capabilities', {
        headers: { Authorization: 'Bearer test-token', 'Cache-Control': 'no-cache' },
        cache: 'no-store'
      })
    })

    it('reports only the caller-provided content-free usage envelope', async () => {
      const fetchSpy = mockFetch({
        json: vi.fn().mockResolvedValue({ data: { invocation_id: 'inv-1' } })
      })
      globalThis.fetch = fetchSpy
      const payload = {
        invocation_id: 'inv-1',
        slot: 'primary' as const,
        provider: 'anthropic',
        model: 'model-a',
        status: 'succeeded' as const,
        outcome: 'ok' as const,
        tokens: { input_tokens: 12, output_tokens: 4, cache_read_tokens: 0, cache_write_tokens: 0 },
        duration_ms: 350
      }

      await client.reportClientAIUsage(payload)

      const request = fetchSpy.mock.calls[0]
      expect(request[0]).toBe('http://10.60.11.3:8085/api/v1/client-ai/usage')
      expect(JSON.parse(String(request[1]?.body))).toEqual(payload)
      expect(String(request[1]?.body)).not.toMatch(/prompt|message|content/i)
    })
  })

  describe('listProjectRepos', () => {
    it('should return items from paginated response', async () => {
      const items = [{ id: 1, project_name: 'test', project_code: 'TST', default_branch: 'main', is_enabled: true }]
      globalThis.fetch = mockFetch({ json: vi.fn().mockResolvedValue({ items }) })
      const result = await client.listProjectRepos()
      expect(result).toEqual(items)
    })

    it('should handle array response', async () => {
      const items = [{ id: 2, project_name: 'arr', project_code: 'ARR', default_branch: 'dev', is_enabled: true }]
      globalThis.fetch = mockFetch({ json: vi.fn().mockResolvedValue(items) })
      const result = await client.listProjectRepos()
      expect(result).toEqual(items)
    })
  })

  describe('multipart form fields', () => {
    it('startLogAnalysisRun should build correct FormData', async () => {
      const formAppendSpy = vi.spyOn(FormData.prototype, 'append')
      globalThis.fetch = mockFetch()
      await client.startLogAnalysisRun({
        message: 'analyze this',
        sessionId: 'sess-1',
        projectRepoId: 42,
        remember: true
      })
      const calls = formAppendSpy.mock.calls
      expect(calls).toContainEqual(['message', 'analyze this'])
      expect(calls).toContainEqual(['session_id', 'sess-1'])
      expect(calls).toContainEqual(['project_repo_id', '42'])
      expect(calls).toContainEqual(['remember', 'true'])
    })

    it('startLogAnalysisRun should use default message when empty', async () => {
      const formAppendSpy = vi.spyOn(FormData.prototype, 'append')
      globalThis.fetch = mockFetch()
      await client.startLogAnalysisRun({ message: '' })
      const msgCall = formAppendSpy.mock.calls.find((c) => c[0] === 'message')
      expect(['请分析这个日志文件', 'Please analyze this log file']).toContain(msgCall?.[1])
    })

    it('startProjectExpertRun should include project_repo_id', async () => {
      const formAppendSpy = vi.spyOn(FormData.prototype, 'append')
      globalThis.fetch = mockFetch()
      await client.startProjectExpertRun({
        message: 'explain auth flow',
        projectRepoId: 7
      })
      const calls = formAppendSpy.mock.calls
      expect(calls).toContainEqual(['message', 'explain auth flow'])
      expect(calls).toContainEqual(['project_repo_id', '7'])
    })
  })

  describe('error handling', () => {
    it('should throw AIServiceAuthError on 401', async () => {
      globalThis.fetch = mockFetch({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: vi.fn().mockResolvedValue({ detail: 'Invalid token' })
      })
      await expect(client.listProjectRepos()).rejects.toThrow(AIServiceAuthError)
    })

    it('should throw AIServiceAuthError on 403', async () => {
      globalThis.fetch = mockFetch({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: vi.fn().mockResolvedValue({ message: 'Forbidden' })
      })
      await expect(client.listProjectRepos()).rejects.toThrow(AIServiceAuthError)
    })

    it('should throw AIServiceError on other HTTP errors', async () => {
      globalThis.fetch = mockFetch({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: vi.fn().mockResolvedValue({ detail: 'server crash' })
      })
      await expect(client.listProjectRepos()).rejects.toThrow(AIServiceError)
      await expect(client.listProjectRepos()).rejects.not.toThrow(AIServiceAuthError)
    })

    it('should throw AIServiceConnectionError when fetch rejects', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
      await expect(client.listProjectRepos()).rejects.toThrow(AIServiceConnectionError)
    })

    it('should re-throw AbortError from startLogAnalysisRun', async () => {
      const abortErr = new DOMException('Aborted', 'AbortError')
      globalThis.fetch = vi.fn().mockRejectedValue(abortErr)
      await expect(
        client.startLogAnalysisRun({ message: 'test', signal: new AbortController().signal })
      ).rejects.toThrow('Aborted')
    })

    it('should re-throw AbortError from startProjectExpertRun', async () => {
      const abortErr = new DOMException('Aborted', 'AbortError')
      globalThis.fetch = vi.fn().mockRejectedValue(abortErr)
      await expect(
        client.startProjectExpertRun({ message: 'test', projectRepoId: 1, signal: new AbortController().signal })
      ).rejects.toThrow('Aborted')
    })

    it('should fallback to statusText when JSON parse fails', async () => {
      globalThis.fetch = mockFetch({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: vi.fn().mockRejectedValue(new Error('not json'))
      })
      try {
        await client.listProjectRepos()
      } catch (e) {
        expect((e as AIServiceError).message).toBe('Bad Gateway')
      }
    })
  })

  describe('cancelRun', () => {
    it('should use runId endpoint first', async () => {
      const fetchSpy = mockFetch()
      globalThis.fetch = fetchSpy
      await client.cancelRun({ agentKind: 'log-analysis', runId: 'run-123', sessionId: 'sess-1' })
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(fetchSpy.mock.calls[0][0]).toContain('/runs/run-123/cancel')
    })

    it('should fallback to session cancel when runId is absent', async () => {
      const fetchSpy = mockFetch()
      globalThis.fetch = fetchSpy
      await client.cancelRun({ agentKind: 'project-expert', sessionId: 'sess-2' })
      expect(fetchSpy.mock.calls[0][0]).toContain('/project-expert/cancel')
    })

    it('should fallback to session cancel when run cancel returns 404', async () => {
      let callCount = 0
      globalThis.fetch = vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 404,
            statusText: 'Not Found',
            json: vi.fn().mockResolvedValue({})
          })
        }
        return Promise.resolve({ ok: true, status: 200, json: vi.fn().mockResolvedValue({}) })
      }) as typeof globalThis.fetch
      await client.cancelRun({ agentKind: 'log-analysis', runId: 'run-gone', sessionId: 'sess-3' })
      expect(callCount).toBe(2)
    })
  })

  describe('getRunResult', () => {
    it('should call correct endpoint with session_id', async () => {
      const fetchSpy = mockFetch({ json: vi.fn().mockResolvedValue({ answer: 'done' }) })
      globalThis.fetch = fetchSpy
      const result = await client.getRunResult('log-analysis', 'sess-abc')
      expect(fetchSpy.mock.calls[0][0]).toContain('/log-analysis/result?session_id=sess-abc')
      expect(result).toEqual({ answer: 'done' })
    })
  })
})
