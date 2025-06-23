/**
 * AI Client - Cherry Studio AI Core 的主要客户端接口
 * 默认集成插件系统，提供完整的 AI 调用能力
 *
 * ## 使用方式
 *
 * ```typescript
 * import { AiClient } from '@cherrystudio/ai-core'
 *
 * // 创建客户端（默认带插件系统）
 * const client = AiClient.create('openai', {
 *   name: 'openai',
 *   apiKey: process.env.OPENAI_API_KEY
 * }, [LoggingPlugin, ContentFilterPlugin])
 *
 * // 使用方式与 UniversalAiSdkClient 完全相同
 * const result = await client.generateText('gpt-4', {
 *   messages: [{ role: 'user', content: 'Hello!' }]
 * })
 * ```
 */

import { type ProviderId, type ProviderSettingsMap } from '../../types'
import { getProviderInfo } from '..'
import { type AiPlugin, createContext, PluginManager } from '../plugins'
import { isProviderSupported } from '../providers/registry'

/**
 * 插件增强的 AI 客户端
 * 专注于插件处理，不暴露用户API
 */
export class PluginEnabledAiClient<T extends ProviderId = ProviderId> {
  private pluginManager: PluginManager

  constructor(
    private readonly providerId: T,
    // private readonly options: ProviderSettingsMap[T],
    plugins: AiPlugin[] = []
  ) {
    this.pluginManager = new PluginManager(plugins)
  }

  /**
   * 添加插件
   */
  use(plugin: AiPlugin): this {
    this.pluginManager.use(plugin)
    return this
  }

  /**
   * 批量添加插件
   */
  usePlugins(plugins: AiPlugin[]): this {
    plugins.forEach((plugin) => this.use(plugin))
    return this
  }

  /**
   * 移除插件
   */
  removePlugin(pluginName: string): this {
    this.pluginManager.remove(pluginName)
    return this
  }

  /**
   * 获取插件统计
   */
  getPluginStats() {
    return this.pluginManager.getStats()
  }

  /**
   * 获取所有插件
   */
  getPlugins() {
    return this.pluginManager.getPlugins()
  }

  // /**
  //  * 使用core模块创建模型（包含中间件）
  //  */
  // async createModelWithMiddlewares(modelId: string): Promise<any> {
  //   // 使用core模块的resolveConfig解析配置
  //   const config = resolveConfig(this.providerId, modelId, this.options, this.pluginManager.getPlugins())

  //   // 使用core模块创建包装好的模型
  //   return createModelFromConfig(config)
  // }

  /**
   * 执行带插件的操作（非流式）
   * 提供给AiExecutor使用
   */
  async executeWithPlugins<TParams, TResult>(
    methodName: string,
    modelId: string,
    params: TParams,
    executor: (finalModelId: string, transformedParams: TParams) => Promise<TResult>
  ): Promise<TResult> {
    // 使用正确的createContext创建请求上下文
    const context = createContext(this.providerId, modelId, params)

    try {
      // 1. 触发请求开始事件
      await this.pluginManager.executeParallel('onRequestStart', context)

      // 2. 解析模型别名
      const resolvedModelId = await this.pluginManager.executeFirst<string>('resolveModel', modelId, context)
      const finalModelId = resolvedModelId || modelId

      // 3. 转换请求参数
      const transformedParams = await this.pluginManager.executeSequential('transformParams', params, context)

      // 4. 执行具体的 API 调用
      const result = await executor(finalModelId, transformedParams)

      // 5. 转换结果（对于非流式调用）
      const transformedResult = await this.pluginManager.executeSequential('transformResult', result, context)

      // 6. 触发完成事件
      await this.pluginManager.executeParallel('onRequestEnd', context, transformedResult)

      return transformedResult
    } catch (error) {
      // 7. 触发错误事件
      await this.pluginManager.executeParallel('onError', context, undefined, error as Error)
      throw error
    }
  }

  /**
   * 执行流式调用的通用逻辑（支持流转换器）
   * 提供给AiExecutor使用
   */
  async executeStreamWithPlugins<TParams, TResult>(
    methodName: string,
    modelId: string,
    params: TParams,
    executor: (finalModelId: string, transformedParams: TParams, streamTransforms: any[]) => Promise<TResult>
  ): Promise<TResult> {
    // 创建请求上下文
    const context = createContext(this.providerId, modelId, params)

    try {
      // 1. 触发请求开始事件
      await this.pluginManager.executeParallel('onRequestStart', context)

      // 2. 解析模型别名
      const resolvedModelId = await this.pluginManager.executeFirst<string>('resolveModel', modelId, context)
      const finalModelId = resolvedModelId || modelId

      // 3. 转换请求参数
      const transformedParams = await this.pluginManager.executeSequential('transformParams', params, context)

      // 4. 收集流转换器
      const streamTransforms = this.pluginManager.collectStreamTransforms()

      // 5. 执行流式 API 调用
      const result = await executor(finalModelId, transformedParams, streamTransforms)

      // 6. 触发完成事件（注意：对于流式调用，这里触发的是开始流式响应的事件）
      await this.pluginManager.executeParallel('onRequestEnd', context, { stream: true })

      return result
    } catch (error) {
      // 7. 触发错误事件
      await this.pluginManager.executeParallel('onError', context, undefined, error as Error)
      throw error
    }
  }

  /**
   * 获取客户端信息
   */
  getClientInfo() {
    return getProviderInfo(this.providerId)
  }

  // /**
  //  * 获取底层客户端实例（用于高级用法）
  //  */
  // getBaseClient(): UniversalAiSdkClient<T> {
  //   return this.baseClient
  // }

  // === 静态工厂方法 ===

  /**
   * 创建 OpenAI Compatible 客户端
   */
  static createOpenAICompatible(
    config: ProviderSettingsMap['openai-compatible'],
    plugins: AiPlugin[] = []
  ): PluginEnabledAiClient<'openai-compatible'> {
    return new PluginEnabledAiClient('openai-compatible', plugins)
  }

  /**
   * 创建标准提供商客户端
   */
  static create<T extends ProviderId>(providerId: T, plugins?: AiPlugin[]): PluginEnabledAiClient<T>

  static create(providerId: string, plugins?: AiPlugin[]): PluginEnabledAiClient<'openai-compatible'>

  static create(providerId: string, plugins: AiPlugin[] = []): PluginEnabledAiClient {
    if (isProviderSupported(providerId)) {
      return new PluginEnabledAiClient(providerId as ProviderId, plugins)
    } else {
      // 对于未知 provider，使用 openai-compatible
      return new PluginEnabledAiClient('openai-compatible', plugins)
    }
  }
}

/**
 * 创建 AI 客户端的工厂函数（默认带插件系统）
 * @deprecated 建议使用 AiExecutor 代替
 */
export function createClient<T extends ProviderId>(providerId: T, plugins?: AiPlugin[]): PluginEnabledAiClient<T>

export function createClient(providerId: string, plugins?: AiPlugin[]): PluginEnabledAiClient<'openai-compatible'>

export function createClient(providerId: string, plugins: AiPlugin[] = []): PluginEnabledAiClient {
  return PluginEnabledAiClient.create(providerId, plugins)
}

/**
 * 创建 OpenAI Compatible 客户端的便捷函数
 * @deprecated 建议使用 AiExecutor 代替
 */
export function createCompatibleClient(
  config: ProviderSettingsMap['openai-compatible'],
  plugins: AiPlugin[] = []
): PluginEnabledAiClient<'openai-compatible'> {
  return PluginEnabledAiClient.createOpenAICompatible(config, plugins)
}
