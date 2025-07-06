/**
 * 网络搜索助手函数
 * 提取各个 ApiClient 中的网络搜索逻辑，提供统一的适配器
 */
import type { OpenAIProvider } from '@ai-sdk/openai'

import { ProviderId } from '../../../../types'

// 派生自 OpenAI SDK 的标准工具入参类型
type WebSearchPreviewParams = Parameters<OpenAIProvider['tools']['webSearchPreview']>[0]

// 使用交叉类型合并，并为 extra 添加注释
export type WebSearchConfig = WebSearchPreviewParams & {
  /**
   * 扩展字段，用于提供给开发者自定义参数的能力
   * 这些参数将被合并到对应 provider 的 providerOptions 中
   */
  extra?: Record<string, any>
}

/**
 * 适配 OpenAI 网络搜索
 * 基于 Vercel AI SDK 的 web_search_preview 工具
 */
export function adaptOpenAIWebSearch(params: any, webSearchConfig: WebSearchConfig | boolean): any {
  const config = typeof webSearchConfig === 'boolean' ? {} : webSearchConfig
  const { extra, ...stdParams } = config

  const webSearchTool = {
    type: 'web_search_preview',
    ...stdParams
  }

  // 假设 params.tools 是一个数组或 undefined
  const existingTools = Array.isArray(params.tools) ? params.tools : []

  // 将 extra 参数添加到 providerOptions 中
  const providerOptions = {
    ...params.providerOptions,
    openai: {
      ...params.providerOptions?.openai,
      ...(extra || {})
    }
  }

  return {
    ...params,
    tools: [...existingTools, webSearchTool],
    providerOptions
  }
}

/**
 *
 * 适配 Gemini 网络搜索
 * 将 googleSearch 工具放入 providerOptions.google.tools
 */
// export function adaptGeminiWebSearch(params: any, webSearchConfig: WebSearchConfig | boolean): any {
//   const config = typeof webSearchConfig === 'boolean' ? {} : webSearchConfig
//   const googleSearchTool = { googleSearch: {} }

//   const existingTools = Array.isArray(params.providerOptions?.google?.tools) ? params.providerOptions.google.tools : []

//   return {
//     ...params,
//     providerOptions: {
//       ...params.providerOptions,
//       google: {
//         ...params.providerOptions?.google,
//         useSearchGrounding: true,
//         // tools: [...existingTools, googleSearchTool],
//         ...(config.extra || {})
//       }
//     }
//   }
// }

/**
 * 适配 Anthropic 网络搜索
 * 将 web_search_20250305 工具放入 providerOptions.anthropic.tools
 */
export function adaptAnthropicWebSearch(params: any, webSearchConfig: WebSearchConfig | boolean): any {
  const config = typeof webSearchConfig === 'boolean' ? {} : webSearchConfig
  const webSearchTool = {
    type: 'web_search_20250305',
    name: 'web_search',
    max_uses: 5 // 默认值，可以通过 extra 覆盖
  }

  const existingTools = Array.isArray(params.providerOptions?.anthropic?.tools)
    ? params.providerOptions.anthropic.tools
    : []

  return {
    ...params,
    providerOptions: {
      ...params.providerOptions,
      anthropic: {
        ...params.providerOptions?.anthropic,
        tools: [...existingTools, webSearchTool],
        ...(config.extra || {})
      }
    }
  }
}

/**
 * 通用网络搜索适配器
 * 根据 providerId 选择对应的适配函数
 */
export function adaptWebSearchForProvider(
  params: any,
  providerId: ProviderId,
  webSearchConfig: WebSearchConfig | boolean
): any {
  switch (providerId) {
    case 'openai':
      return adaptOpenAIWebSearch(params, webSearchConfig)

    // google的需要通过插件，在创建model的时候传入参数
    // case 'google':
    // case 'google-vertex':
    //   return adaptGeminiWebSearch(params, webSearchConfig)

    case 'anthropic':
      return adaptAnthropicWebSearch(params, webSearchConfig)

    default:
      // 不支持的 provider，保持原样
      return params
  }
}
