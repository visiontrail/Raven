/**
 * Cherry Studio AI Core Package
 * 基于 Vercel AI SDK 的统一 AI Provider 接口
 */

// 导入内部使用的类和函数
import { getSupportedProviders, isProviderSupported } from './core/providers/registry'
import type { ProviderId } from './core/providers/types'
import type { ProviderSettingsMap } from './core/providers/types'
import { createExecutor } from './core/runtime'

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

// ==================== 低级 API ====================
export { providerRegistry } from './core/providers/registry'

// ==================== 类型定义 ====================
export type { ProviderConfig } from './core/providers/types'
export type { ProviderError } from './core/providers/types'
export type {
  AnthropicProviderSettings,
  AzureOpenAIProviderSettings,
  DeepSeekProviderSettings,
  GenerateObjectParams,
  GenerateTextParams,
  GoogleGenerativeAIProviderSettings,
  OpenAICompatibleProviderSettings,
  OpenAIProviderSettings,
  ProviderId,
  ProviderSettings,
  ProviderSettingsMap,
  StreamObjectParams,
  StreamTextParams,
  XaiProviderSettings
} from './types'
export * as aiSdk from 'ai'

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

// ==================== Provider 初始化和管理 ====================
export {
  clearAllProviders,
  getImageModel,
  getInitializedProviders,
  // 访问功能
  getLanguageModel,
  getProviderInfo,
  getTextEmbeddingModel,
  hasInitializedProviders,
  // initializeImageProvider, // deprecated: 使用 initializeProvider 即可
  // 初始化功能
  initializeProvider,
  initializeProviders,
  isProviderInitialized,
  isProviderSupported,
  // 错误类型
  ProviderInitializationError,
  reinitializeProvider
} from './core/providers/registry'

// ==================== 动态Provider注册和别名映射 ====================
export {
  cleanup,
  getAllAliases,
  getAllDynamicMappings,
  getDynamicProviders,
  getProviderMapping,
  isAlias,
  isDynamicProvider,
  registerDynamicProvider,
  registerMultipleProviders,
  resolveProviderId
} from './core/providers/registry'

// ==================== Zod Schema 和验证 ====================
export { baseProviderIds, validateProviderId } from './core/providers'

// ==================== Hub Provider ====================
export { createHubProvider, type HubProviderConfig, HubProviderError } from './core/providers/HubProvider'

// ==================== Provider 配置工厂 ====================
export {
  type BaseProviderConfig,
  createProviderConfig,
  type ProviderConfigBuilder,
  providerConfigBuilder,
  ProviderConfigFactory
} from './core/providers/factory'

// ==================== 包信息 ====================
export const AI_CORE_VERSION = '1.0.0'
export const AI_CORE_NAME = '@cherrystudio/ai-core'

// ==================== 便捷 API ====================
// 主要的便捷工厂类
export const AiCore = {
  version: AI_CORE_VERSION,
  name: AI_CORE_NAME,

  // 创建主要执行器（推荐使用）
  create(providerId: ProviderId, options: ProviderSettingsMap[ProviderId], plugins: any[] = []) {
    return createExecutor(providerId, options, plugins)
  },

  // 获取支持的providers
  getSupportedProviders() {
    return getSupportedProviders()
  },

  isSupported(providerId: ProviderId) {
    return isProviderSupported(providerId)
  }
}

// 推荐使用的执行器创建函数
export const createOpenAIExecutor = (options: ProviderSettingsMap['openai'], plugins?: any[]) => {
  return createExecutor('openai', options, plugins)
}

export const createAnthropicExecutor = (options: ProviderSettingsMap['anthropic'], plugins?: any[]) => {
  return createExecutor('anthropic', options, plugins)
}

export const createGoogleExecutor = (options: ProviderSettingsMap['google'], plugins?: any[]) => {
  return createExecutor('google', options, plugins)
}

export const createXAIExecutor = (options: ProviderSettingsMap['xai'], plugins?: any[]) => {
  return createExecutor('xai', options, plugins)
}

// ==================== 调试和开发工具 ====================
export const DevTools = {
  // 列出所有支持的providers
  listProviders() {
    return getSupportedProviders()
  },

  // 获取provider详细信息
  getProviderDetails() {
    const supportedProviders = getSupportedProviders()

    return {
      supportedProviders: supportedProviders.length,
      providers: supportedProviders.map((p) => ({
        id: p.id,
        name: p.name
      }))
    }
  }
}
