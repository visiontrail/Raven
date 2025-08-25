/**
 * Provider 注册表管理器
 * 纯粹的管理功能：存储、检索已配置好的 provider 实例
 * 基于 AI SDK 原生的 createProviderRegistry
 */

import { EmbeddingModelV2, ImageModelV2, LanguageModelV2, ProviderV2 } from '@ai-sdk/provider'
import { createProviderRegistry, type ProviderRegistryProvider } from 'ai'

type PROVIDERS = Record<string, ProviderV2>

export const DEFAULT_SEPARATOR = ':'

// export type MODEL_ID = `${string}${typeof DEFAULT_SEPARATOR}${string}`

export class RegistryManagement<SEPARATOR extends string = typeof DEFAULT_SEPARATOR> {
  private providers: PROVIDERS = {}
  private separator: SEPARATOR
  private registry: ProviderRegistryProvider<PROVIDERS, SEPARATOR> | null = null

  constructor(options: { separator: SEPARATOR } = { separator: DEFAULT_SEPARATOR as SEPARATOR }) {
    this.separator = options.separator
  }

  /**
   * 注册已配置好的 provider 实例
   */
  registerProvider(id: string, provider: ProviderV2): this {
    this.providers[id] = provider
    this.rebuildRegistry()
    return this
  }

  /**
   * 获取已注册的provider实例
   */
  getProvider(id: string): ProviderV2 | undefined {
    return this.providers[id]
  }

  /**
   * 批量注册 providers
   */
  registerProviders(providers: Record<string, ProviderV2>): this {
    Object.assign(this.providers, providers)
    this.rebuildRegistry()
    return this
  }

  /**
   * 移除 provider
   */
  unregisterProvider(id: string): this {
    delete this.providers[id]
    this.rebuildRegistry()
    return this
  }

  /**
   * 立即重建 registry - 每次变更都重建
   */
  private rebuildRegistry(): void {
    if (Object.keys(this.providers).length === 0) {
      this.registry = null
      return
    }

    this.registry = createProviderRegistry<PROVIDERS, SEPARATOR>(this.providers, {
      separator: this.separator
    })
  }

  /**
   * 获取语言模型 - AI SDK 原生方法
   */
  languageModel(id: `${string}${SEPARATOR}${string}`): LanguageModelV2 {
    if (!this.registry) {
      throw new Error('No providers registered')
    }
    return this.registry.languageModel(id)
  }

  /**
   * 获取文本嵌入模型 - AI SDK 原生方法
   */
  textEmbeddingModel(id: `${string}${SEPARATOR}${string}`): EmbeddingModelV2<string> {
    if (!this.registry) {
      throw new Error('No providers registered')
    }
    return this.registry.textEmbeddingModel(id)
  }

  /**
   * 获取图像模型 - AI SDK 原生方法
   */
  imageModel(id: `${string}${SEPARATOR}${string}`): ImageModelV2 {
    if (!this.registry) {
      throw new Error('No providers registered')
    }
    return this.registry.imageModel(id)
  }

  /**
   * 获取转录模型 - AI SDK 原生方法
   */
  transcriptionModel(id: `${string}${SEPARATOR}${string}`): any {
    if (!this.registry) {
      throw new Error('No providers registered')
    }
    return this.registry.transcriptionModel(id)
  }

  /**
   * 获取语音模型 - AI SDK 原生方法
   */
  speechModel(id: `${string}${SEPARATOR}${string}`): any {
    if (!this.registry) {
      throw new Error('No providers registered')
    }
    return this.registry.speechModel(id)
  }

  /**
   * 获取已注册的 provider 列表
   */
  getRegisteredProviders(): string[] {
    return Object.keys(this.providers)
  }

  /**
   * 检查是否有已注册的 providers
   */
  hasProviders(): boolean {
    return Object.keys(this.providers).length > 0
  }

  /**
   * 清除所有 providers
   */
  clear(): this {
    this.providers = {}
    this.registry = null
    return this
  }
}

/**
 * 全局注册表管理器实例
 */
export const globalRegistryManagement = new RegistryManagement<':'>()
