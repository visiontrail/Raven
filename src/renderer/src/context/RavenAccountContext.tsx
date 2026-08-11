import { loggerService } from '@logger'
import i18n from '@renderer/i18n'
import { conversationStore } from '@renderer/pages/agents/aiservice/conversationStore'
import {
  AIServiceAgentClient,
  AIServiceAuthError,
  AIServiceConnectionError
} from '@renderer/services/AIServiceAgentClient'
import { ravenClientAIRuntime } from '@renderer/services/RavenClientAIRuntime'
import type { AIServiceConfig, UserProfile, UserRegistrationRequest } from '@renderer/types/aiServiceAgent'
import { createContext, type PropsWithChildren, use, useCallback, useEffect, useMemo, useState } from 'react'

const logger = loggerService.withContext('RavenAccount')

interface RavenAccountContextValue {
  config: AIServiceConfig | null
  client: AIServiceAgentClient | null
  profile: UserProfile | null
  booting: boolean
  authenticating: boolean
  error: string | null
  login: (username: string, password: string) => Promise<void>
  register: (payload: UserRegistrationRequest) => Promise<void>
  retry: () => Promise<void>
  logout: () => Promise<void>
}

const RavenAccountContext = createContext<RavenAccountContextValue | null>(null)

function errorMessage(error: unknown, baseUrl?: string): string {
  if (error instanceof AIServiceConnectionError) {
    return i18n.t('ravenAccount.error.connection', { baseUrl: baseUrl || error.baseUrl })
  }
  return (error as Error)?.message || i18n.t('ravenAccount.error.unknown')
}

export function RavenAccountProvider({ children }: PropsWithChildren) {
  const [config, setConfig] = useState<AIServiceConfig | null>(null)
  const [client, setClient] = useState<AIServiceAgentClient | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [booting, setBooting] = useState(true)
  const [authenticating, setAuthenticating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearSession = useCallback(async (api: AIServiceAgentClient | null, nextError: string | null = null) => {
    try {
      await window.api.ravenAIService.setAuthToken(undefined)
    } catch (clearError) {
      logger.warn('Failed to clear persisted RavenAIService token', clearError as Error)
    }
    api?.setToken(undefined)
    ravenClientAIRuntime.stop()
    conversationStore.reset()
    setProfile(null)
    setError(nextError)
  }, [])

  const activate = useCallback(
    async (api: AIServiceAgentClient, user: UserProfile, token?: string) => {
      if (token) await window.api.ravenAIService.setAuthToken(token)
      await ravenClientAIRuntime.start(api, () => clearSession(api, i18n.t('ravenAccount.error.session_expired')))
      conversationStore.setClient(api)
      conversationStore.attachUser(user.id)
      void conversationStore.loadSessions()
      setProfile(user)
      setError(null)
    },
    [clearSession]
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const nextConfig = await window.api.ravenAIService.getConfig()
        if (cancelled) return
        const api = new AIServiceAgentClient(nextConfig)
        setConfig(nextConfig)
        setClient(api)
        conversationStore.setClient(api)
        if (nextConfig.token) {
          try {
            const user = await api.getProfile()
            if (!cancelled) await activate(api, user)
          } catch (restoreError) {
            if (restoreError instanceof AIServiceAuthError) {
              await clearSession(api)
            } else if (!cancelled) {
              setError(errorMessage(restoreError, nextConfig.baseUrl))
            }
          }
        }
      } catch (bootstrapError) {
        if (!cancelled) setError(errorMessage(bootstrapError))
      } finally {
        if (!cancelled) setBooting(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activate, clearSession])

  const login = useCallback(
    async (username: string, password: string) => {
      if (!client) throw new Error(i18n.t('ravenAccount.error.not_ready'))
      setAuthenticating(true)
      setError(null)
      try {
        const payload = await client.login(username, password)
        await activate(client, payload.user, payload.token)
      } catch (loginError) {
        setError(errorMessage(loginError, config?.baseUrl))
        throw loginError
      } finally {
        setAuthenticating(false)
      }
    },
    [activate, client, config?.baseUrl]
  )

  const register = useCallback(
    async (payload: UserRegistrationRequest) => {
      if (!client) throw new Error(i18n.t('ravenAccount.error.not_ready'))
      setAuthenticating(true)
      setError(null)
      try {
        const auth = await client.register(payload)
        await activate(client, auth.user, auth.token)
      } catch (registerError) {
        setError(errorMessage(registerError, config?.baseUrl))
        throw registerError
      } finally {
        setAuthenticating(false)
      }
    },
    [activate, client, config?.baseUrl]
  )

  const retry = useCallback(async () => {
    if (!client) {
      window.location.reload()
      return
    }
    setAuthenticating(true)
    setError(null)
    try {
      const user = await client.getProfile()
      await activate(client, user)
    } catch (retryError) {
      if (retryError instanceof AIServiceAuthError) {
        await clearSession(client)
      }
      setError(errorMessage(retryError, config?.baseUrl))
    } finally {
      setAuthenticating(false)
    }
  }, [activate, clearSession, client, config?.baseUrl])

  const logout = useCallback(async () => {
    await clearSession(client)
  }, [clearSession, client])

  const value = useMemo<RavenAccountContextValue>(
    () => ({ config, client, profile, booting, authenticating, error, login, register, retry, logout }),
    [authenticating, booting, client, config, error, login, logout, profile, register, retry]
  )

  return <RavenAccountContext value={value}>{children}</RavenAccountContext>
}

export function useRavenAccount(): RavenAccountContextValue {
  const context = use(RavenAccountContext)
  if (!context) throw new Error('useRavenAccount must be used inside RavenAccountProvider')
  return context
}
