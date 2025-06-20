/**
 * Cherry Studio AI Core Package
 * 基于 Vercel AI SDK 的统一 AI Provider 接口
 */

// 核心导出
export { ApiClientFactory, apiClientFactory } from './clients/ApiClientFactory'
export { UniversalAiSdkClient } from './clients/UniversalAiSdkClient'
export { aiProviderRegistry, PROVIDER_REGISTRY } from './providers/registry'

// 类型导出
export type { CacheStats, ClientConfig, ClientFactoryError } from './clients/ApiClientFactory'
export type { ProviderConfig } from './providers/registry'
export type { ProviderError } from './providers/types'

// 便捷函数导出
export { clearCache, createAiSdkClient, getCachedClient, healthCheck, warmupClients } from './clients/ApiClientFactory'
export { createUniversalClient, generateCompletion, streamGeneration } from './clients/UniversalAiSdkClient'
export { getAllProviders, getProvider, isProviderSupported, registerProvider } from './providers/registry'

// 默认导出 - 主要的工厂类
export { ApiClientFactory as default } from './clients/ApiClientFactory'

// 导入内部使用的函数
import { ApiClientFactory } from './clients/ApiClientFactory'
import { clearCache, createAiSdkClient, healthCheck } from './clients/ApiClientFactory'
import { aiProviderRegistry } from './providers/registry'
import { getAllProviders, isProviderSupported } from './providers/registry'

// 包信息
export const AI_CORE_VERSION = '1.0.0'
export const AI_CORE_NAME = '@cherry-studio/ai-core'

// 包配置和实用工具
export const AiCore = {
  version: AI_CORE_VERSION,
  name: AI_CORE_NAME,

  // 快速创建客户端
  async createClient(providerId: string, options: any = {}) {
    return createAiSdkClient(providerId, options)
  },

  // 获取支持的providers
  getSupportedProviders() {
    return getAllProviders()
  },

  // 检查provider支持
  isSupported(providerId: string) {
    return isProviderSupported(providerId)
  },

  // 获取缓存统计
  getCacheStats() {
    return ApiClientFactory.getCacheStats()
  },

  // 健康检查
  async healthCheck() {
    return healthCheck()
  },

  // 清理所有资源
  cleanup() {
    clearCache()
    aiProviderRegistry.cleanup()
  }
}

// 便捷的预配置clients创建函数
export const createOpenAIClient = async (options: { apiKey: string; baseURL?: string }) => {
  return createAiSdkClient('openai', options)
}

export const createAnthropicClient = async (options: { apiKey: string; baseURL?: string }) => {
  return createAiSdkClient('anthropic', options)
}

export const createGoogleClient = async (options: { apiKey: string; baseURL?: string }) => {
  return createAiSdkClient('google', options)
}

export const createXAIClient = async (options: { apiKey: string; baseURL?: string }) => {
  return createAiSdkClient('xai', options)
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
      const client = await createAiSdkClient(providerId, options)
      const info = client.getProviderInfo()
      return {
        success: true,
        providerId: info.id,
        name: info.name,
        isInitialized: info.isInitialized
      }
    } catch (error) {
      return {
        success: false,
        providerId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  },

  // 获取详细的缓存信息
  getCacheDetails() {
    const stats = ApiClientFactory.getCacheStats()
    const providers = aiProviderRegistry.getAllProviders()

    return {
      cacheStats: stats,
      supportedProviders: providers.length,
      registeredProviders: aiProviderRegistry.getAllProviders().length,
      activeClients: stats.size
    }
  }
}
