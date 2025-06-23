/**
 * Cherry Studio AI Core Package
 * 基于 Vercel AI SDK 的统一 AI Provider 接口
 */

// 导入内部使用的类和函数
import { createClient } from './core/clients/PluginEnabledAiClient'
import {
  getProviderInfo as factoryGetProviderInfo,
  getSupportedProviders as factoryGetSupportedProviders
} from './core/creation'
import { AiExecutor } from './core/execution/AiExecutor'
import { aiProviderRegistry, isProviderSupported } from './core/providers/registry'
import { type ProviderSettingsMap } from './types'

// ==================== 主要用户接口 ====================
// orchestration层 - 面向用户的主要API
export {
  AiExecutor,
  generateObject,
  generateText,
  type OrchestrationConfig,
  streamObject,
  streamText
} from './orchestration'

// 为了向后兼容，保留AiClient别名（内部使用PluginEnabledAiClient）
export {
  PluginEnabledAiClient as AiClient,
  createClient,
  createCompatibleClient
} from './core/clients/PluginEnabledAiClient'

// ==================== 插件系统 ====================
export type { AiPlugin, AiRequestContext, HookResult, HookType, PluginManagerConfig } from './core/plugins'
export { createContext, definePlugin, PluginManager } from './core/plugins'

// ==================== 低级 API ====================
export {
  createBaseModel as createApiClient,
  createImageModel,
  getProviderInfo as getClientInfo,
  getSupportedProviders,
  ProviderCreationError
} from './core/creation'
export { aiProviderRegistry } from './core/providers/registry'

// ==================== 类型定义 ====================
export type { ProviderConfig } from './core/providers/registry'
export type { ProviderError } from './core/providers/types'
export type {
  GenerateObjectParams,
  GenerateTextParams,
  ProviderSettings,
  StreamObjectParams,
  StreamTextParams
} from './types'
export * as aiSdk from 'ai'

// ==================== AI SDK 常用类型导出 ====================
// 直接导出 AI SDK 的常用类型，方便使用
export type {
  CoreAssistantMessage,
  // 消息相关类型
  CoreMessage,
  CoreSystemMessage,
  CoreToolMessage,
  CoreUserMessage,
  // 通用类型
  FinishReason,
  GenerateObjectResult,
  // 生成相关类型
  GenerateTextResult,
  InvalidToolArgumentsError,
  LanguageModelUsage, // AI SDK 4.0 中 TokenUsage 改名为 LanguageModelUsage
  LanguageModelV1Middleware,
  LanguageModelV1StreamPart,
  // 错误类型
  NoSuchToolError,
  StreamTextResult,
  // 流相关类型
  TextStreamPart,
  // 工具相关类型
  Tool,
  ToolCall,
  ToolExecutionError,
  ToolResult
} from 'ai'
export { defaultSettingsMiddleware, extractReasoningMiddleware, simulateStreamingMiddleware, smoothStream } from 'ai'

// 重新导出所有 Provider Settings 类型
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
} from './types'

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

// ==================== 工具函数 ====================
export { getAllProviders, getProvider, isProviderSupported, registerProvider } from './core/providers/registry'

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
  create(providerId: string, plugins: any[] = []) {
    return AiExecutor.create(providerId, plugins)
  },

  // 创建底层客户端（高级用法）
  createClient(providerId: string, plugins: any[] = []) {
    return createClient(providerId, plugins)
  },

  // 获取支持的providers
  getSupportedProviders() {
    return factoryGetSupportedProviders()
  },

  // 检查provider支持
  isSupported(providerId: string) {
    return isProviderSupported(providerId)
  },

  // 获取客户端信息
  getClientInfo(providerId: string) {
    return factoryGetProviderInfo(providerId)
  }
}

// 推荐使用的执行器创建函数
export const createOpenAIExecutor = (options: ProviderSettingsMap['openai'], plugins?: any[]) => {
  return AiExecutor.create('openai', plugins)
}

export const createAnthropicExecutor = (options: ProviderSettingsMap['anthropic'], plugins?: any[]) => {
  return AiExecutor.create('anthropic', plugins)
}

export const createGoogleExecutor = (options: ProviderSettingsMap['google'], plugins?: any[]) => {
  return AiExecutor.create('google', plugins)
}

export const createXAIExecutor = (options: ProviderSettingsMap['xai'], plugins?: any[]) => {
  return AiExecutor.create('xai', plugins)
}

// 向后兼容的客户端创建函数
export const createOpenAIClient = (options: ProviderSettingsMap['openai'], plugins?: any[]) => {
  return createClient('openai', plugins)
}

export const createAnthropicClient = (options: ProviderSettingsMap['anthropic'], plugins?: any[]) => {
  return createClient('anthropic', plugins)
}

export const createGoogleClient = (options: ProviderSettingsMap['google'], plugins?: any[]) => {
  return createClient('google', plugins)
}

export const createXAIClient = (options: ProviderSettingsMap['xai'], plugins?: any[]) => {
  return createClient('xai', plugins)
}

// ==================== 调试和开发工具 ====================
export const DevTools = {
  // 列出所有注册的providers
  listProviders() {
    return aiProviderRegistry.getAllProviders().map((p) => ({
      id: p.id,
      name: p.name
    }))
  },

  // 测试provider连接
  async testProvider(providerId: string, options: any) {
    try {
      const client = createClient(providerId, options)
      const info = client.getClientInfo()
      return {
        success: true,
        providerId: info.id,
        name: info.name,
        isSupported: info.isSupported
      }
    } catch (error) {
      return {
        success: false,
        providerId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  },

  // 获取provider详细信息
  getProviderDetails() {
    const providers = aiProviderRegistry.getAllProviders()

    return {
      supportedProviders: providers.length,
      registeredProviders: providers.length,
      providers: providers.map((p) => ({
        id: p.id,
        name: p.name
      }))
    }
  }
}
