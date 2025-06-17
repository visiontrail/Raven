import type { LanguageModelV1Middleware } from 'ai'

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
  // 是否支持图片生成
  supportsImageGeneration?: boolean
  // AI SDK 原生中间件
  aiSdkMiddlewares?: LanguageModelV1Middleware[]
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
        creatorFunctionName: 'createOpenAI',
        supportsImageGeneration: true
      },
      {
        id: 'anthropic',
        name: 'Anthropic',
        import: () => import('@ai-sdk/anthropic'),
        creatorFunctionName: 'createAnthropic',
        supportsImageGeneration: false
      },
      {
        id: 'google',
        name: 'Google Generative AI',
        import: () => import('@ai-sdk/google'),
        creatorFunctionName: 'createGoogleGenerativeAI',
        supportsImageGeneration: true
      },
      {
        id: 'google-vertex',
        name: 'Google Vertex AI',
        import: () => import('@ai-sdk/google-vertex'),
        creatorFunctionName: 'createVertex',
        supportsImageGeneration: true
      },
      {
        id: 'mistral',
        name: 'Mistral AI',
        import: () => import('@ai-sdk/mistral'),
        creatorFunctionName: 'createMistral',
        supportsImageGeneration: false
      },
      {
        id: 'xai',
        name: 'xAI (Grok)',
        import: () => import('@ai-sdk/xai'),
        creatorFunctionName: 'createXai',
        supportsImageGeneration: true
      },
      {
        id: 'azure',
        name: 'Azure OpenAI',
        import: () => import('@ai-sdk/azure'),
        creatorFunctionName: 'createAzure',
        supportsImageGeneration: true
      },
      {
        id: 'bedrock',
        name: 'Amazon Bedrock',
        import: () => import('@ai-sdk/amazon-bedrock'),
        creatorFunctionName: 'createAmazonBedrock',
        supportsImageGeneration: false
      },
      {
        id: 'cohere',
        name: 'Cohere',
        import: () => import('@ai-sdk/cohere'),
        creatorFunctionName: 'createCohere',
        supportsImageGeneration: false
      },
      {
        id: 'groq',
        name: 'Groq',
        import: () => import('@ai-sdk/groq'),
        creatorFunctionName: 'createGroq',
        supportsImageGeneration: false
      },
      {
        id: 'together',
        name: 'Together.ai',
        import: () => import('@ai-sdk/togetherai'),
        creatorFunctionName: 'createTogetherAI',
        supportsImageGeneration: true
      },
      {
        id: 'fireworks',
        name: 'Fireworks',
        import: () => import('@ai-sdk/fireworks'),
        creatorFunctionName: 'createFireworks',
        supportsImageGeneration: true
      },
      {
        id: 'deepseek',
        name: 'DeepSeek',
        import: () => import('@ai-sdk/deepseek'),
        creatorFunctionName: 'createDeepSeek',
        supportsImageGeneration: false
      },
      {
        id: 'cerebras',
        name: 'Cerebras',
        import: () => import('@ai-sdk/cerebras'),
        creatorFunctionName: 'createCerebras',
        supportsImageGeneration: false
      },
      {
        id: 'deepinfra',
        name: 'DeepInfra',
        import: () => import('@ai-sdk/deepinfra'),
        creatorFunctionName: 'createDeepInfra',
        supportsImageGeneration: false
      },
      {
        id: 'replicate',
        name: 'Replicate',
        import: () => import('@ai-sdk/replicate'),
        creatorFunctionName: 'createReplicate',
        supportsImageGeneration: true
      },
      {
        id: 'perplexity',
        name: 'Perplexity',
        import: () => import('@ai-sdk/perplexity'),
        creatorFunctionName: 'createPerplexity',
        supportsImageGeneration: false
      },
      {
        id: 'fal',
        name: 'Fal AI',
        import: () => import('@ai-sdk/fal'),
        creatorFunctionName: 'createFal',
        supportsImageGeneration: false
      },
      {
        id: 'vercel',
        name: 'Vercel',
        import: () => import('@ai-sdk/vercel'),
        creatorFunctionName: 'createVercel',
        supportsImageGeneration: false
      }
    ]

    // 社区提供的 Providers
    const communityProviders: ProviderConfig[] = [
      {
        id: 'ollama',
        name: 'Ollama',
        import: () => import('ollama-ai-provider'),
        creatorFunctionName: 'createOllama',
        supportsImageGeneration: false
      },
      {
        id: 'qwen',
        name: 'Qwen',
        import: () => import('qwen-ai-provider'),
        creatorFunctionName: 'createQwen',
        supportsImageGeneration: false
      },
      {
        id: 'zhipu',
        name: 'Zhipu AI',
        import: () => import('zhipu-ai-provider'),
        creatorFunctionName: 'createZhipu',
        supportsImageGeneration: false
      },
      {
        id: 'anthropic-vertex',
        name: 'Anthropic Vertex AI',
        import: () => import('anthropic-vertex-ai'),
        creatorFunctionName: 'createAnthropicVertex',
        supportsImageGeneration: false
      },
      {
        id: 'openrouter',
        name: 'OpenRouter',
        import: () => import('@openrouter/ai-sdk-provider'),
        creatorFunctionName: 'createOpenRouter',
        supportsImageGeneration: false
      }
    ]

    // 注册所有 providers（官方 + 社区）
    const allProviders = [...providers, ...communityProviders]
    allProviders.forEach((config) => {
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
