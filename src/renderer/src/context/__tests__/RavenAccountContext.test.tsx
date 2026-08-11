import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RavenAccountProvider, useRavenAccount } from '../RavenAccountContext'

const clientMocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  setToken: vi.fn()
}))
const runtimeMocks = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn() }))
const conversationMocks = vi.hoisted(() => ({
  setClient: vi.fn(),
  attachUser: vi.fn(),
  loadSessions: vi.fn(),
  reset: vi.fn()
}))

vi.mock('@renderer/services/AIServiceAgentClient', () => {
  class AIServiceAgentClient {
    getProfile = clientMocks.getProfile
    login = clientMocks.login
    register = clientMocks.register
    setToken = clientMocks.setToken
  }
  class AIServiceAuthError extends Error {}
  class AIServiceConnectionError extends Error {
    baseUrl = 'http://service.example.test'
  }
  return { AIServiceAgentClient, AIServiceAuthError, AIServiceConnectionError }
})
vi.mock('@renderer/services/RavenClientAIRuntime', () => ({
  ravenClientAIRuntime: runtimeMocks
}))
vi.mock('@renderer/pages/agents/aiservice/conversationStore', () => ({
  conversationStore: conversationMocks
}))

function AccountProbe() {
  const { profile, booting, logout } = useRavenAccount()
  if (booting) return <div>booting</div>
  return (
    <div>
      <span>{profile?.username || 'signed-out'}</span>
      <button type="button" onClick={() => void logout()}>
        logout
      </button>
    </div>
  )
}

describe('RavenAccountProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clientMocks.getProfile.mockResolvedValue({
      id: 'user-1',
      username: 'restored-user',
      role: 'user',
      is_active: true
    })
    runtimeMocks.start.mockResolvedValue({ revision: 'rev-1', routes: [{}] })
    conversationMocks.loadSessions.mockResolvedValue(undefined)
    ;(window as any).api = {
      ravenAIService: {
        getConfig: vi.fn().mockResolvedValue({
          host: 'service.example.test',
          port: 8085,
          baseUrl: 'http://service.example.test:8085',
          hasToken: true,
          token: 'stored-token'
        }),
        setAuthToken: vi.fn().mockResolvedValue(undefined)
      }
    }
  })

  it('restores the global account, initializes capabilities, and clears both on logout', async () => {
    render(
      <RavenAccountProvider>
        <AccountProbe />
      </RavenAccountProvider>
    )

    expect(await screen.findByText('restored-user')).toBeInTheDocument()
    expect(clientMocks.getProfile).toHaveBeenCalledOnce()
    expect(runtimeMocks.start).toHaveBeenCalledOnce()
    expect(conversationMocks.attachUser).toHaveBeenCalledWith('user-1')

    fireEvent.click(screen.getByRole('button', { name: 'logout' }))

    await waitFor(() => expect(screen.getByText('signed-out')).toBeInTheDocument())
    expect((window as any).api.ravenAIService.setAuthToken).toHaveBeenCalledWith(undefined)
    expect(clientMocks.setToken).toHaveBeenCalledWith(undefined)
    expect(runtimeMocks.stop).toHaveBeenCalledOnce()
    expect(conversationMocks.reset).toHaveBeenCalledOnce()
  })

  it('returns to the global gate when the capability runtime reports an expired session', async () => {
    render(
      <RavenAccountProvider>
        <AccountProbe />
      </RavenAccountProvider>
    )

    expect(await screen.findByText('restored-user')).toBeInTheDocument()
    const onAuthenticationFailure = runtimeMocks.start.mock.calls[0][1]
    await act(async () => onAuthenticationFailure())

    expect(screen.getByText('signed-out')).toBeInTheDocument()
    expect((window as any).api.ravenAIService.setAuthToken).toHaveBeenCalledWith(undefined)
    expect(clientMocks.setToken).toHaveBeenCalledWith(undefined)
    expect(runtimeMocks.stop).toHaveBeenCalledOnce()
    expect(conversationMocks.reset).toHaveBeenCalledOnce()
  })
})
