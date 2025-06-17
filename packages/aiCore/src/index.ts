/**
 * Cherry Studio AI Core Package
 * 基于 Vercel AI SDK 的统一 AI Provider 接口
 */

// 导入内部使用的类和函数
import { ApiClientFactory } from './clients/ApiClientFactory'
import { ProviderOptions } from './clients/types'
import { createUniversalClient } from './clients/UniversalAiSdkClient'
import { aiProviderRegistry, isProviderSupported } from './providers/registry'

// 核心导出
export { ApiClientFactory } from './clients/ApiClientFactory'
export { createUniversalClient, UniversalAiSdkClient } from './clients/UniversalAiSdkClient'
export { aiProviderRegistry } from './providers/registry'

// 类型导出
export type { ClientFactoryError } from './clients/ApiClientFactory'
export type { ProviderConfig } from './providers/registry'
export type { ProviderError } from './providers/types'

// 便捷函数导出
export { createClient, getClientInfo, getSupportedProviders } from './clients/ApiClientFactory'
export { getAllProviders, getProvider, isProviderSupported, registerProvider } from './providers/registry'

// 默认导出 - 主要的工厂类
export { ApiClientFactory as default } from './clients/ApiClientFactory'

// 包信息
export const AI_CORE_VERSION = '1.0.0'
export const AI_CORE_NAME = '@cherry-studio/ai-core'

// 包配置和实用工具
export const AiCore = {
  version: AI_CORE_VERSION,
  name: AI_CORE_NAME,

  // 快速创建客户端
  async createClient(providerId: string, modelId: string = 'default', options: any = {}) {
    return ApiClientFactory.createClient(providerId, modelId, options)
  },

  // 创建通用客户端
  createUniversalClient(providerId: string, options: any = {}) {
    return createUniversalClient(providerId, options)
  },

  // 获取支持的providers
  getSupportedProviders() {
    return ApiClientFactory.getSupportedProviders()
  },

  // 检查provider支持
  isSupported(providerId: string) {
    return isProviderSupported(providerId)
  },

  // 获取客户端信息
  getClientInfo(providerId: string) {
    return ApiClientFactory.getClientInfo(providerId)
  }
}

// 便捷的预配置clients创建函数
export const createOpenAIClient = (options: ProviderOptions) => {
  return createUniversalClient('openai', options)
}

export const createOpenAICompatibleClient = (options: ProviderOptions) => {
  return createUniversalClient('openai-compatible', options)
}

export const createAnthropicClient = (options: ProviderOptions) => {
  return createUniversalClient('anthropic', options)
}

export const createGoogleClient = (options: ProviderOptions) => {
  return createUniversalClient('google', options)
}

export const createXAIClient = (options: ProviderOptions) => {
  return createUniversalClient('xai', options)
}

// 调试和开发工具
export const DevTools = {
  // 列出所有注册的providers
  listProviders() {
    return aiProviderRegistry.getAllProviders().map((p) => ({
      id: p.id,
      name: p.name
    }))
  },

  // 测试provider连接
  async testProvider(providerId: string, options: any) {
    try {
      const client = createUniversalClient(providerId, options)
      const info = client.getClientInfo()
      return {
        success: true,
        providerId: info.id,
        name: info.name,
        isSupported: info.isSupported
      }
    } catch (error) {
      return {
        success: false,
        providerId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  },

  // 获取provider详细信息
  getProviderDetails() {
    const providers = aiProviderRegistry.getAllProviders()

    return {
      supportedProviders: providers.length,
      registeredProviders: providers.length,
      providers: providers.map((p) => ({
        id: p.id,
        name: p.name
      }))
    }
  }
}
