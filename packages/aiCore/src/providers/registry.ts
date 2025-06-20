/**
 * AI Provider 注册表
 * 统一管理所有 AI SDK Providers 的动态导入和工厂函数
 */

// Provider 配置接口（简化版）
export interface ProviderConfig {
  id: string
  name: string
  // 动态导入函数
  import: () => Promise<any>
  // 创建函数名称
  creatorFunctionName: string
}

/**
 * AI SDK Provider 注册表
 * 管理所有支持的 AI Providers 及其动态导入
 */
export class AiProviderRegistry {
  private static instance: AiProviderRegistry
  private registry = new Map<string, ProviderConfig>()

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
   * 基于 AI SDK 官方文档: https://ai-sdk.dev/providers/ai-sdk-providers
   */
  private initializeProviders(): void {
    const providers: ProviderConfig[] = [
      // 核心 AI SDK Providers
      {
        id: 'openai',
        name: 'OpenAI',
        import: () => import('@ai-sdk/openai'),
        creatorFunctionName: 'createOpenAI'
      },
      {
        id: 'anthropic',
        name: 'Anthropic',
        import: () => import('@ai-sdk/anthropic'),
        creatorFunctionName: 'createAnthropic'
      },
      {
        id: 'google',
        name: 'Google Generative AI',
        import: () => import('@ai-sdk/google'),
        creatorFunctionName: 'createGoogleGenerativeAI'
      },
      {
        id: 'google-vertex',
        name: 'Google Vertex AI',
        import: () => import('@ai-sdk/google-vertex'),
        creatorFunctionName: 'createVertex'
      },
      {
        id: 'mistral',
        name: 'Mistral AI',
        import: () => import('@ai-sdk/mistral'),
        creatorFunctionName: 'createMistral'
      },
      {
        id: 'xai',
        name: 'xAI (Grok)',
        import: () => import('@ai-sdk/xai'),
        creatorFunctionName: 'createXai'
      },
      {
        id: 'azure',
        name: 'Azure OpenAI',
        import: () => import('@ai-sdk/azure'),
        creatorFunctionName: 'createAzure'
      },
      {
        id: 'bedrock',
        name: 'Amazon Bedrock',
        import: () => import('@ai-sdk/amazon-bedrock'),
        creatorFunctionName: 'createAmazonBedrock'
      },
      {
        id: 'cohere',
        name: 'Cohere',
        import: () => import('@ai-sdk/cohere'),
        creatorFunctionName: 'createCohere'
      },
      {
        id: 'groq',
        name: 'Groq',
        import: () => import('@ai-sdk/groq'),
        creatorFunctionName: 'createGroq'
      },
      {
        id: 'together',
        name: 'Together.ai',
        import: () => import('@ai-sdk/togetherai'),
        creatorFunctionName: 'createTogetherAI'
      },
      {
        id: 'fireworks',
        name: 'Fireworks',
        import: () => import('@ai-sdk/fireworks'),
        creatorFunctionName: 'createFireworks'
      },
      {
        id: 'deepseek',
        name: 'DeepSeek',
        import: () => import('@ai-sdk/deepseek'),
        creatorFunctionName: 'createDeepSeek'
      },
      {
        id: 'cerebras',
        name: 'Cerebras',
        import: () => import('@ai-sdk/cerebras'),
        creatorFunctionName: 'createCerebras'
      },
      {
        id: 'deepinfra',
        name: 'DeepInfra',
        import: () => import('@ai-sdk/deepinfra'),
        creatorFunctionName: 'createDeepInfra'
      },
      {
        id: 'replicate',
        name: 'Replicate',
        import: () => import('@ai-sdk/replicate'),
        creatorFunctionName: 'createReplicate'
      },
      {
        id: 'perplexity',
        name: 'Perplexity',
        import: () => import('@ai-sdk/perplexity'),
        creatorFunctionName: 'createPerplexity'
      },
      {
        id: 'fal',
        name: 'Fal AI',
        import: () => import('@ai-sdk/fal'),
        creatorFunctionName: 'createFal'
      },
      {
        id: 'vercel',
        name: 'Vercel',
        import: () => import('@ai-sdk/vercel'),
        creatorFunctionName: 'createVercel'
      }
    ]

    // 初始化注册表
    providers.forEach((config) => {
      this.registry.set(config.id, config)
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
    return this.registry.get(id)
  }

  /**
   * 检查 Provider 是否支持（是否已注册）
   */
  public isSupported(id: string): boolean {
    return this.registry.has(id)
  }

  /**
   * 注册新的 Provider（用于扩展）
   */
  public registerProvider(config: ProviderConfig): void {
    this.registry.set(config.id, config)
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.registry.clear()
  }

  /**
   * 获取兼容现有实现的注册表格式
   */
  public getCompatibleRegistry(): Record<string, { import: () => Promise<any>; creatorFunctionName: string }> {
    const compatibleRegistry: Record<string, { import: () => Promise<any>; creatorFunctionName: string }> = {}

    this.getAllProviders().forEach((provider) => {
      compatibleRegistry[provider.id] = {
        import: provider.import,
        creatorFunctionName: provider.creatorFunctionName
      }
    })

    return compatibleRegistry
  }
}

// 导出单例实例
export const aiProviderRegistry = AiProviderRegistry.getInstance()

// 便捷函数
export const getProvider = (id: string) => aiProviderRegistry.getProvider(id)
export const getAllProviders = () => aiProviderRegistry.getAllProviders()
export const isProviderSupported = (id: string) => aiProviderRegistry.isSupported(id)
export const registerProvider = (config: ProviderConfig) => aiProviderRegistry.registerProvider(config)

// 兼容现有实现的导出
export const PROVIDER_REGISTRY = aiProviderRegistry.getCompatibleRegistry()
