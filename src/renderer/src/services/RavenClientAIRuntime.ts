import { loggerService } from '@logger'
import store from '@renderer/store'
import { updateAssistants, updateDefaultAssistant } from '@renderer/store/assistants'
import { setDefaultModel, setQuickModel, setTranslateModel, updateProviders } from '@renderer/store/llm'
import type { Model, Provider } from '@renderer/types'
import type { RavenClientAICapabilitySnapshot, RavenClientAIRoute } from '@renderer/types/aiServiceAgent'

import { type AIServiceAgentClient, AIServiceAuthError } from './AIServiceAgentClient'
import {
  publicServiceProviderForRoute,
  ravenClientAICredentialVault,
  serviceModelForRoute
} from './RavenClientAICredentialVault'

const logger = loggerService.withContext('RavenClientAIRuntime')

const MIN_REFRESH_SECONDS = 30
const MAX_REFRESH_SECONDS = 15 * 60

export type RavenClientAISyncStatus = 'idle' | 'syncing' | 'ready' | 'degraded' | 'expired'

export interface RavenClientAIRuntimeState {
  status: RavenClientAISyncStatus
  revision?: string
  lastSyncedAt?: number
  error?: string
}

export class RavenClientAIRuntime {
  private client: AIServiceAgentClient | null = null
  private snapshot: RavenClientAICapabilitySnapshot | null = null
  private refreshPromise: Promise<RavenClientAICapabilitySnapshot> | null = null
  private refreshTimer: ReturnType<typeof setTimeout> | null = null
  private onAuthenticationFailure: (() => void | Promise<void>) | null = null
  private listeners = new Set<() => void>()
  private state: RavenClientAIRuntimeState = { status: 'idle' }
  private lifecycleInstalled = false
  private generation = 0

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getState = (): RavenClientAIRuntimeState => this.state

  private setState(next: RavenClientAIRuntimeState) {
    this.state = next
    this.listeners.forEach((listener) => listener())
  }

  async start(
    client: AIServiceAgentClient,
    onAuthenticationFailure?: () => void | Promise<void>
  ): Promise<RavenClientAICapabilitySnapshot> {
    this.generation += 1
    this.client = client
    this.onAuthenticationFailure = onAuthenticationFailure ?? null
    this.snapshot = null
    ravenClientAICredentialVault.clear()
    this.refreshPromise = null
    if (this.refreshTimer) clearTimeout(this.refreshTimer)
    this.refreshTimer = null
    this.installLifecycleListeners()
    return this.refresh('initial')
  }

  stop(options: { clearStore?: boolean } = { clearStore: true }) {
    this.generation += 1
    this.client = null
    this.onAuthenticationFailure = null
    this.snapshot = null
    ravenClientAICredentialVault.clear()
    this.refreshPromise = null
    if (this.refreshTimer) clearTimeout(this.refreshTimer)
    this.refreshTimer = null
    if (options.clearStore) store.dispatch(updateProviders([]))
    this.setState({ status: 'idle' })
  }

  async refresh(
    reason: 'initial' | 'interval' | 'focus' | 'failure' | 'manual'
  ): Promise<RavenClientAICapabilitySnapshot> {
    if (!this.client) throw new Error('RavenClient AI runtime is not authenticated')
    if (this.refreshPromise) return this.refreshPromise

    logger.debug(`Refreshing RavenAIService model capabilities (${reason})`)
    const refreshGeneration = this.generation
    const previous = this.snapshot
    this.setState({ ...this.state, status: 'syncing', error: undefined })
    this.refreshPromise = this.client
      .getClientAICapabilities()
      .then((snapshot) => {
        if (refreshGeneration !== this.generation) {
          throw new Error('RavenClient AI capability refresh was cancelled')
        }
        if (!snapshot.routes.length) throw new Error('RavenAIService returned no usable model route')
        this.snapshot = snapshot
        ravenClientAICredentialVault.replace(snapshot)
        if (!previous || previous.revision !== snapshot.revision) this.synchronizeStore(snapshot)
        const lastSyncedAt = Date.now()
        this.setState({ status: 'ready', revision: snapshot.revision, lastSyncedAt })
        this.scheduleRefresh(snapshot.refresh_after_seconds)
        return snapshot
      })
      .catch(async (error: Error) => {
        if (refreshGeneration !== this.generation) throw error
        if (error instanceof AIServiceAuthError) {
          const onAuthenticationFailure = this.onAuthenticationFailure
          this.snapshot = null
          ravenClientAICredentialVault.clear()
          if (this.refreshTimer) clearTimeout(this.refreshTimer)
          this.refreshTimer = null
          this.setState({ status: 'expired', error: error.message })
          await onAuthenticationFailure?.()
          throw error
        }
        const stillValid = previous && previous.expires_at * 1000 > Date.now()
        if (stillValid) {
          this.snapshot = previous
          ravenClientAICredentialVault.replace(previous)
          this.setState({
            status: 'degraded',
            revision: previous.revision,
            lastSyncedAt: this.state.lastSyncedAt,
            error: error.message
          })
          this.scheduleRefresh(MIN_REFRESH_SECONDS)
        } else {
          this.snapshot = null
          ravenClientAICredentialVault.clear()
          this.setState({ status: 'expired', error: error.message })
        }
        throw error
      })
      .finally(() => {
        if (refreshGeneration === this.generation) this.refreshPromise = null
      })
    return this.refreshPromise
  }

  async ensureFresh(): Promise<RavenClientAICapabilitySnapshot> {
    if (!this.snapshot || this.snapshot.expires_at * 1000 <= Date.now()) return this.refresh('manual')
    return this.snapshot
  }

  getRoutes(): RavenClientAIRoute[] {
    if (!this.snapshot || this.snapshot.expires_at * 1000 <= Date.now()) {
      this.snapshot = null
      ravenClientAICredentialVault.clear()
      this.setState({ status: 'expired', error: 'RavenAIService model capabilities expired' })
      throw new Error('RavenAIService model capabilities are unavailable or expired')
    }
    return [...this.snapshot.routes]
  }

  getModel(route: RavenClientAIRoute): Model {
    return serviceModelForRoute(route)
  }

  getProvider(route: RavenClientAIRoute): Provider {
    return ravenClientAICredentialVault.getProvider(route)
  }

  resolveProvider(provider?: Provider): Provider | undefined {
    return ravenClientAICredentialVault.resolveProvider(provider)
  }

  async reportUsage(payload: Parameters<AIServiceAgentClient['reportClientAIUsage']>[0]): Promise<void> {
    try {
      await this.client?.reportClientAIUsage(payload)
    } catch (error) {
      logger.warn('Failed to report content-free Assistant usage', error as Error)
    }
  }

  private synchronizeStore(snapshot: RavenClientAICapabilitySnapshot) {
    const providers = snapshot.routes.map(publicServiceProviderForRoute)
    const primaryRoute = snapshot.routes[0]
    const model = serviceModelForRoute(primaryRoute)
    const quickModel = serviceModelForRoute(primaryRoute, primaryRoute.small_fast_model || primaryRoute.model)
    const current = store.getState()
    store.dispatch(updateProviders(providers))
    store.dispatch(setDefaultModel({ model }))
    store.dispatch(setQuickModel({ model: quickModel }))
    store.dispatch(setTranslateModel({ model }))
    store.dispatch(
      updateAssistants(current.assistants.assistants.map((assistant) => ({ ...assistant, model, defaultModel: model })))
    )
    store.dispatch(
      updateDefaultAssistant({
        assistant: { ...current.assistants.defaultAssistant, model, defaultModel: model }
      })
    )
  }

  private scheduleRefresh(seconds: number) {
    if (this.refreshTimer) clearTimeout(this.refreshTimer)
    const bounded = Math.min(MAX_REFRESH_SECONDS, Math.max(MIN_REFRESH_SECONDS, Number(seconds) || 60))
    this.refreshTimer = setTimeout(() => {
      void this.refresh('interval').catch(() => undefined)
    }, bounded * 1000)
  }

  private installLifecycleListeners() {
    if (this.lifecycleInstalled || typeof window === 'undefined' || typeof document === 'undefined') return
    this.lifecycleInstalled = true
    window.addEventListener('focus', () => {
      void this.refresh('focus').catch(() => undefined)
    })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.refresh('focus').catch(() => undefined)
    })
  }
}

export const ravenClientAIRuntime = new RavenClientAIRuntime()
