import { type AnthropicProviderSettings } from '@ai-sdk/anthropic'
import { type AzureOpenAIProviderSettings } from '@ai-sdk/azure'
import { type DeepSeekProviderSettings } from '@ai-sdk/deepseek'
import { type GoogleGenerativeAIProviderSettings } from '@ai-sdk/google'
import { type OpenAIProviderSettings } from '@ai-sdk/openai'
import { type OpenAICompatibleProviderSettings } from '@ai-sdk/openai-compatible'
import { type XaiProviderSettings } from '@ai-sdk/xai'

/**
 * Provider 相关核心类型定义
 * 只定义必要的接口，其他类型直接使用 AI SDK
 */
export type ProviderId = keyof ProviderSettingsMap & string

// Provider 配置接口 - 支持灵活的创建方式
export interface ProviderConfig {
  id: string
  name: string

  // 方式一：直接提供 creator 函数（推荐用于自定义）
  creator?: (options: any) => any

  // 方式二：动态导入 + 函数名（用于包导入）
  import?: () => Promise<any>
  creatorFunctionName?: string

  // 图片生成支持
  supportsImageGeneration?: boolean
  imageCreator?: (options: any) => any

  // 可选的验证函数
  validateOptions?: (options: any) => boolean
}

// API 客户端工厂接口
export interface ApiClientFactory {
  createAiSdkClient(providerId: string, options?: any): Promise<any>
  getCachedClient(providerId: string, options?: any): any
  clearCache(): void
}

// 客户端配置
export interface ClientConfig {
  providerId: string
  apiKey?: string
  baseURL?: string
  [key: string]: any
}

// 错误类型
export class ProviderError extends Error {
  constructor(
    message: string,
    public providerId: string,
    public code?: string,
    public cause?: Error
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}

// 缓存统计信息
export interface CacheStats {
  size: number
  keys: string[]
  lastCleanup?: Date
}

// 类型安全的 Provider Settings 映射
export type ProviderSettingsMap = {
  openai: OpenAIProviderSettings
  'openai-compatible': OpenAICompatibleProviderSettings
  // openrouter: OpenRouterProviderSettings
  anthropic: AnthropicProviderSettings
  google: GoogleGenerativeAIProviderSettings
  // 'google-vertex': GoogleVertexProviderSettings
  // mistral: MistralProviderSettings
  xai: XaiProviderSettings
  azure: AzureOpenAIProviderSettings
  // bedrock: AmazonBedrockProviderSettings
  // cohere: CohereProviderSettings
  // groq: GroqProviderSettings
  // together: TogetherAIProviderSettings
  // fireworks: FireworksProviderSettings
  deepseek: DeepSeekProviderSettings
  // cerebras: CerebrasProviderSettings
  // deepinfra: DeepInfraProviderSettings
  // replicate: ReplicateProviderSettings
  // perplexity: PerplexityProviderSettings
  // fal: FalProviderSettings
  // vercel: VercelProviderSettings
  // ollama: OllamaProviderSettings
  // 'anthropic-vertex': AnthropicVertexProviderSettings
}

// 重新导出所有类型供外部使用
export type {
  // AmazonBedrockProviderSettings,
  AnthropicProviderSettings,
  // AnthropicVertexProviderSettings,
  AzureOpenAIProviderSettings,
  // CerebrasProviderSettings,
  // CohereProviderSettings,
  // DeepInfraProviderSettings,
  DeepSeekProviderSettings,
  // FalProviderSettings,
  // FireworksProviderSettings,
  GoogleGenerativeAIProviderSettings,
  // GoogleVertexProviderSettings,
  // GroqProviderSettings,
  // MistralProviderSettings,
  // OllamaProviderSettings,
  OpenAICompatibleProviderSettings,
  OpenAIProviderSettings,
  // OpenRouterProviderSettings,
  // PerplexityProviderSettings,
  // ReplicateProviderSettings,
  // TogetherAIProviderSettings,
  // VercelProviderSettings,
  XaiProviderSettings
}
