/**
 * Universal AI SDK Client
 * 基于现有实现的简化版统一AI SDK客户端
 */

import { generateText, streamText } from 'ai'

import { aiProviderRegistry } from '../providers/registry'

/**
 * Universal AI SDK Client
 * 统一的AI SDK客户端实现
 */
export class UniversalAiSdkClient {
  private provider: any // The instantiated provider (e.g., from createOpenAI)
  private initialized = false
  private providerConfig: any

  constructor(
    private providerName: string,
    private options: any // API keys, etc.
  ) {}

  /**
   * 初始化客户端 - 异步步骤，因为涉及动态导入
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    // 获取Provider配置
    this.providerConfig = aiProviderRegistry.getProvider(this.providerName)
    if (!this.providerConfig) {
      throw new Error(`Provider "${this.providerName}" is not registered.`)
    }

    try {
      // 使用注册表的动态导入功能
      const module = await this.providerConfig.import()

      // 获取创建函数
      const creatorFunction = module[this.providerConfig.creatorFunctionName]

      if (typeof creatorFunction !== 'function') {
        throw new Error(
          `Creator function "${this.providerConfig.creatorFunctionName}" not found in the imported module for provider "${this.providerName}".`
        )
      }

      // 创建provider实例
      this.provider = creatorFunction(this.options)
      this.initialized = true
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to initialize provider "${this.providerName}": ${error.message}`)
      }
      throw new Error(`An unknown error occurred while initializing provider "${this.providerName}".`)
    }
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * 获取特定模型实例的辅助方法
   */
  private getModel(modelId: string): any {
    if (!this.initialized) throw new Error('Client not initialized')

    // 大多数providers都有直接调用模式：provider(modelId)
    if (typeof this.provider === 'function') {
      return this.provider(modelId)
    }

    throw new Error(`Unknown model access pattern for provider "${this.providerName}"`)
  }

  /**
   * 实现流式逻辑，使用核心ai-sdk函数
   */
  async stream(request: any): Promise<any> {
    if (!this.initialized) await this.initialize()

    const model = this.getModel(request.modelId)

    // 直接调用标准ai-sdk函数
    return streamText({
      model,
      ...request
    })
  }

  /**
   * 实现非流式逻辑
   */
  async generate(request: any): Promise<any> {
    if (!this.initialized) await this.initialize()

    const model = this.getModel(request.modelId)

    return generateText({
      model,
      ...request
    })
  }

  /**
   * 验证配置
   */
  validateConfig(): boolean {
    try {
      // 基础验证
      if (!this.providerName) return false
      if (!this.providerConfig) return false

      // API Key验证（如果需要）
      if (this.requiresApiKey() && !this.options?.apiKey) {
        return false
      }

      return true
    } catch {
      return false
    }
  }

  /**
   * 检查Provider是否需要API Key
   */
  private requiresApiKey(): boolean {
    // 大多数云服务Provider都需要API Key
    const noApiKeyProviders = ['local', 'ollama'] // 本地运行的Provider
    return !noApiKeyProviders.includes(this.providerName)
  }

  /**
   * 获取Provider信息
   */
  getProviderInfo(): {
    id: string
    name: string
    isInitialized: boolean
  } {
    return {
      id: this.providerName,
      name: this.providerConfig?.name || this.providerName,
      isInitialized: this.initialized
    }
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.provider = null
    this.initialized = false
    this.providerConfig = null
  }
}

// 工厂函数，方便创建客户端
export async function createUniversalClient(providerName: string, options: any = {}): Promise<UniversalAiSdkClient> {
  const client = new UniversalAiSdkClient(providerName, options)
  await client.initialize()
  return client
}

// 便捷的流式生成函数
export async function streamGeneration(
  providerName: string,
  modelId: string,
  messages: any[],
  options: any = {}
): Promise<any> {
  const client = await createUniversalClient(providerName, options)

  return client.stream({
    modelId,
    messages,
    ...options
  })
}

// 便捷的非流式生成函数
export async function generateCompletion(
  providerName: string,
  modelId: string,
  messages: any[],
  options: any = {}
): Promise<any> {
  const client = await createUniversalClient(providerName, options)

  return client.generate({
    modelId,
    messages,
    ...options
  })
}
