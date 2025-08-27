/**
 * Cherry Studio AI Core Package
 * 基于 Vercel AI SDK 的统一 AI Provider 接口
 */

// 导入内部使用的类和函数

// ==================== 主要用户接口 ====================
export {
  createExecutor,
  createOpenAICompatibleExecutor,
  generateImage,
  generateObject,
  generateText,
  streamText
} from './core/runtime'

// ==================== 高级API ====================
export { globalModelResolver as modelResolver } from './core/models'

// ==================== 插件系统 ====================
export type { AiPlugin, AiRequestContext, HookResult, PluginManagerConfig } from './core/plugins'
export { createContext, definePlugin, PluginManager } from './core/plugins'
// export { createPromptToolUsePlugin, webSearchPlugin } from './core/plugins/built-in'
export { PluginEngine } from './core/runtime/pluginEngine'

// ==================== 类型定义 ====================
export type { GenerateObjectParams, GenerateTextParams, StreamObjectParams, StreamTextParams } from './types'

// ==================== AI SDK 常用类型导出 ====================
// 直接导出 AI SDK 的常用类型，方便使用
export type { LanguageModelV2Middleware, LanguageModelV2StreamPart } from '@ai-sdk/provider'
export type { ToolCall } from '@ai-sdk/provider-utils'
export type { ReasoningPart } from '@ai-sdk/provider-utils'
export type {
  AssistantModelMessage,
  FilePart,
  // 通用类型
  FinishReason,
  GenerateObjectResult,
  // 生成相关类型
  GenerateTextResult,
  ImagePart,
  InferToolInput,
  InferToolOutput,
  InvalidToolInputError,
  LanguageModelUsage, // AI SDK 4.0 中 TokenUsage 改名为 LanguageModelUsage
  // 消息相关类型
  ModelMessage,
  // 错误类型
  NoSuchToolError,
  ProviderMetadata,
  StreamTextResult,
  SystemModelMessage,
  TextPart,
  // 流相关类型
  TextStreamPart,
  // 工具相关类型
  Tool,
  ToolCallPart,
  ToolModelMessage,
  ToolResultPart,
  ToolSet,
  TypedToolCall,
  TypedToolError,
  TypedToolResult,
  UserModelMessage
} from 'ai'
export {
  defaultSettingsMiddleware,
  extractReasoningMiddleware,
  simulateStreamingMiddleware,
  smoothStream,
  stepCountIs
} from 'ai'
// 重新导出 Agent
export { Experimental_Agent as Agent } from 'ai'

// ==================== 选项 ====================
export {
  createAnthropicOptions,
  createGoogleOptions,
  createOpenAIOptions,
  type ExtractProviderOptions,
  mergeProviderOptions,
  type ProviderOptionsMap,
  type TypedProviderOptions
} from './core/options'

// ==================== 包信息 ====================
export const AI_CORE_VERSION = '1.0.0'
export const AI_CORE_NAME = '@cherrystudio/ai-core'
