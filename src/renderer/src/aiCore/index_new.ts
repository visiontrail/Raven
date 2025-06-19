/**
 * Cherry Studio AI Core - 新版本入口
 * 集成 @cherry-studio/ai-core 库的渐进式重构方案
 *
 * 融合方案：简化实现，专注于核心功能
 * 1. 优先使用新AI SDK
 * 2. 失败时fallback到原有实现
 * 3. 暂时保持接口兼容性
 */

import {
  AiClient,
  AiCore,
  createClient,
  type OpenAICompatibleProviderSettings,
  type ProviderId
} from '@cherry-studio/ai-core'
import { isDedicatedImageGenerationModel } from '@renderer/config/models'
import type { GenerateImageParams, Model, Provider } from '@renderer/types'
import { Chunk, ChunkType } from '@renderer/types/chunk'
import { RequestOptions } from '@renderer/types/sdk'

// 引入适配器
import AiSdkToChunkAdapter from './AiSdkToChunkAdapter'
// 引入原有的AiProvider作为fallback
import LegacyAiProvider from './index'
import { CompletionsParams, CompletionsResult } from './middleware/schemas'
// 引入参数转换模块
import { buildStreamTextParams } from './transformParameters'

/**
 * 将现有 Provider 类型映射到 AI SDK 的 Provider ID
 * 根据 registry.ts 中的支持列表进行映射
 */
function mapProviderTypeToAiSdkId(providerType: string): string {
  // Cherry Studio Provider Type -> AI SDK Provider ID 映射表
  const typeMapping: Record<string, string> = {
    // 需要转换的映射
    grok: 'xai', // grok -> xai
    'azure-openai': 'azure', // azure-openai -> azure
    gemini: 'google' // gemini -> google
  }

  return typeMapping[providerType]
}

/**
 * 将 Provider 配置转换为新 AI SDK 格式
 */
function providerToAiSdkConfig(provider: Provider): {
  providerId: ProviderId | 'openai-compatible'
  options: any
} {
  console.log('provider', provider)
  // 1. 先映射 provider 类型到 AI SDK ID
  const mappedProviderId = mapProviderTypeToAiSdkId(provider.id)

  // 2. 检查映射后的 provider ID 是否在 AI SDK 注册表中
  const isSupported = AiCore.isSupported(mappedProviderId)

  console.log(`Provider mapping: ${provider.type} -> ${mappedProviderId}, supported: ${isSupported}`)

  // 3. 如果映射的 provider 不支持，则使用 openai-compatible
  if (isSupported) {
    return {
      providerId: mappedProviderId as ProviderId,
      options: {
        apiKey: provider.apiKey
      }
    }
  } else {
    console.log(`Using openai-compatible fallback for provider: ${provider.type}`)
    const compatibleConfig: OpenAICompatibleProviderSettings = {
      name: provider.name || provider.type,
      apiKey: provider.apiKey,
      baseURL: provider.apiHost
    }

    return {
      providerId: 'openai-compatible',
      options: compatibleConfig
    }
  }
}

/**
 * 检查是否支持使用新的AI SDK
 */
function isModernSdkSupported(provider: Provider, model?: Model): boolean {
  // 目前支持主要的providers
  const supportedProviders = ['openai', 'anthropic', 'gemini', 'azure-openai']

  // 检查provider类型
  if (!supportedProviders.includes(provider.type)) {
    return false
  }

  // 检查是否为图像生成模型（暂时不支持）
  if (model && isDedicatedImageGenerationModel(model)) {
    return false
  }

  return true
}

export default class ModernAiProvider {
  private modernClient?: AiClient
  private legacyProvider: LegacyAiProvider
  private provider: Provider

  constructor(provider: Provider) {
    this.provider = provider
    this.legacyProvider = new LegacyAiProvider(provider)

    const config = providerToAiSdkConfig(provider)
    this.modernClient = createClient(config.providerId, config.options)
  }

  public async completions(params: CompletionsParams, options?: RequestOptions): Promise<CompletionsResult> {
    // const model = params.assistant.model

    // 检查是否应该使用现代化客户端
    // if (this.modernClient && model && isModernSdkSupported(this.provider, model)) {
    // try {
    return await this.modernCompletions(params, options)
    // } catch (error) {
    // console.warn('Modern client failed, falling back to legacy:', error)
    // fallback到原有实现
    // }
    // }

    // 使用原有实现
    // return this.legacyProvider.completions(params, options)
  }

  /**
   * 使用现代化AI SDK的completions实现
   * 使用 AiSdkUtils 工具模块进行参数构建
   */
  private async modernCompletions(params: CompletionsParams, options?: RequestOptions): Promise<CompletionsResult> {
    if (!this.modernClient || !params.assistant.model) {
      throw new Error('Modern client not available')
    }

    console.log('Modern completions with params:', params, 'options:', options)

    const model = params.assistant.model
    const assistant = params.assistant

    // 检查 messages 类型并转换
    const messages = Array.isArray(params.messages) ? params.messages : []
    if (typeof params.messages === 'string') {
      console.warn('Messages is string, using empty array')
    }

    // 使用 transformParameters 模块构建参数
    const aiSdkParams = await buildStreamTextParams(messages, assistant, model, {
      maxTokens: params.maxTokens,
      mcpTools: params.mcpTools
    })

    console.log('Built AI SDK params:', aiSdkParams)
    const chunks: Chunk[] = []

    try {
      if (params.streamOutput && params.onChunk) {
        // 流式处理 - 使用适配器
        const adapter = new AiSdkToChunkAdapter(params.onChunk)
        const streamResult = await this.modernClient.streamText(model.id, aiSdkParams)
        const finalText = await adapter.processStream(streamResult)

        return {
          getText: () => finalText
        }
      } else if (params.streamOutput) {
        // 流式处理但没有 onChunk 回调
        const streamResult = await this.modernClient.streamText(model.id, aiSdkParams)
        const finalText = await streamResult.text

        return {
          getText: () => finalText
        }
      } else {
        // 非流式处理
        const result = await this.modernClient.generateText(model.id, aiSdkParams)

        const cherryChunk: Chunk = {
          type: ChunkType.TEXT_COMPLETE,
          text: result.text || ''
        }
        chunks.push(cherryChunk)

        if (params.onChunk) {
          params.onChunk(cherryChunk)
        }

        return {
          getText: () => result.text || ''
        }
      }
    } catch (error) {
      console.error('Modern AI SDK error:', error)
      throw error
    }
  }

  // 代理其他方法到原有实现
  public async models() {
    return this.legacyProvider.models()
  }

  public async getEmbeddingDimensions(model: Model): Promise<number> {
    return this.legacyProvider.getEmbeddingDimensions(model)
  }

  public async generateImage(params: GenerateImageParams): Promise<string[]> {
    return this.legacyProvider.generateImage(params)
  }

  public getBaseURL(): string {
    return this.legacyProvider.getBaseURL()
  }

  public getApiKey(): string {
    return this.legacyProvider.getApiKey()
  }
}

// 为了方便调试，导出一些工具函数
export { isModernSdkSupported, providerToAiSdkConfig }
