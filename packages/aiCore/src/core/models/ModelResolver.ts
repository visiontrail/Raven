/**
 * 模型解析器 - models模块的核心
 * 负责将modelId解析为AI SDK的LanguageModel实例
 * 支持传统格式和命名空间格式
 */

import { EmbeddingModelV2, ImageModelV2, LanguageModelV2 } from '@ai-sdk/provider'

import { globalDynamicRegistry } from '../providers/DynamicProviderRegistry'

export class ModelResolver {
  /**
   * 核心方法：解析任意格式的modelId为语言模型
   *
   * @param modelId 模型ID，支持 'gpt-4' 和 'anthropic>claude-3' 两种格式
   * @param fallbackProviderId 当modelId为传统格式时使用的providerId
   * @param providerOptions provider配置选项（暂时保留，可能在未来使用）
   */
  async resolveLanguageModel(
    modelId: string,
    fallbackProviderId: string,
    _providerOptions?: any
  ): Promise<LanguageModelV2> {
    // 检查是否是命名空间格式 (aihubmix>anthropic>claude-3)
    if (modelId.includes('>')) {
      return this.resolveNamespacedModel(modelId)
    }

    // 传统格式：使用fallbackProviderId + modelId (openai + gpt-4)
    return this.resolveTraditionalModel(fallbackProviderId, modelId)
  }

  /**
   * 解析文本嵌入模型
   */
  async resolveTextEmbeddingModel(
    modelId: string,
    fallbackProviderId: string,
    _providerOptions?: any
  ): Promise<EmbeddingModelV2<string>> {
    if (modelId.includes('>')) {
      return this.resolveNamespacedEmbeddingModel(modelId)
    }

    return this.resolveTraditionalEmbeddingModel(fallbackProviderId, modelId)
  }

  /**
   * 解析图像模型
   */
  async resolveImageModel(modelId: string, fallbackProviderId: string, _providerOptions?: any): Promise<ImageModelV2> {
    if (modelId.includes('>')) {
      return this.resolveNamespacedImageModel(modelId)
    }

    return this.resolveTraditionalImageModel(fallbackProviderId, modelId)
  }

  /**
   * 解析命名空间格式的语言模型
   * aihubmix>anthropic>claude-3 -> globalDynamicRegistry.languageModel('aihubmix>anthropic>claude-3')
   */
  private resolveNamespacedModel(modelId: string): LanguageModelV2 {
    return globalDynamicRegistry.languageModel(modelId)
  }

  /**
   * 解析传统格式的语言模型
   * providerId: 'openai', modelId: 'gpt-4' -> globalDynamicRegistry.languageModel('openai>gpt-4')
   */
  private resolveTraditionalModel(providerId: string, modelId: string): LanguageModelV2 {
    const fullModelId = `${providerId}>${modelId}`
    return globalDynamicRegistry.languageModel(fullModelId)
  }

  /**
   * 解析命名空间格式的嵌入模型
   */
  private resolveNamespacedEmbeddingModel(modelId: string): EmbeddingModelV2<string> {
    return globalDynamicRegistry.textEmbeddingModel(modelId)
  }

  /**
   * 解析传统格式的嵌入模型
   */
  private resolveTraditionalEmbeddingModel(providerId: string, modelId: string): EmbeddingModelV2<string> {
    const fullModelId = `${providerId}>${modelId}`
    return globalDynamicRegistry.textEmbeddingModel(fullModelId)
  }

  /**
   * 解析命名空间格式的图像模型
   */
  private resolveNamespacedImageModel(modelId: string): ImageModelV2 {
    return globalDynamicRegistry.imageModel(modelId)
  }

  /**
   * 解析传统格式的图像模型
   */
  private resolveTraditionalImageModel(providerId: string, modelId: string): ImageModelV2 {
    const fullModelId = `${providerId}>${modelId}`
    return globalDynamicRegistry.imageModel(fullModelId)
  }
}

/**
 * 全局模型解析器实例
 */
export const globalModelResolver = new ModelResolver()
