/**
 * AI 执行器
 * 面向用户的主要API入口，专注于AI调用
 */
import { generateObject, generateText, LanguageModelV1, streamObject, streamText } from 'ai'

import { type ProviderId } from '../../types'
import { PluginEnabledAiClient } from '../clients/PluginEnabledAiClient'
import { type AiPlugin } from '../plugins'
import { isProviderSupported } from '../providers/registry'
import { type ExecutorConfig, type GenericExecutorConfig } from './types'

export class AiExecutor<T extends ProviderId = ProviderId> {
  private pluginClient: PluginEnabledAiClient<T>

  constructor(config: ExecutorConfig<T>)
  constructor(config: GenericExecutorConfig)
  constructor(config: ExecutorConfig<T> | GenericExecutorConfig) {
    if (isProviderSupported(config.providerId)) {
      this.pluginClient = new PluginEnabledAiClient(config.providerId as T)
    } else {
      // 对于未知provider，使用openai-compatible
      this.pluginClient = new PluginEnabledAiClient('openai-compatible' as T)
    }
  }

  /**
   * 流式文本生成
   * 用户友好的API，内部使用插件处理能力
   */
  async streamText(
    model: LanguageModelV1,
    params: Omit<Parameters<typeof streamText>[0], 'model'>
  ): Promise<ReturnType<typeof streamText>>
  async streamText(
    model: LanguageModelV1,
    params?: Omit<Parameters<typeof streamText>[0], 'model'>
  ): Promise<ReturnType<typeof streamText>> {
    // 传统方式：使用插件处理逻辑
    return this.pluginClient.executeStreamWithPlugins(
      'streamText',
      model.modelId,
      params!,
      async (finalModelId, transformedParams, streamTransforms) => {
        // const model = await this.pluginClient.createModelWithMiddlewares(finalModelId)
        const experimental_transform =
          params?.experimental_transform ?? (streamTransforms.length > 0 ? streamTransforms : undefined)

        return await streamText({
          model,
          ...transformedParams,
          experimental_transform
        })
      }
    )
  }

  /**
   * 生成文本
   * 用户友好的API，内部使用插件处理能力
   */
  async generateText(
    model: LanguageModelV1,
    params: Omit<Parameters<typeof generateText>[0], 'model'>
  ): Promise<ReturnType<typeof generateText>>
  async generateText(
    model: LanguageModelV1,
    params?: Omit<Parameters<typeof generateText>[0], 'model'>
  ): Promise<ReturnType<typeof generateText>> {
    // 传统方式：使用插件处理逻辑
    return this.pluginClient.executeWithPlugins(
      'generateText',
      model.modelId,
      params!,
      async (finalModelId, transformedParams) => {
        // const model = await this.pluginClient.createModelWithMiddlewares(finalModelId)
        return await generateText({ model, ...transformedParams })
      }
    )
  }

  /**
   * 生成结构化对象
   * 用户友好的API，内部使用插件处理能力
   */
  async generateObject(
    model: LanguageModelV1,
    params: Omit<Parameters<typeof generateObject>[0], 'model'>
  ): Promise<ReturnType<typeof generateObject>>
  async generateObject(
    model: LanguageModelV1,
    params?: Omit<Parameters<typeof generateObject>[0], 'model'>
  ): Promise<ReturnType<typeof generateObject>> {
    // 传统方式：使用插件处理逻辑
    return this.pluginClient.executeWithPlugins(
      'generateObject',
      model.modelId,
      params!,
      async (finalModelId, transformedParams) => {
        // const model = await this.pluginClient.createModelWithMiddlewares(finalModelId)
        return await generateObject({ model, ...transformedParams })
      }
    )
  }

  /**
   * 流式生成结构化对象
   * 用户友好的API，内部使用插件处理能力
   */
  async streamObject(
    model: LanguageModelV1,
    params: Omit<Parameters<typeof streamObject>[0], 'model'>
  ): Promise<ReturnType<typeof streamObject>>
  async streamObject(
    model: LanguageModelV1,
    params?: Omit<Parameters<typeof streamObject>[0], 'model'>
  ): Promise<ReturnType<typeof streamObject>> {
    // 传统方式：使用插件处理逻辑
    return this.pluginClient.executeWithPlugins(
      'streamObject',
      model.modelId,
      params!,
      async (finalModelId, transformedParams) => {
        // const model = await this.pluginClient.createModelWithMiddlewares(finalModelId)
        return await streamObject({ model, ...transformedParams })
      }
    )
  }

  /**
   * 获取插件统计信息（只读）
   */
  getPluginStats() {
    return this.pluginClient.getPluginStats()
  }

  /**
   * 获取所有插件（只读）
   */
  getPlugins() {
    return this.pluginClient.getPlugins()
  }

  /**
   * 获取客户端信息
   */
  getClientInfo() {
    return this.pluginClient.getClientInfo()
  }

  // === 静态工厂方法 ===

  /**
   * 创建执行器 - 支持已知provider的类型安全
   */
  static create<T extends ProviderId>(providerId: T, plugins?: AiPlugin[]): AiExecutor<T>
  static create(providerId: string, plugins?: AiPlugin[]): AiExecutor<any>
  static create(providerId: string, plugins: AiPlugin[] = []): AiExecutor {
    return new AiExecutor({
      providerId,
      plugins
    })
  }

  /**
   * 创建OpenAI Compatible执行器
   */
  static createOpenAICompatible(plugins: AiPlugin[] = []): AiExecutor<'openai-compatible'> {
    return new AiExecutor({
      providerId: 'openai-compatible',
      plugins
    })
  }
}
