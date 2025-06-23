/**
 * AI 编排器
 * 编排层 - 面向用户的主要API，串联creation和execution层
 */
import {
  generateObject as aiGenerateObject,
  generateText as aiGenerateText,
  streamObject as aiStreamObject,
  streamText as aiStreamText
} from 'ai'

import { createModelFromConfig, resolveConfig } from '../core/creation'
import { AiExecutor } from '../core/execution/AiExecutor'
import {
  type GenerateObjectParams,
  type GenerateTextParams,
  type StreamObjectParams,
  type StreamTextParams
} from '../types'
import { type OrchestrationConfig } from './types'

/**
 * 流式文本生成
 * 编排：creation层获取model → 执行器执行
 */
// export async function streamText<T extends ProviderId>(
//   modelId: string,
//   params: StreamTextParams,
//   config: OrchestrationConfig<T>
// ): Promise<ReturnType<typeof aiStreamText>>
export async function streamText(
  modelId: string,
  params: StreamTextParams,
  config: OrchestrationConfig
): Promise<ReturnType<typeof aiStreamText>> {
  // 外部 registry 方式：直接使用用户提供的 model
  // if ('model' in configOrParams) {
  //   return aiStreamText(configOrParams)
  // }

  // 1. 使用 creation 层解析配置并创建 model
  const resolvedConfig = resolveConfig(
    config.providerId,
    modelId!,
    config.options,
    config.plugins || [],
    config.middlewares || [] // middlewares
  )
  const model = await createModelFromConfig(resolvedConfig)
  // const providerOptions = extractProviderOptions(resolvedConfig)

  // 2. 创建执行器并传入 model
  const executor = AiExecutor.create(config.providerId, config.plugins)
  return executor.streamText(model, params!)
}

/**
 * 生成文本
 * 编排：creation层获取model → 执行器执行
 */
export async function generateText(
  modelId: string,
  params: GenerateTextParams,
  config: OrchestrationConfig
): Promise<ReturnType<typeof aiGenerateText>> {
  // 外部 registry 方式：直接使用用户提供的 model
  // if ('model' in configOrParams) {
  //   return aiGenerateText(configOrParams)
  // }

  // 编排方式：1. creation层获取model 2. execution层执行
  // 1. 使用 creation 层解析配置并创建 model
  const resolvedConfig = resolveConfig(
    config.providerId,
    modelId!,
    config.options,
    config.plugins || [],
    config.middlewares || [] // middlewares
  )
  const model = await createModelFromConfig(resolvedConfig)
  // const providerOptions = extractProviderOptions(resolvedConfig)

  // 2. 创建执行器并传入 model
  const executor = AiExecutor.create(config.providerId, config.plugins)
  return executor.generateText(model, params!)
}

/**
 * 生成结构化对象
 * 编排：creation层获取model → 执行器执行
 */
export async function generateObject(
  modelId: string,
  params: GenerateObjectParams,
  config: OrchestrationConfig
): Promise<ReturnType<typeof aiGenerateObject>> {
  // 外部 registry 方式：直接使用用户提供的 model
  // if ('model' in configOrParams) {
  //   return aiGenerateObject(configOrParams)
  // }

  // 编排方式：1. creation层获取model 2. execution层执行
  // 1. 使用 creation 层解析配置并创建 model
  const resolvedConfig = resolveConfig(
    config.providerId,
    modelId!,
    config.options,
    config.plugins || [],
    config.middlewares || [] // middlewares
  )
  const model = await createModelFromConfig(resolvedConfig)
  // const providerOptions = extractProviderOptions(resolvedConfig)

  // 2. 创建执行器并传入 model
  const executor = AiExecutor.create(config.providerId, config.plugins)
  return executor.generateObject(model, params!)
}

/**
 * 流式生成结构化对象
 * 编排：creation层获取model → 执行器执行
 */
export async function streamObject(
  modelId: string,
  params: StreamObjectParams,
  config: OrchestrationConfig
): Promise<ReturnType<typeof aiStreamObject>> {
  // 外部 registry 方式：直接使用用户提供的 model
  // if ('model' in configOrParams) {
  //   return aiStreamObject(configOrParams)
  // }

  // 编排方式：1. creation层获取model 2. execution层执行
  // 1. 使用 creation 层解析配置并创建 model
  const resolvedConfig = resolveConfig(
    config.providerId,
    modelId!,
    config.options,
    config.plugins || [],
    config.middlewares || [] // middlewares
  )
  const model = await createModelFromConfig(resolvedConfig)
  // const providerOptions = extractProviderOptions(resolvedConfig)

  // 2. 创建执行器并传入 model
  const executor = AiExecutor.create(config.providerId, config.plugins)
  return executor.streamObject(model, params!)
}
