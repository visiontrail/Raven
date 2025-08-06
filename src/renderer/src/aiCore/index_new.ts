/**
 * Cherry Studio AI Core - 新版本入口
 * 集成 @cherrystudio/ai-core 库的渐进式重构方案
 *
 * 融合方案：简化实现，专注于核心功能
 * 1. 优先使用新AI SDK
 * 2. 失败时fallback到原有实现
 * 3. 暂时保持接口兼容性
 */

import { createExecutor, generateImage, StreamTextParams } from '@cherrystudio/ai-core'
import { isNotSupportedImageSizeModel } from '@renderer/config/models'
import type { GenerateImageParams, Model, Provider } from '@renderer/types'
import { ChunkType } from '@renderer/types/chunk'

import AiSdkToChunkAdapter from './chunk/AiSdkToChunkAdapter'
import LegacyAiProvider from './legacy/index'
import { CompletionsResult } from './legacy/middleware/schemas'
import { AiSdkMiddlewareConfig, buildAiSdkMiddlewares } from './middleware/AiSdkMiddlewareBuilder'
import { buildPlugins } from './plugins/PluginBuilder'
import { getActualProvider, isModernSdkSupported, providerToAiSdkConfig } from './provider/ProviderConfigProcessor'

export default class ModernAiProvider {
  private legacyProvider: LegacyAiProvider
  private config: ReturnType<typeof providerToAiSdkConfig>
  private actualProvider: Provider

  constructor(model: Model) {
    this.actualProvider = getActualProvider(model)
    this.legacyProvider = new LegacyAiProvider(this.actualProvider)

    // 只保存配置，不预先创建executor
    this.config = providerToAiSdkConfig(this.actualProvider)
  }

  public getActualProvider() {
    return this.actualProvider
  }

  public async completions(
    modelId: string,
    params: StreamTextParams,
    middlewareConfig: AiSdkMiddlewareConfig
  ): Promise<CompletionsResult> {
    console.log('completions', modelId, params, middlewareConfig)

    if (middlewareConfig.isImageGenerationEndpoint) {
      return await this.modernImageGeneration(modelId, params, middlewareConfig)
    }

    return await this.modernCompletions(modelId, params, middlewareConfig)
  }

  /**
   * 使用现代化AI SDK的completions实现
   */
  private async modernCompletions(
    modelId: string,
    params: StreamTextParams,
    middlewareConfig: AiSdkMiddlewareConfig
  ): Promise<CompletionsResult> {
    // try {
    // 根据条件构建插件数组
    const plugins = buildPlugins(middlewareConfig)
    console.log('this.config.providerId', this.config.providerId)
    console.log('this.config.options', this.config.options)
    console.log('plugins', plugins)
    // 用构建好的插件数组创建executor
    const executor = createExecutor(this.config.providerId, this.config.options, plugins)

    // 动态构建中间件数组
    const middlewares = buildAiSdkMiddlewares(middlewareConfig)
    // console.log('构建的中间件:', middlewares)

    // 创建带有中间件的执行器
    if (middlewareConfig.onChunk) {
      // 流式处理 - 使用适配器
      const adapter = new AiSdkToChunkAdapter(middlewareConfig.onChunk, middlewareConfig.mcpTools)
      console.log('最终params', params)
      const streamResult = await executor.streamText(
        modelId,
        params,
        middlewares.length > 0 ? { middlewares } : undefined
      )

      const finalText = await adapter.processStream(streamResult)

      return {
        getText: () => finalText
      }
    } else {
      // 流式处理但没有 onChunk 回调
      const streamResult = await executor.streamText(
        modelId,
        params,
        middlewares.length > 0 ? { middlewares } : undefined
      )
      const finalText = await streamResult.text

      return {
        getText: () => finalText
      }
    }
    // }
    // catch (error) {
    //   console.error('Modern AI SDK error:', error)
    //   throw error
    // }
  }

  /**
   * 使用现代化 AI SDK 的图像生成实现，支持流式输出
   */
  private async modernImageGeneration(
    modelId: string,
    params: StreamTextParams,
    middlewareConfig: AiSdkMiddlewareConfig
  ): Promise<CompletionsResult> {
    const { onChunk } = middlewareConfig

    try {
      // 检查 messages 是否存在
      if (!params.messages || params.messages.length === 0) {
        throw new Error('No messages provided for image generation.')
      }

      // 从最后一条用户消息中提取 prompt
      const lastUserMessage = params.messages.findLast((m) => m.role === 'user')
      if (!lastUserMessage) {
        throw new Error('No user message found for image generation.')
      }

      // 直接使用消息内容，避免类型转换问题
      const prompt =
        typeof lastUserMessage.content === 'string'
          ? lastUserMessage.content
          : lastUserMessage.content?.map((part) => ('text' in part ? part.text : '')).join('') || ''

      if (!prompt) {
        throw new Error('No prompt found in user message.')
      }

      const startTime = Date.now()

      // 发送图像生成开始事件
      if (onChunk) {
        onChunk({ type: ChunkType.IMAGE_CREATED })
      }

      // 构建图像生成参数
      const imageParams = {
        prompt,
        size: isNotSupportedImageSizeModel(middlewareConfig.model) ? undefined : ('1024x1024' as `${number}x${number}`), // 默认尺寸，使用正确的类型
        n: 1,
        ...(params.abortSignal && { abortSignal: params.abortSignal })
      }

      // 调用新 AI SDK 的图像生成功能
      const result = await generateImage(this.config.providerId, this.config.options, modelId, imageParams)

      // 转换结果格式
      const images: string[] = []
      const imageType: 'url' | 'base64' = 'base64'

      if (result.images) {
        for (const image of result.images) {
          if ('base64' in image && image.base64) {
            images.push(`data:${image.mediaType};base64,${image.base64}`)
          }
        }
      }

      // 发送图像生成完成事件
      if (onChunk && images.length > 0) {
        onChunk({
          type: ChunkType.IMAGE_COMPLETE,
          image: { type: imageType, images }
        })
      }

      // 发送块完成事件（类似于 modernCompletions 的处理）
      if (onChunk) {
        const usage = {
          prompt_tokens: prompt.length, // 估算的 token 数量
          completion_tokens: 0, // 图像生成没有 completion tokens
          total_tokens: prompt.length
        }

        onChunk({
          type: ChunkType.BLOCK_COMPLETE,
          response: {
            usage,
            metrics: {
              completion_tokens: usage.completion_tokens,
              time_first_token_millsec: 0,
              time_completion_millsec: Date.now() - startTime
            }
          }
        })

        // 发送 LLM 响应完成事件
        onChunk({
          type: ChunkType.LLM_RESPONSE_COMPLETE,
          response: {
            usage,
            metrics: {
              completion_tokens: usage.completion_tokens,
              time_first_token_millsec: 0,
              time_completion_millsec: Date.now() - startTime
            }
          }
        })
      }

      return {
        getText: () => '' // 图像生成不返回文本
      }
    } catch (error) {
      // 发送错误事件
      if (onChunk) {
        onChunk({ type: ChunkType.ERROR, error: error as any })
      }
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
    // 如果支持新的 AI SDK，使用现代化实现
    if (isModernSdkSupported(this.actualProvider)) {
      try {
        const result = await this.modernGenerateImage(params)
        return result
      } catch (error) {
        console.warn('Modern AI SDK generateImage failed, falling back to legacy:', error)
        // fallback 到传统实现
        return this.legacyProvider.generateImage(params)
      }
    }

    // 直接使用传统实现
    return this.legacyProvider.generateImage(params)
  }

  /**
   * 使用现代化 AI SDK 的图像生成实现
   */
  private async modernGenerateImage(params: GenerateImageParams): Promise<string[]> {
    const { model, prompt, imageSize, batchSize, signal } = params

    // 转换参数格式
    const aiSdkParams = {
      prompt,
      size: (imageSize || '1024x1024') as `${number}x${number}`,
      n: batchSize || 1,
      ...(signal && { abortSignal: signal })
    }

    const result = await generateImage(this.config.providerId, this.config.options, model, aiSdkParams)

    // 转换结果格式
    const images: string[] = []
    if (result.images) {
      for (const image of result.images) {
        if ('base64' in image && image.base64) {
          images.push(`data:image/png;base64,${image.base64}`)
        }
      }
    }

    return images
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
