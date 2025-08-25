/**
 * Hub Provider - 支持路由到多个底层provider
 *
 * 支持格式: hubId:providerId:modelId
 * 例如: aihubmix:anthropic:claude-3.5-sonnet
 */

import { ProviderV2 } from '@ai-sdk/provider'
import { customProvider } from 'ai'

import { globalRegistryManagement } from './RegistryManagement'

export interface HubProviderConfig {
  /** Hub的唯一标识符 */
  hubId: string
  /** 是否启用调试日志 */
  debug?: boolean
}

export class HubProviderError extends Error {
  constructor(
    message: string,
    public readonly hubId: string,
    public readonly providerId?: string,
    public readonly originalError?: Error
  ) {
    super(message)
    this.name = 'HubProviderError'
  }
}

/**
 * 解析Hub模型ID
 */
function parseHubModelId(modelId: string): { provider: string; actualModelId: string } {
  const parts = modelId.split(':')
  if (parts.length !== 2) {
    throw new HubProviderError(`Invalid hub model ID format. Expected "provider:modelId", got: ${modelId}`, 'unknown')
  }
  return {
    provider: parts[0],
    actualModelId: parts[1]
  }
}

/**
 * 创建Hub Provider
 */
export function createHubProvider(config: HubProviderConfig): ProviderV2 {
  const { hubId, debug = false } = config

  function logDebug(message: string, ...args: any[]) {
    if (debug) {
      console.log(`[HubProvider:${hubId}] ${message}`, ...args)
    }
  }

  function getTargetProvider(providerId: string): ProviderV2 {
    // 从全局注册表获取provider实例
    try {
      const provider = (globalRegistryManagement as any).getProvider(providerId)
      if (!provider) {
        throw new HubProviderError(
          `Provider "${providerId}" is not initialized. Please call initializeProvider("${providerId}", options) first.`,
          hubId,
          providerId
        )
      }
      return provider
    } catch (error) {
      throw new HubProviderError(
        `Failed to get provider "${providerId}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        hubId,
        providerId,
        error instanceof Error ? error : undefined
      )
    }
  }

  return customProvider({
    fallbackProvider: {
      languageModel: (modelId: string) => {
        logDebug('Resolving language model:', modelId)

        const { provider, actualModelId } = parseHubModelId(modelId)
        const targetProvider = getTargetProvider(provider)

        if (!targetProvider.languageModel) {
          throw new HubProviderError(`Provider "${provider}" does not support language models`, hubId, provider)
        }

        return targetProvider.languageModel(actualModelId)
      },

      textEmbeddingModel: (modelId: string) => {
        logDebug('Resolving text embedding model:', modelId)

        const { provider, actualModelId } = parseHubModelId(modelId)
        const targetProvider = getTargetProvider(provider)

        if (!targetProvider.textEmbeddingModel) {
          throw new HubProviderError(`Provider "${provider}" does not support text embedding models`, hubId, provider)
        }

        return targetProvider.textEmbeddingModel(actualModelId)
      },

      imageModel: (modelId: string) => {
        logDebug('Resolving image model:', modelId)

        const { provider, actualModelId } = parseHubModelId(modelId)
        const targetProvider = getTargetProvider(provider)

        if (!targetProvider.imageModel) {
          throw new HubProviderError(`Provider "${provider}" does not support image models`, hubId, provider)
        }

        return targetProvider.imageModel(actualModelId)
      },

      transcriptionModel: (modelId: string) => {
        logDebug('Resolving transcription model:', modelId)

        const { provider, actualModelId } = parseHubModelId(modelId)
        const targetProvider = getTargetProvider(provider)

        if (!targetProvider.transcriptionModel) {
          throw new HubProviderError(`Provider "${provider}" does not support transcription models`, hubId, provider)
        }

        return targetProvider.transcriptionModel(actualModelId)
      },

      speechModel: (modelId: string) => {
        logDebug('Resolving speech model:', modelId)

        const { provider, actualModelId } = parseHubModelId(modelId)
        const targetProvider = getTargetProvider(provider)

        if (!targetProvider.speechModel) {
          throw new HubProviderError(`Provider "${provider}" does not support speech models`, hubId, provider)
        }

        return targetProvider.speechModel(actualModelId)
      }
    }
  })
}
