import { AiCore, getProviderMapping, type ProviderId } from '@cherrystudio/ai-core'
import { loggerService } from '@logger'
import { Provider } from '@renderer/types'

import { initializeNewProviders } from './providerConfigs'

const logger = loggerService.withContext('ProviderFactory')

/**
 * 初始化动态Provider系统
 * 在模块加载时自动注册新的providers
 */
;(async () => {
  try {
    await initializeNewProviders()
  } catch (error) {
    logger.warn('Failed to initialize new providers:', error as Error)
  }
})()

/**
 * 静态Provider映射表
 * 处理Cherry Studio特有的provider ID到AI SDK标准ID的映射
 */
const STATIC_PROVIDER_MAPPING: Record<string, ProviderId> = {
  gemini: 'google', // Google Gemini -> google
  'azure-openai': 'azure', // Azure OpenAI -> azure
  'openai-response': 'openai', // OpenAI Responses -> openai
  grok: 'xai' // Grok -> xai
}

/**
 * 尝试解析provider标识符（支持静态映射和动态映射）
 */
function tryResolveProviderId(identifier: string): ProviderId | null {
  // 1. 检查静态映射
  const staticMapping = STATIC_PROVIDER_MAPPING[identifier]
  if (staticMapping) {
    return staticMapping
  }

  // 2. 检查动态映射
  const dynamicMapping = getProviderMapping(identifier)
  if (dynamicMapping && dynamicMapping !== identifier) {
    return dynamicMapping as ProviderId
  }

  // 3. 检查AiCore是否直接支持
  if (AiCore.isSupported(identifier)) {
    return identifier as ProviderId
  }

  return null
}

/**
 * 获取AI SDK Provider ID
 * 简化版：减少重复逻辑，利用通用解析函数
 */
export function getAiSdkProviderId(provider: Provider): ProviderId | 'openai-compatible' {
  // 1. 尝试解析provider.id
  const resolvedFromId = tryResolveProviderId(provider.id)
  if (resolvedFromId) {
    return resolvedFromId
  }

  // 2. 尝试解析provider.type
  const resolvedFromType = tryResolveProviderId(provider.type)
  if (resolvedFromType) {
    return resolvedFromType
  }

  // 3. 最后的fallback（通常会成为openai-compatible）
  return provider.id as ProviderId
}
