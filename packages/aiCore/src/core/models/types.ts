/**
 * Creation 模块类型定义
 */
import { LanguageModelV2Middleware } from '@ai-sdk/provider'

import type { ProviderId, ProviderSettingsMap } from '../../types'

export interface ModelConfig<T extends ProviderId = ProviderId> {
  providerId: T
  modelId: string
  providerSettings: ProviderSettingsMap[T]
  middlewares?: LanguageModelV2Middleware[]
  extraModelConfig?: Record<string, any>
}
