/**
 * API Client Factory
 * 整合现有实现的改进版API客户端工厂
 */

import type { ImageModelV1 } from '@ai-sdk/provider'
import { type LanguageModelV1, wrapLanguageModel } from 'ai'

import { aiProviderRegistry } from '../providers/registry'

// 客户端配置接口
export interface ClientConfig {
  providerId: string
  options?: ProviderOptions
}

// 错误类型
export class ClientFactoryError extends Error {
  constructor(
    message: string,
    public providerId?: string,
    public cause?: Error
  ) {
    super(message)
    this.name = 'ClientFactoryError'
  }
}

/**
 * API Client Factory
 * 统一管理和创建AI SDK客户端
 */
export class ApiClientFactory {
  /**
   * 创建 AI SDK 模型实例
   * 直接返回 LanguageModelV1 实例用于 streamText/generateText
   */
  static async createClient(
    providerId: string,
    modelId: string = 'default',
    options: any = {}
  ): Promise<LanguageModelV1> {
    try {
      // 验证provider是否支持
      if (!aiProviderRegistry.isSupported(providerId)) {
        throw new ClientFactoryError(`Provider "${providerId}" is not supported`, providerId)
      }

      // 获取Provider配置
      const providerConfig = aiProviderRegistry.getProvider(providerId)
      if (!providerConfig) {
        throw new ClientFactoryError(`Provider "${providerId}" is not registered`, providerId)
      }

      // 动态导入模块
      const module = await providerConfig.import()

      // 获取创建函数
      const creatorFunction = module[providerConfig.creatorFunctionName]

      if (typeof creatorFunction !== 'function') {
        throw new ClientFactoryError(
          `Creator function "${providerConfig.creatorFunctionName}" not found in the imported module for provider "${providerId}"`
        )
      }

      // 创建provider实例
      const provider = creatorFunction(options)

      // 返回模型实例
      if (typeof provider === 'function') {
        let model = provider(modelId)

        // 应用 AI SDK 中间件
        if (providerConfig.aiSdkMiddlewares) {
          model = wrapLanguageModel({
            model: model,
            middleware: providerConfig.aiSdkMiddlewares
          })
        }

        return model
      } else {
        throw new ClientFactoryError(`Unknown model access pattern for provider "${providerId}"`)
      }
    } catch (error) {
      if (error instanceof ClientFactoryError) {
        throw error
      }
      throw new ClientFactoryError(
        `Failed to create client for provider "${providerId}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        providerId,
        error instanceof Error ? error : undefined
      )
    }
  }

  static async createImageClient(
    providerId: string,
    modelId: string = 'default',
    options: ProviderOptions
  ): Promise<ImageModelV1> {
    try {
      if (!aiProviderRegistry.isSupported(providerId)) {
        throw new ClientFactoryError(`Provider "${providerId}" is not supported`, providerId)
      }

      const providerConfig = aiProviderRegistry.getProvider(providerId)
      if (!providerConfig) {
        throw new ClientFactoryError(`Provider "${providerId}" is not registered`, providerId)
      }

      if (!providerConfig.supportsImageGeneration) {
        throw new ClientFactoryError(`Provider "${providerId}" does not support image generation`, providerId)
      }

      const module = await providerConfig.import()

      const creatorFunction = module[providerConfig.creatorFunctionName]

      if (typeof creatorFunction !== 'function') {
        throw new ClientFactoryError(
          `Creator function "${providerConfig.creatorFunctionName}" not found in the imported module for provider "${providerId}"`
        )
      }

      const provider = creatorFunction(options)

      if (provider && typeof provider.image === 'function') {
        return provider.image(modelId)
      } else {
        throw new ClientFactoryError(`Image model function not found for provider "${providerId}"`)
      }
    } catch (error) {
      if (error instanceof ClientFactoryError) {
        throw error
      }
      throw new ClientFactoryError(
        `Failed to create image client for provider "${providerId}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        providerId,
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * 获取支持的 Providers 列表
   */
  static getSupportedProviders(): Array<{
    id: string
    name: string
  }> {
    return aiProviderRegistry.getAllProviders().map((provider) => ({
      id: provider.id,
      name: provider.name
    }))
  }

  /**
   * 获取 Provider 信息
   */
  static getClientInfo(providerId: string): {
    id: string
    name: string
    isSupported: boolean
  } {
    const provider = aiProviderRegistry.getProvider(providerId)
    return {
      id: providerId,
      name: provider?.name || providerId,
      isSupported: aiProviderRegistry.isSupported(providerId)
    }
  }
}

// 便捷导出函数
export const createClient = (providerId: string, modelId?: string, options?: any) =>
  ApiClientFactory.createClient(providerId, modelId, options)

export const getSupportedProviders = () => ApiClientFactory.getSupportedProviders()

export const getClientInfo = (providerId: string) => ApiClientFactory.getClientInfo(providerId)

export const createImageClient = (providerId: string, modelId?: string, options?: any) =>
  ApiClientFactory.createImageClient(providerId, modelId, options)
