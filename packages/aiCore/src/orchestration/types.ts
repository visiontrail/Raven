/**
 * Orchestration 层类型定义
 * 面向用户的编排层接口
 */
import { LanguageModelV1Middleware } from 'ai'

import { type AiPlugin } from '../core/plugins'
import { type ProviderId, type ProviderSettingsMap } from '../types'

/**
 * 编排配置
 */
export interface OrchestrationConfig<T extends ProviderId = ProviderId> {
  providerId: T
  options: ProviderSettingsMap[T]
  plugins?: AiPlugin[]
  middlewares?: LanguageModelV1Middleware[]
}

/**
 * 编排选项
 */
export interface OrchestrationOptions {
  // 未来可以添加编排级别的选项
  // 比如：重试机制、超时设置、日志级别等
}
