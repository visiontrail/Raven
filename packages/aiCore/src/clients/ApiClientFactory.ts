/**
 * API Client Factory
 * 整合现有实现的改进版API客户端工厂
 */

import { aiProviderRegistry } from '../providers/registry'
import type { CacheStats as BaseCacheStats, ClientConfig as BaseClientConfig } from '../providers/types'
import { UniversalAiSdkClient } from './UniversalAiSdkClient'

// 客户端配置接口
export interface ClientConfig extends BaseClientConfig {}

// 缓存统计信息
export interface CacheStats extends BaseCacheStats {}

// 错误类型
export class ClientFactoryError extends Error {
  constructor(
    message: string,
    public providerId?: string,
    public cause?: Error
  ) {
    super(message)
    this.name = 'ClientFactoryError'
  }
}

/**
 * API Client Factory
 * 统一管理和创建AI SDK客户端
 */
export class ApiClientFactory {
  private static instance: ApiClientFactory
  private static sdkClients = new Map<string, UniversalAiSdkClient>()
  private static lastCleanup = new Date()

  private constructor() {
    // Private constructor for singleton pattern
  }

  public static getInstance(): ApiClientFactory {
    if (!ApiClientFactory.instance) {
      ApiClientFactory.instance = new ApiClientFactory()
    }
    return ApiClientFactory.instance
  }

  /**
   * [NEW METHOD] Create a new universal client for ai-sdk providers.
   * [新方法] 为 ai-sdk 提供商创建一个新的通用客户端。
   */
  static async createAiSdkClient(providerId: string, options: any = {}): Promise<UniversalAiSdkClient> {
    try {
      // 验证provider是否支持
      if (!aiProviderRegistry.isSupported(providerId)) {
        throw new ClientFactoryError(`Provider "${providerId}" is not supported`, providerId)
      }

      // 生成缓存键 - 对于有认证选项的providers，使用更精细的键
      const cacheKey = this.generateCacheKey(providerId, options)

      // 检查缓存
      if (this.sdkClients.has(cacheKey)) {
        const cachedClient = this.sdkClients.get(cacheKey)!
        // 验证缓存的客户端是否仍然有效
        if (cachedClient.isInitialized() && cachedClient.validateConfig()) {
          return cachedClient
        } else {
          // 如果缓存的客户端无效，清理它
          this.sdkClients.delete(cacheKey)
          cachedClient.cleanup()
        }
      }

      // 1. 创建一个新的通用客户端实例
      const client = new UniversalAiSdkClient(providerId, options)

      // 2. 初始化它（这将执行动态导入）
      await client.initialize()

      // 3. 验证配置
      if (!client.validateConfig()) {
        throw new ClientFactoryError(`Invalid configuration for provider "${providerId}"`, providerId)
      }

      // 4. 缓存并返回
      this.sdkClients.set(cacheKey, client)
      return client
    } catch (error) {
      if (error instanceof ClientFactoryError) {
        throw error
      }
      throw new ClientFactoryError(
        `Failed to create client for provider "${providerId}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        providerId,
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * 获取缓存的客户端
   */
  static getCachedClient(providerId: string, options: any = {}): UniversalAiSdkClient | undefined {
    const cacheKey = this.generateCacheKey(providerId, options)
    return this.sdkClients.get(cacheKey)
  }

  /**
   * 检查客户端是否存在于缓存中
   */
  static hasCachedClient(providerId: string, options: any = {}): boolean {
    const cacheKey = this.generateCacheKey(providerId, options)
    return this.sdkClients.has(cacheKey)
  }

  /**
   * 生成缓存键
   */
  private static generateCacheKey(providerId: string, options: any): string {
    // 创建一个包含关键配置的键，但不包含敏感信息的完整内容
    const keyData = {
      providerId,
      apiKey: options.apiKey ? this.hashApiKey(options.apiKey) : undefined,
      baseURL: options.baseURL,
      organization: options.organization,
      project: options.project,
      // 添加其他相关但非敏感的配置
      model: options.model,
      region: options.region
    }

    // 移除undefined值
    Object.keys(keyData).forEach((key) => {
      if (keyData[key as keyof typeof keyData] === undefined) {
        delete keyData[key as keyof typeof keyData]
      }
    })

    return JSON.stringify(keyData)
  }

  /**
   * 对API Key进行哈希处理（用于缓存键）
   */
  private static hashApiKey(apiKey: string): string {
    // 简单的哈希方法，只取前8个字符和后4个字符
    if (apiKey.length <= 12) {
      return apiKey.slice(0, 4) + '...'
    }
    return apiKey.slice(0, 8) + '...' + apiKey.slice(-4)
  }

  /**
   * 清理缓存
   */
  static clearCache(): void {
    // 清理所有客户端
    this.sdkClients.forEach((client) => {
      try {
        client.cleanup()
      } catch (error) {
        console.warn('Error cleaning up client:', error)
      }
    })

    this.sdkClients.clear()
    this.lastCleanup = new Date()
  }

  /**
   * 清理特定provider的缓存
   */
  static clearProviderCache(providerId: string): void {
    const keysToDelete: string[] = []

    this.sdkClients.forEach((client, key) => {
      if (key.includes(`"providerId":"${providerId}"`)) {
        try {
          client.cleanup()
        } catch (error) {
          console.warn(`Error cleaning up client for ${providerId}:`, error)
        }
        keysToDelete.push(key)
      }
    })

    keysToDelete.forEach((key) => {
      this.sdkClients.delete(key)
    })
  }

  /**
   * 获取缓存统计信息
   */
  static getCacheStats(): CacheStats {
    return {
      size: this.sdkClients.size,
      keys: Array.from(this.sdkClients.keys()),
      lastCleanup: this.lastCleanup
    }
  }

  /**
   * 预热指定的客户端
   */
  static async warmupClients(configs: ClientConfig[]): Promise<void> {
    const warmupPromises = configs.map(async (config) => {
      try {
        const { providerId, ...options } = config
        await this.createAiSdkClient(providerId, options)
        console.log(`✅ Warmed up client for provider: ${providerId}`)
      } catch (error) {
        console.warn(`⚠️ Failed to warm up client for ${config.providerId}:`, error)
      }
    })

    await Promise.allSettled(warmupPromises)
  }

  /**
   * 获取所有支持的providers信息
   */
  static getSupportedProviders(): Array<{
    id: string
    name: string
    hasCachedClient: boolean
  }> {
    const providers = aiProviderRegistry.getAllProviders()

    return providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      hasCachedClient: Array.from(this.sdkClients.keys()).some((key) => key.includes(`"providerId":"${provider.id}"`))
    }))
  }

  /**
   * 批量创建客户端
   */
  static async createMultipleClients(configs: ClientConfig[]): Promise<{
    success: Array<{ providerId: string; client: UniversalAiSdkClient }>
    errors: Array<{ providerId: string; error: Error }>
  }> {
    const success: Array<{ providerId: string; client: UniversalAiSdkClient }> = []
    const errors: Array<{ providerId: string; error: Error }> = []

    await Promise.allSettled(
      configs.map(async (config) => {
        try {
          const { providerId, ...options } = config
          const client = await this.createAiSdkClient(providerId, options)
          success.push({ providerId, client })
        } catch (error) {
          errors.push({
            providerId: config.providerId,
            error: error instanceof Error ? error : new Error('Unknown error')
          })
        }
      })
    )

    return { success, errors }
  }

  /**
   * 健康检查 - 检查所有缓存客户端的状态
   */
  static async healthCheck(): Promise<{
    healthy: number
    unhealthy: number
    total: number
    details: Array<{
      providerId: string
      status: 'healthy' | 'unhealthy'
      error?: string
    }>
  }> {
    const details: Array<{
      providerId: string
      status: 'healthy' | 'unhealthy'
      error?: string
    }> = []

    let healthy = 0
    let unhealthy = 0

    for (const [, client] of this.sdkClients) {
      try {
        const info = client.getProviderInfo()
        if (client.isInitialized() && client.validateConfig()) {
          healthy++
          details.push({
            providerId: info.id,
            status: 'healthy'
          })
        } else {
          unhealthy++
          details.push({
            providerId: info.id,
            status: 'unhealthy',
            error: 'Client not properly initialized or invalid config'
          })
        }
      } catch (error) {
        unhealthy++
        details.push({
          providerId: 'unknown',
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return {
      healthy,
      unhealthy,
      total: this.sdkClients.size,
      details
    }
  }
}

// 导出单例实例和便捷函数
export const apiClientFactory = ApiClientFactory.getInstance()

// 便捷函数
export const createAiSdkClient = (providerId: string, options?: any) =>
  ApiClientFactory.createAiSdkClient(providerId, options)

export const getCachedClient = (providerId: string, options?: any) =>
  ApiClientFactory.getCachedClient(providerId, options)

export const clearCache = () => ApiClientFactory.clearCache()

export const warmupClients = (configs: ClientConfig[]) => ApiClientFactory.warmupClients(configs)

export const healthCheck = () => ApiClientFactory.healthCheck()

// 默认导出
export default ApiClientFactory
