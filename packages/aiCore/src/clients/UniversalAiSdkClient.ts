/**
 * Universal AI SDK Client
 * 统一的AI SDK客户端实现
 */

import { generateObject, generateText, streamObject, streamText } from 'ai'

import { ApiClientFactory } from './ApiClientFactory'

/**
 * 通用 AI SDK 客户端
 * 为特定 AI 提供商创建的客户端实例
 */
export class UniversalAiSdkClient {
  constructor(
    private readonly providerId: string,
    private readonly options: any = {}
  ) {}

  /**
   * 流式文本生成
   * 直接使用 AI SDK 的 streamText 参数类型
   */
  async streamText(modelId: string, params: Omit<Parameters<typeof streamText>[0], 'model'>) {
    const model = await ApiClientFactory.createClient(this.providerId, modelId, this.options)
    return await streamText({
      model,
      ...params
    })
  }

  /**
   * 生成文本
   * 直接使用 AI SDK 的 generateText 参数类型
   */
  async generateText(modelId: string, params: Omit<Parameters<typeof generateText>[0], 'model'>) {
    const model = await ApiClientFactory.createClient(this.providerId, modelId, this.options)
    return await generateText({
      model,
      ...params
    })
  }

  /**
   * 生成结构化对象
   * 直接使用 AI SDK 的 generateObject 参数类型
   */
  async generateObject(modelId: string, params: Omit<Parameters<typeof generateObject>[0], 'model'>) {
    const model = await ApiClientFactory.createClient(this.providerId, modelId, this.options)
    return await generateObject({
      model,
      ...params
    })
  }

  /**
   * 流式生成结构化对象
   * 直接使用 AI SDK 的 streamObject 参数类型
   */
  async streamObject(modelId: string, params: Omit<Parameters<typeof streamObject>[0], 'model'>) {
    const model = await ApiClientFactory.createClient(this.providerId, modelId, this.options)
    return await streamObject({
      model,
      ...params
    })
  }

  /**
   * 获取客户端信息
   */
  getClientInfo() {
    return ApiClientFactory.getClientInfo(this.providerId)
  }
}

/**
 * 创建客户端实例的工厂函数
 */
export function createUniversalClient(providerId: string, options: any = {}): UniversalAiSdkClient {
  return new UniversalAiSdkClient(providerId, options)
}
