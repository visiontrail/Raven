/**
 * Creation 模块类型定义
 */
import { LanguageModelV2Middleware } from '@ai-sdk/provider'

import type { ProviderId, ProviderSettingsMap } from '../../types'

export interface ModelConfig {
  providerId: ProviderId
  modelId: string
  options: ProviderSettingsMap[ProviderId]
  middlewares?: LanguageModelV2Middleware[]
}
