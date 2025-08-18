/**
 * AI Provider 注册表
 * - 使用 schemas 提供的验证函数
 * - 专注于状态管理和业务逻辑
 * - 数据驱动的 Provider 初始化
 */

import {
  baseProviders,
  type DynamicProviderRegistration,
  type ProviderConfig,
  type ProviderId,
  validateDynamicProviderRegistration,
  validateProviderId
} from './schemas'

export class AiProviderRegistry {
  private static instance: AiProviderRegistry
  private registry = new Map<string, ProviderConfig>()
  // 动态注册扩展
  private dynamicMappings = new Map<string, string>()
  private dynamicProviders = new Set<string>()

  private constructor() {
    this.initializeProviders()
  }

  public static getInstance(): AiProviderRegistry {
    if (!AiProviderRegistry.instance) {
      AiProviderRegistry.instance = new AiProviderRegistry()
    }
    return AiProviderRegistry.instance
  }

  /**
   * 初始化所有支持的 Providers
   * 使用 schemas 中的 baseProviders 数据驱动
   */
  private initializeProviders(): void {
    baseProviders.forEach((config) => {
      this.registry.set(config.id, config as ProviderConfig)
    })
  }

  /**
   * 获取所有已注册的 Providers
   */
  public getAllProviders(): ProviderConfig[] {
    return Array.from(this.registry.values())
  }

  /**
   * 根据 ID 获取 Provider 配置
   */
  public getProvider(id: string): ProviderConfig | undefined {
    return this.registry.get(id) || this.registry.get('openai-compatible')
  }

  /**
   * 检查 Provider 是否支持（是否已注册）
   */
  public isSupported(id: string): boolean {
    // 首先检查是否在注册表中
    if (this.registry.has(id)) {
      return true
    }

    // 然后检查是否是有效的 provider ID（可能是新的动态 provider）
    return validateProviderId(id)
  }

  /**
   * 注册新的 Provider（用于扩展）
   */
  public registerProvider(config: ProviderConfig): void {
    // 使用 schemas 的验证函数
    if (!validateProviderId(config.id)) {
      throw new Error(`Invalid provider ID: ${config.id}`)
    }

    // 验证：不能同时提供两种方式
    if (config.creator && config.import) {
      console.warn('Both creator and import provided, creator will take precedence')
    }

    this.registry.set(config.id, config)
  }

  /**
   * 动态注册Provider并支持映射关系
   */
  public registerDynamicProvider(config: DynamicProviderRegistration): boolean {
    try {
      // 使用 schemas 的验证函数
      const validatedConfig = validateDynamicProviderRegistration(config)
      if (!validatedConfig) {
        console.error('Invalid dynamic provider configuration')
        return false
      }

      // 注册provider
      this.registerProvider(validatedConfig)

      // 记录为动态provider
      this.dynamicProviders.add(validatedConfig.id)

      // 添加映射关系（如果提供）
      if (validatedConfig.mappings) {
        Object.entries(validatedConfig.mappings).forEach(([key, value]) => {
          this.dynamicMappings.set(key, value)
        })
      }

      return true
    } catch (error) {
      console.error(`Failed to register provider ${config.id}:`, error)
      return false
    }
  }

  /**
   * 批量注册多个动态Providers
   */
  public registerMultipleProviders(configs: DynamicProviderRegistration[]): number {
    let successCount = 0
    configs.forEach((config) => {
      if (this.registerDynamicProvider(config)) {
        successCount++
      }
    })
    return successCount
  }

  /**
   * 获取Provider映射（包括动态映射）
   */
  public getProviderMapping(providerId: string): string | undefined {
    return this.dynamicMappings.get(providerId) || (this.dynamicProviders.has(providerId) ? providerId : undefined)
  }

  /**
   * 检查是否为动态注册的Provider
   */
  public isDynamicProvider(providerId: string): boolean {
    return this.dynamicProviders.has(providerId)
  }

  /**
   * 获取所有动态Provider映射
   */
  public getAllDynamicMappings(): Record<string, string> {
    return Object.fromEntries(this.dynamicMappings)
  }

  /**
   * 获取所有动态注册的Providers
   */
  public getDynamicProviders(): string[] {
    return Array.from(this.dynamicProviders)
  }

  /**
   * 获取所有有效的 Provider IDs（包括基础和动态）
   */
  public getAllValidProviderIds(): string[] {
    return [...Array.from(this.registry.keys()), ...this.dynamicProviders]
  }

  /**
   * 验证 Provider ID 是否有效
   */
  public validateProviderId(id: string): boolean {
    return validateProviderId(id)
  }

  /**
   * 清理资源 - 接管所有状态管理
   */
  public cleanup(): void {
    this.registry.clear()
    this.dynamicProviders.clear()
    this.dynamicMappings.clear()
    // 重新初始化基础 providers
    this.initializeProviders()
  }
}

// 导出单例实例
export const aiProviderRegistry = AiProviderRegistry.getInstance()

// 便捷函数
export const getProvider = (id: string) => aiProviderRegistry.getProvider(id)
export const getAllProviders = () => aiProviderRegistry.getAllProviders()
export const isProviderSupported = (id: string) => aiProviderRegistry.isSupported(id)
export const registerProvider = (config: ProviderConfig) => aiProviderRegistry.registerProvider(config)
export const validateProviderIdRegistry = (id: string) => aiProviderRegistry.validateProviderId(id)
export const getAllValidProviderIds = () => aiProviderRegistry.getAllValidProviderIds()

// 动态注册相关便捷函数
export const registerDynamicProvider = (config: DynamicProviderRegistration) =>
  aiProviderRegistry.registerDynamicProvider(config)
export const registerMultipleProviders = (configs: DynamicProviderRegistration[]) =>
  aiProviderRegistry.registerMultipleProviders(configs)
export const getProviderMapping = (providerId: string) => aiProviderRegistry.getProviderMapping(providerId)
export const isDynamicProvider = (providerId: string) => aiProviderRegistry.isDynamicProvider(providerId)
export const getAllDynamicMappings = () => aiProviderRegistry.getAllDynamicMappings()
export const getDynamicProviders = () => aiProviderRegistry.getDynamicProviders()
export const cleanup = () => aiProviderRegistry.cleanup()

// 导出类型
export type { DynamicProviderRegistration, ProviderConfig, ProviderId }
