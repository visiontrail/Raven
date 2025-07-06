/**
 * Web Search Plugin
 * 提供统一的网络搜索能力，支持多个 AI Provider
 */

import { definePlugin } from '../../'
import type { AiRequestContext } from '../../types'
import { adaptWebSearchForProvider, type WebSearchConfig } from './helper'

/**
 * 网络搜索插件
 *
 * 此插件会检查 params.providerOptions.[providerId].webSearch 来激活。
 * options.ts 文件负责将高层级的设置（如 assistant.enableWebSearch）
 * 转换为 providerOptions 中的 webSearch: { enabled: true } 配置。
 */
export const webSearchPlugin = () =>
  definePlugin({
    name: 'webSearch',
    enforce: 'pre',

    // configureModel: async (modelConfig: any, context: AiRequestContext) => {
    //   if (context.providerId === 'google') {
    //     return {
    //       ...modelConfig
    //     }
    //   }
    //   return null
    // },

    transformParams: async (params: any, context: AiRequestContext) => {
      const { providerId } = context

      // 从 providerOptions 中提取 webSearch 配置
      const webSearchConfig = params.providerOptions?.[providerId]?.webSearch

      // 检查是否启用了网络搜索 (enabled: false 可用于显式禁用)
      if (!webSearchConfig || (typeof webSearchConfig === 'object' && webSearchConfig.enabled === false)) {
        return params
      }
      console.log('webSearchConfig', webSearchConfig)
      // // 检查当前 provider 是否支持网络搜索
      // if (!isWebSearchSupported(providerId)) {
      //   // 对于不支持的 provider，只记录警告，不修改参数
      //   console.warn(
      //     `[webSearchPlugin] Provider '${providerId}' does not support web search. Ignoring webSearch parameter.`
      //   )
      //   return params
      // }

      // 使用适配器函数处理网络搜索
      const adaptedParams = adaptWebSearchForProvider(params, providerId, webSearchConfig as WebSearchConfig | boolean)
      // 清理原始的 webSearch 配置
      if (adaptedParams.providerOptions?.[providerId]) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { webSearch, ...rest } = adaptedParams.providerOptions[providerId]
        adaptedParams.providerOptions[providerId] = rest
      }
      return adaptedParams
    }
  })

// 导出类型定义供开发者使用
export type { WebSearchConfig } from './helper'

// 默认导出
export default webSearchPlugin
