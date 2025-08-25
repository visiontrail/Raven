/**
 * 动态Provider注册表 - 完全基于AI SDK原生
 * 每次变更都重建registry，让AI SDK处理所有逻辑
 */

import { EmbeddingModelV2, ImageModelV2, LanguageModelV2, ProviderV2 } from '@ai-sdk/provider'
import { createProviderRegistry } from 'ai'

export class DynamicProviderRegistry {
  private providers: Record<string, ProviderV2> = {}
  private separator: string
  private registry: any | null = null

  constructor(options: { separator?: string } = {}) {
    this.separator = options.separator || '>'
  }

  /**
   * 动态注册provider - 立即重建registry
   */
  registerProvider(id: string, provider: ProviderV2): this {
    this.providers[id] = provider
    this.rebuildRegistry()
    return this
  }

  /**
   * 批量注册providers
   */
  registerProviders(providers: Record<string, ProviderV2>): this {
    Object.assign(this.providers, providers)
    this.rebuildRegistry()
    return this
  }

  /**
   * 移除provider
   */
  unregisterProvider(id: string): this {
    delete this.providers[id]
    this.rebuildRegistry()
    return this
  }

  /**
   * 立即重建registry - 每次变更都重建
   */
  private rebuildRegistry(): void {
    if (Object.keys(this.providers).length === 0) {
      this.registry = null
      return
    }

    this.registry = createProviderRegistry(this.providers, {
      separator: this.separator
    })
  }

  /**
   * 获取语言模型 - AI SDK原生方法
   */
  languageModel(id: string): LanguageModelV2 {
    if (!this.registry) {
      throw new Error('No providers registered')
    }
    return this.registry.languageModel(id)
  }

  /**
   * 获取文本嵌入模型 - AI SDK原生方法
   */
  textEmbeddingModel(id: string): EmbeddingModelV2<string> {
    if (!this.registry) {
      throw new Error('No providers registered')
    }
    return this.registry.textEmbeddingModel(id)
  }

  /**
   * 获取图像模型 - AI SDK原生方法
   */
  imageModel(id: string): ImageModelV2 {
    if (!this.registry) {
      throw new Error('No providers registered')
    }
    return this.registry.imageModel(id)
  }

  /**
   * 获取转录模型 - AI SDK原生方法
   */
  transcriptionModel(id: string): any {
    if (!this.registry) {
      throw new Error('No providers registered')
    }
    return this.registry.transcriptionModel(id)
  }

  /**
   * 获取语音模型 - AI SDK原生方法
   */
  speechModel(id: string): any {
    if (!this.registry) {
      throw new Error('No providers registered')
    }
    return this.registry.speechModel(id)
  }

  /**
   * 获取已注册的provider列表
   */
  getRegisteredProviders(): string[] {
    return Object.keys(this.providers)
  }

  /**
   * 检查是否有已注册的providers
   */
  hasProviders(): boolean {
    return Object.keys(this.providers).length > 0
  }

  /**
   * 清除所有providers
   */
  clear(): this {
    this.providers = {}
    this.registry = null
    return this
  }
}

/**
 * 全局动态registry实例
 */
export const globalDynamicRegistry = new DynamicProviderRegistry({ separator: '>' })
