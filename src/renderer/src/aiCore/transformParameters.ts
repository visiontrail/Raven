/**
 * AI SDK 参数转换模块
 * 统一管理从各个 apiClient 提取的参数处理和转换功能
 */

import type { StreamTextParams } from '@cherry-studio/ai-core'
import { isNotSupportTemperatureAndTopP, isSupportedFlexServiceTier } from '@renderer/config/models'
import type { Assistant, MCPTool, Message, Model } from '@renderer/types'
import { FileTypes } from '@renderer/types'
import { findFileBlocks, findImageBlocks, getMainTextContent } from '@renderer/utils/messageUtils/find'
import { buildSystemPrompt } from '@renderer/utils/prompt'
import { defaultTimeout } from '@shared/config/constant'

/**
 * 获取温度参数
 */
export function getTemperature(assistant: Assistant, model: Model): number | undefined {
  return isNotSupportTemperatureAndTopP(model) ? undefined : assistant.settings?.temperature
}

/**
 * 获取 TopP 参数
 */
export function getTopP(assistant: Assistant, model: Model): number | undefined {
  return isNotSupportTemperatureAndTopP(model) ? undefined : assistant.settings?.topP
}

/**
 * 获取超时设置
 */
export function getTimeout(model: Model): number {
  if (isSupportedFlexServiceTier(model)) {
    return 15 * 1000 * 60
  }
  return defaultTimeout
}

/**
 * 构建系统提示词
 */
export async function buildSystemPromptWithTools(
  prompt: string,
  mcpTools?: MCPTool[],
  assistant?: Assistant
): Promise<string> {
  return await buildSystemPrompt(prompt, mcpTools, assistant)
}

// /**
//  * 转换 MCP 工具为 AI SDK 工具格式
//  * 注意：这里返回通用格式，实际使用时需要根据具体 provider 转换
// TODO: 需要使用ai-sdk的mcp
//  */
// export function convertMcpToolsToSdkTools(mcpTools: MCPTool[]): Pick<StreamTextParams, 'tools'> {
//   return mcpTools.map((tool) => ({
//     type: 'function',
//     function: {
//       name: tool.id,
//       description: tool.description,
//       parameters: tool.inputSchema || {}
//     }
//   }))
// }

/**
 * 提取文件内容
 */
export async function extractFileContent(message: Message): Promise<string> {
  const fileBlocks = findFileBlocks(message)
  if (fileBlocks.length > 0) {
    const textFileBlocks = fileBlocks.filter(
      (fb) => fb.file && [FileTypes.TEXT, FileTypes.DOCUMENT].includes(fb.file.type)
    )

    if (textFileBlocks.length > 0) {
      let text = ''
      const divider = '\n\n---\n\n'

      for (const fileBlock of textFileBlocks) {
        const file = fileBlock.file
        const fileContent = (await window.api.file.read(file.id + file.ext)).trim()
        const fileNameRow = 'file: ' + file.origin_name + '\n\n'
        text = text + fileNameRow + fileContent + divider
      }

      return text
    }
  }

  return ''
}

/**
 * 转换消息为 AI SDK 参数格式
 * 基于 OpenAI 格式的通用转换，支持文本、图片和文件
 */
export async function convertMessageToSdkParam(message: Message, isVisionModel = false): Promise<any> {
  const content = getMainTextContent(message)
  const fileBlocks = findFileBlocks(message)
  const imageBlocks = findImageBlocks(message)

  // 简单消息（无文件无图片）
  if (fileBlocks.length === 0 && imageBlocks.length === 0) {
    return {
      role: message.role === 'system' ? 'user' : message.role,
      content
    }
  }

  // 复杂消息（包含文件或图片）
  const parts: any[] = []

  if (content) {
    parts.push({ type: 'text', text: content })
  }

  // 处理图片（仅在支持视觉的模型中）
  if (isVisionModel) {
    for (const imageBlock of imageBlocks) {
      if (imageBlock.file) {
        try {
          const image = await window.api.file.base64Image(imageBlock.file.id + imageBlock.file.ext)
          parts.push({
            type: 'image_url',
            image_url: { url: image.data }
          })
        } catch (error) {
          console.warn('Failed to load image:', error)
        }
      } else if (imageBlock.url && imageBlock.url.startsWith('data:')) {
        parts.push({
          type: 'image_url',
          image_url: { url: imageBlock.url }
        })
      }
    }
  }

  // 处理文件
  for (const fileBlock of fileBlocks) {
    const file = fileBlock.file
    if (!file) continue

    if ([FileTypes.TEXT, FileTypes.DOCUMENT].includes(file.type)) {
      try {
        const fileContent = await window.api.file.read(file.id + file.ext)
        parts.push({
          type: 'text',
          text: `${file.origin_name}\n${fileContent.trim()}`
        })
      } catch (error) {
        console.warn('Failed to read file:', error)
      }
    }
  }

  return {
    role: message.role === 'system' ? 'user' : message.role,
    content: parts.length === 1 && parts[0].type === 'text' ? parts[0].text : parts
  }
}

/**
 * 转换 Cherry Studio 消息数组为 AI SDK 消息数组
 */
export async function convertMessagesToSdkMessages(
  messages: Message[],
  model: Model
): Promise<StreamTextParams['messages']> {
  const sdkMessages: StreamTextParams['messages'] = []
  const isVision = model.id.includes('vision') || model.id.includes('gpt-4') // 简单的视觉模型检测

  for (const message of messages) {
    const sdkMessage = await convertMessageToSdkParam(message, isVision)
    sdkMessages.push(sdkMessage)
  }

  return sdkMessages
}

/**
 * 构建 AI SDK 流式参数
 * 这是主要的参数构建函数，整合所有转换逻辑
 */
export async function buildStreamTextParams(
  messages: Message[],
  assistant: Assistant,
  model: Model,
  options: {
    maxTokens?: number
    mcpTools?: MCPTool[]
    enableTools?: boolean
  } = {}
): Promise<StreamTextParams> {
  const { maxTokens, mcpTools, enableTools = false } = options

  // 转换消息
  const sdkMessages = await convertMessagesToSdkMessages(messages, model)

  // 构建系统提示
  let systemPrompt = assistant.prompt || ''
  if (mcpTools && mcpTools.length > 0) {
    systemPrompt = await buildSystemPromptWithTools(systemPrompt, mcpTools, assistant)
  }

  // 构建基础参数
  const params: StreamTextParams = {
    messages: sdkMessages,
    maxTokens: maxTokens || 1000,
    temperature: getTemperature(assistant, model),
    topP: getTopP(assistant, model),
    system: systemPrompt || undefined,
    ...getCustomParameters(assistant)
  }

  // 添加工具（如果启用且有工具）
  if (enableTools && mcpTools && mcpTools.length > 0) {
    // TODO: 暂时注释掉工具支持，等类型问题解决后再启用
    // params.tools = convertMcpToolsToSdkTools(mcpTools)
  }

  return params
}

/**
 * 构建非流式的 generateText 参数
 */
export async function buildGenerateTextParams(
  messages: Message[],
  assistant: Assistant,
  model: Model,
  options: {
    maxTokens?: number
    mcpTools?: MCPTool[]
    enableTools?: boolean
  } = {}
): Promise<any> {
  // 复用流式参数的构建逻辑
  return await buildStreamTextParams(messages, assistant, model, options)
}

/**
 * 获取自定义参数
 * 从 assistant 设置中提取自定义参数
 */
export function getCustomParameters(assistant: Assistant): Record<string, any> {
  return (
    assistant?.settings?.customParameters?.reduce((acc, param) => {
      if (!param.name?.trim()) {
        return acc
      }
      if (param.type === 'json') {
        const value = param.value as string
        if (value === 'undefined') {
          return { ...acc, [param.name]: undefined }
        }
        try {
          return { ...acc, [param.name]: JSON.parse(value) }
        } catch {
          return { ...acc, [param.name]: value }
        }
      }
      return {
        ...acc,
        [param.name]: param.value
      }
    }, {}) || {}
  )
}
