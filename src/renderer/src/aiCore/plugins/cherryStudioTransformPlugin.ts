/**
 * Cherry Studio 参数转换插件
 * 专门处理 Cherry Studio 特有的消息格式、文件处理、Assistant 设置等
 */

import { definePlugin } from '@cherrystudio/ai-core'
import type { Assistant, MCPTool, Message, Model } from '@renderer/types'

import {
  buildStreamTextParams,
  convertMessagesToSdkMessages,
  getCustomParameters,
  getTemperature,
  getTopP
} from '../transformParameters'

/**
 * Cherry Studio 核心转换插件
 * 负责将 Cherry Studio 的数据结构转换为 AI SDK 兼容格式
 */
export const cherryStudioTransformPlugin = definePlugin({
  name: 'cherry-studio-transform',

  /**
   * 转换请求参数
   * 将 Cherry Studio 的 Assistant + Messages 转换为 AI SDK 格式
   */
  transformParams: async (params: any, context) => {
    // 检查是否有 Cherry Studio 特有的数据结构
    const cherryData = context.metadata?.cherryStudio
    if (!cherryData) {
      return params // 不是 Cherry Studio 调用，直接返回
    }

    const { assistant, messages, mcpTools, enableTools } = cherryData

    try {
      // 1. 转换 Cherry Studio 消息为 AI SDK 消息
      const sdkMessages = await convertMessagesToSdkMessages(messages as Message[], assistant.model as Model)

      // 2. 构建完整的 AI SDK 参数
      const { params: transformedParams } = await buildStreamTextParams(sdkMessages, assistant as Assistant, {
        mcpTools: mcpTools as MCPTool[],
        enableTools,
        requestOptions: {
          signal: params.abortSignal,
          headers: params.headers
        }
      })

      // 3. 合并原始参数和转换后的参数
      return {
        ...params,
        ...transformedParams,
        // 保留原始的一些关键参数
        abortSignal: params.abortSignal,
        headers: params.headers
      }
    } catch (error) {
      console.error('Cherry Studio 参数转换失败:', error)
      return params // 转换失败时返回原始参数
    }
  }
})

/**
 * Cherry Studio Assistant 设置插件
 * 专门处理 Assistant 的温度、TopP、自定义参数等设置
 */
export const cherryStudioSettingsPlugin = definePlugin({
  name: 'cherry-studio-settings',

  transformParams: async (params: any, context) => {
    const cherryData = context.metadata?.cherryStudio
    if (!cherryData?.assistant) {
      return params
    }

    const { assistant } = cherryData
    const model = assistant.model as Model

    return {
      ...params,
      temperature: getTemperature(assistant as Assistant, model),
      topP: getTopP(assistant as Assistant, model),
      ...getCustomParameters(assistant as Assistant)
    }
  }
})

/**
 * 便捷函数：为 Cherry Studio 调用准备上下文元数据
 */
export function createCherryStudioContext(
  assistant: Assistant,
  messages: Message[],
  options: {
    mcpTools?: MCPTool[]
    enableTools?: boolean
  } = {}
) {
  return {
    cherryStudio: {
      assistant,
      messages,
      mcpTools: options.mcpTools,
      enableTools: options.enableTools
    }
  }
}
