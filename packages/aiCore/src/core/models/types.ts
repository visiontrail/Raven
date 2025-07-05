/**
 * Creation 模块类型定义
 */
import { LanguageModelV2Middleware } from '@ai-sdk/provider'

import { ProviderId, ProviderSettingsMap } from '../../types'
import { AiPlugin } from '../plugins'

/**
 * 模型创建请求
 */
export interface ModelCreationRequest {
  providerId: ProviderId
  modelId: string
  options: ProviderSettingsMap[ProviderId]
  middlewares?: LanguageModelV2Middleware[]
}

/**
 * 配置解析结果
 */
export interface ResolvedConfig {
  provider: {
    id: ProviderId
    options: ProviderSettingsMap[ProviderId]
  }
  model: {
    id: string
  }
  plugins: AiPlugin[]
  middlewares: LanguageModelV2Middleware[]
}
