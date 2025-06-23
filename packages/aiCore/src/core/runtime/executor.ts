/**
 * 运行时执行器
 * 专注于插件化的AI调用处理
 */
import { generateObject, generateText, LanguageModelV1, streamObject, streamText } from 'ai'

import { type ProviderId, type ProviderSettingsMap } from '../../types'
import { createModel, getProviderInfo } from '../models'
import { type AiPlugin } from '../plugins'
import { isProviderSupported } from '../providers/registry'
import { PluginEngine } from './pluginEngine'
import { type RuntimeConfig } from './types'

export class RuntimeExecutor<T extends ProviderId = ProviderId> {
  private pluginClient: PluginEngine<T>
  // private options: ProviderSettingsMap[T]
  private config: RuntimeConfig<T>

  constructor(config: RuntimeConfig<T>) {
    if (!isProviderSupported(config.providerId)) {
      throw new Error(`Unsupported provider: ${config.providerId}`)
    }

    // 存储options供后续使用
    // this.options = config.options
    this.config = config
    // 创建插件客户端
    this.pluginClient = new PluginEngine(config.providerId, config.plugins || [])
  }

  /**
   * 流式文本生成 - 使用modelId自动创建模型
   */
  async streamText(
    modelId: string,
    params: Omit<Parameters<typeof streamText>[0], 'model'>
  ): Promise<ReturnType<typeof streamText>> {
    // 1. 使用 createModel 创建模型
    const model = await createModel({
      providerId: this.config.providerId,
      modelId,
      options: this.config.options
    })

    // 2. 执行插件处理
    return this.pluginClient.executeStreamWithPlugins(
      'streamText',
      modelId,
      params,
      async (finalModelId, transformedParams, streamTransforms) => {
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
   * 流式文本生成 - 直接使用已创建的模型
   */
  async streamTextWithModel(
    model: LanguageModelV1,
    params: Omit<Parameters<typeof streamText>[0], 'model'>
  ): Promise<ReturnType<typeof streamText>> {
    return this.pluginClient.executeStreamWithPlugins(
      'streamText',
      model.modelId,
      params,
      async (finalModelId, transformedParams, streamTransforms) => {
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
   */
  async generateText(
    modelId: string,
    params: Omit<Parameters<typeof generateText>[0], 'model'>
  ): Promise<ReturnType<typeof generateText>> {
    const model = await createModel({
      providerId: this.config.providerId,
      modelId,
      options: this.config.options
    })

    return this.pluginClient.executeWithPlugins(
      'generateText',
      modelId,
      params,
      async (finalModelId, transformedParams) => {
        return await generateText({ model, ...transformedParams })
      }
    )
  }

  /**
   * 生成结构化对象
   */
  async generateObject(
    modelId: string,
    params: Omit<Parameters<typeof generateObject>[0], 'model'>
  ): Promise<ReturnType<typeof generateObject>> {
    const model = await createModel({
      providerId: this.config.providerId,
      modelId,
      options: this.config.options
    })

    return this.pluginClient.executeWithPlugins(
      'generateObject',
      modelId,
      params,
      async (finalModelId, transformedParams) => {
        return await generateObject({ model, ...transformedParams })
      }
    )
  }

  /**
   * 流式生成结构化对象
   */
  async streamObject(
    modelId: string,
    params: Omit<Parameters<typeof streamObject>[0], 'model'>
  ): Promise<ReturnType<typeof streamObject>> {
    const model = await createModel({
      providerId: this.config.providerId,
      modelId,
      options: this.config.options
    })

    return this.pluginClient.executeWithPlugins(
      'streamObject',
      modelId,
      params,
      async (finalModelId, transformedParams) => {
        return await streamObject({ model, ...transformedParams })
      }
    )
  }
  /**
   * 获取客户端信息
   */
  getClientInfo() {
    return getProviderInfo(this.config.providerId)
  }

  // === 静态工厂方法 ===

  /**
   * 创建执行器 - 支持已知provider的类型安全
   */
  static create<T extends ProviderId>(
    providerId: T,
    options: ProviderSettingsMap[T],
    plugins?: AiPlugin[]
  ): RuntimeExecutor<T> {
    return new RuntimeExecutor({
      providerId,
      options,
      plugins
    })
  }

  /**
   * 创建OpenAI Compatible执行器
   */
  static createOpenAICompatible(
    options: ProviderSettingsMap['openai-compatible'],
    plugins: AiPlugin[] = []
  ): RuntimeExecutor<'openai-compatible'> {
    return new RuntimeExecutor({
      providerId: 'openai-compatible',
      options,
      plugins
    })
  }
}
