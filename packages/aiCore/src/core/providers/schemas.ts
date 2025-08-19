/**
 * 基于 Zod 的 Provider 验证系统
 * - 纯验证层，无状态管理
 * - 数据驱动的 Provider 定义
 * - 完整的类型安全
 */

import { createAnthropic } from '@ai-sdk/anthropic'
import { createAzure } from '@ai-sdk/azure'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI, type OpenAIProviderSettings } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { createXai } from '@ai-sdk/xai'
import * as z from 'zod'

/**
 * 基础 Providers 定义
 * 作为唯一数据源，避免重复维护
 */
export const baseProviders = [
  {
    id: 'openai',
    name: 'OpenAI',
    creator: createOpenAI,
    supportsImageGeneration: true
  },
  {
    id: 'openai-responses',
    name: 'OpenAI Responses',
    creator: (options: OpenAIProviderSettings) => createOpenAI(options).responses,
    supportsImageGeneration: true
  },
  {
    id: 'openai-compatible',
    name: 'OpenAI Compatible',
    creator: createOpenAICompatible,
    supportsImageGeneration: true
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    creator: createAnthropic,
    supportsImageGeneration: false
  },
  {
    id: 'google',
    name: 'Google Generative AI',
    creator: createGoogleGenerativeAI,
    supportsImageGeneration: true
  },
  {
    id: 'xai',
    name: 'xAI (Grok)',
    creator: createXai,
    supportsImageGeneration: true
  },
  {
    id: 'azure',
    name: 'Azure OpenAI',
    creator: createAzure,
    supportsImageGeneration: true
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    creator: createDeepSeek,
    supportsImageGeneration: false
  }
] as const

/**
 * 基础 Provider IDs
 * 从 baseProviders 自动提取，避免重复维护
 */
export const baseProviderIds = baseProviders.map((p) => p.id) as unknown as readonly [string, ...string[]]

/**
 * 基础 Provider ID Schema
 */
export const baseProviderIdSchema = z.enum(baseProviderIds)

/**
 * 动态 Provider ID Schema
 * 允许任意字符串，但排除基础 provider IDs 以避免冲突
 */
export const dynamicProviderIdSchema = z
  .string()
  .min(1)
  .refine((id) => !baseProviderIds.includes(id as any), {
    message: 'Dynamic provider ID cannot conflict with base provider IDs'
  })

/**
 * 组合的 Provider ID Schema
 * 支持基础 providers + 动态扩展
 */
export const providerIdSchema = z.union([baseProviderIdSchema, dynamicProviderIdSchema])

/**
 * Provider 配置 Schema
 */
export const providerConfigSchema = z
  .object({
    id: providerIdSchema,
    name: z.string().min(1),
    creator: z.function().optional(),
    import: z.function().optional(),
    creatorFunctionName: z.string().optional(),
    supportsImageGeneration: z.boolean().default(false),
    imageCreator: z.function().optional(),
    validateOptions: z.function().optional()
  })
  .refine((data) => data.creator || (data.import && data.creatorFunctionName), {
    message: 'Must provide either creator function or import configuration'
  })

/**
 * 动态 Provider 注册配置 Schema
 */
export const dynamicProviderRegistrationSchema = z
  .object({
    id: dynamicProviderIdSchema,
    name: z.string().min(1),
    creator: z.function().optional(),
    import: z.function().optional(),
    creatorFunctionName: z.string().optional(),
    supportsImageGeneration: z.boolean().default(false),
    imageCreator: z.function().optional(),
    validateOptions: z.function().optional(),
    mappings: z.record(z.string()).optional()
  })
  .refine((data) => data.creator || (data.import && data.creatorFunctionName), {
    message: 'Must provide either creator function or import configuration'
  })

// ===== 类型推导 =====

export type BaseProviderId = z.infer<typeof baseProviderIdSchema>
export type DynamicProviderId = z.infer<typeof dynamicProviderIdSchema>
export type ProviderId = z.infer<typeof providerIdSchema>
export type ProviderConfig = z.infer<typeof providerConfigSchema>
export type DynamicProviderRegistration = z.infer<typeof dynamicProviderRegistrationSchema>

// ===== 纯验证函数 =====

/**
 * 验证 Provider ID 是否有效（包括基础和动态格式）
 */
export function validateProviderId(id: string): boolean {
  return providerIdSchema.safeParse(id).success
}

/**
 * 验证是否为基础 Provider ID
 */
export function isBaseProviderId(id: string): id is BaseProviderId {
  return baseProviderIdSchema.safeParse(id).success
}

/**
 * 验证是否为有效的动态 Provider ID 格式
 */
export function isValidDynamicProviderId(id: string): boolean {
  return dynamicProviderIdSchema.safeParse(id).success
}

/**
 * 验证 Provider 配置
 */
export function validateProviderConfig(config: unknown): ProviderConfig | null {
  const result = providerConfigSchema.safeParse(config)
  if (result.success) {
    return result.data
  }
  return null
}

/**
 * 验证动态 Provider 注册配置
 */
export function validateDynamicProviderRegistration(config: unknown): DynamicProviderRegistration | null {
  const result = dynamicProviderRegistrationSchema.safeParse(config)
  if (result.success) {
    return result.data
  }
  return null
}

/**
 * 获取基础 Provider 配置
 */
export function getBaseProviderConfig(id: BaseProviderId): (typeof baseProviders)[number] | undefined {
  return baseProviders.find((p) => p.id === id)
}
