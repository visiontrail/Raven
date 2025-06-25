import { type ProviderId, type ProviderSettingsMap } from '../../types'
import { type AiPlugin, createContext, PluginManager } from '../plugins'
import { isProviderSupported } from '../providers/registry'

/**
 * 插件增强的 AI 客户端
 * 专注于插件处理，不暴露用户API
 */
export class PluginEngine<T extends ProviderId = ProviderId> {
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
  // === 静态工厂方法 ===

  /**
   * 创建 OpenAI Compatible 客户端
   */
  static createOpenAICompatible(
    config: ProviderSettingsMap['openai-compatible'],
    plugins: AiPlugin[] = []
  ): PluginEngine<'openai-compatible'> {
    return new PluginEngine('openai-compatible', plugins)
  }

  /**
   * 创建标准提供商客户端
   */
  static create<T extends ProviderId>(providerId: T, plugins?: AiPlugin[]): PluginEngine<T>

  static create(providerId: string, plugins?: AiPlugin[]): PluginEngine<'openai-compatible'>

  static create(providerId: string, plugins: AiPlugin[] = []): PluginEngine {
    if (isProviderSupported(providerId)) {
      return new PluginEngine(providerId as ProviderId, plugins)
    } else {
      // 对于未知 provider，使用 openai-compatible
      return new PluginEngine('openai-compatible', plugins)
    }
  }
}
