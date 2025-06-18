import { FetchFunction } from '@ai-sdk/provider-utils'

import type { ProviderSettingsMap } from '../providers/registry'

// ProviderSettings 是所有 Provider Settings 的联合类型
export type ProviderSettings = ProviderSettingsMap[keyof ProviderSettingsMap]

// 基础 Provider 配置类型（为了向后兼容和通用场景）
export type BaseProviderSettings = {
  /**
   * API key for authentication
   */
  apiKey?: string
  /**
   * Base URL for the API calls
   */
  baseURL?: string
  /**
   * Custom headers to include in the requests
   */
  headers?: Record<string, string>
  /**
   * Optional custom url query parameters to include in request urls
   */
  queryParams?: Record<string, string>
  /**
   * Custom fetch implementation. You can use it as a middleware to intercept requests,
   * or to provide a custom fetch implementation for e.g. testing.
   */
  fetch?: FetchFunction
  /**
   * Allow additional properties for provider-specific settings
   */
  [key: string]: any
}

// 重新导出 ProviderSettingsMap 中的所有类型
export type {
  AmazonBedrockProviderSettings,
  AnthropicProviderSettings,
  AnthropicVertexProviderSettings,
  AzureOpenAIProviderSettings,
  CerebrasProviderSettings,
  CohereProviderSettings,
  DeepInfraProviderSettings,
  DeepSeekProviderSettings,
  FalProviderSettings,
  FireworksProviderSettings,
  GoogleGenerativeAIProviderSettings,
  GoogleVertexProviderSettings,
  GroqProviderSettings,
  MistralProviderSettings,
  OllamaProviderSettings,
  OpenAICompatibleProviderSettings,
  OpenAIProviderSettings,
  OpenRouterProviderSettings,
  PerplexityProviderSettings,
  ProviderId,
  ProviderSettingsMap,
  QwenProviderSettings,
  ReplicateProviderSettings,
  TogetherAIProviderSettings,
  VercelProviderSettings,
  XaiProviderSettings,
  ZhipuProviderSettings
} from '../providers/registry'
