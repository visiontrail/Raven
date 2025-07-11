import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'

import { ProviderOptionsMap } from '../../../options/types'

/**
 * 从 AI SDK 的工具函数中提取参数类型，以确保类型安全。
 */
type OpenAISearchConfig = Parameters<typeof openai.tools.webSearchPreview>[0]
type AnthropicSearchConfig = Parameters<typeof anthropic.tools.webSearch_20250305>[0]
/**
 * XAI 特有的搜索参数
 * @internal
 */
interface XaiProviderOptions {
  searchParameters?: {
    sources?: any[]
    safeSearch?: boolean
  }
}

/**
 * 插件初始化时接收的完整配置对象
 *
 * 其结构与 ProviderOptions 保持一致，方便上游统一管理配置
 */
export interface WebSearchPluginConfig {
  openai?: OpenAISearchConfig
  anthropic?: AnthropicSearchConfig
  xai?: ProviderOptionsMap['xai']['searchParameters']
  google?: Pick<ProviderOptionsMap['google'], 'useSearchGrounding' | 'dynamicRetrievalConfig'>
  'google-vertex'?: Pick<ProviderOptionsMap['google'], 'useSearchGrounding' | 'dynamicRetrievalConfig'>
}

/**
 * 插件的默认配置
 */
export const DEFAULT_WEB_SEARCH_CONFIG: WebSearchPluginConfig = {
  google: {
    useSearchGrounding: true
  },
  'google-vertex': {
    useSearchGrounding: true
  },
  openai: {},
  xai: {
    mode: 'on',
    returnCitations: true,
    maxSearchResults: 5,
    sources: [{ type: 'web' }, { type: 'x' }, { type: 'news' }]
  },
  anthropic: {
    maxUses: 5
  }
}

/**
 * 根据配置构建 Google 的 providerOptions
 */
export const getGoogleProviderOptions = (providerOptions: any) => {
  if (!providerOptions) providerOptions = {}
  if (!providerOptions.google) providerOptions.google = {}
  providerOptions.google.useSearchGrounding = true
  return providerOptions
}

/**
 * 根据配置构建 XAI 的 providerOptions
 */
export const getXaiProviderOptions = (providerOptions: any, config?: XaiProviderOptions['searchParameters']) => {
  if (!providerOptions) providerOptions = {}
  if (!providerOptions.xai) providerOptions.xai = {}
  providerOptions.xai.searchParameters = {
    mode: 'on',
    ...(config ?? {})
  }
  return providerOptions
}

export type AnthropicSearchInput = {
  query: string
}
export type AnthropicSearchOutput = {
  url: string
  title: string
  pageAge: string | null
  encryptedContent: string
  type: string
}[]
