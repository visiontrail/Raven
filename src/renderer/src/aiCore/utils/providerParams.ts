/**
 * 提供商特定参数处理模块
 * 从各个 API 客户端迁移的参数构建逻辑，用于 AI SDK 的 providerOptions
 */

import { Modality } from '@google/genai'
import { DEFAULT_MAX_TOKENS } from '@renderer/config/constant'
import {
  findTokenLimit,
  GEMINI_FLASH_MODEL_REGEX,
  getOpenAIWebSearchParams,
  isGeminiReasoningModel,
  isOpenAIModel,
  isOpenAIReasoningModel,
  isReasoningModel,
  isSupportedFlexServiceTier,
  isSupportedReasoningEffortOpenAIModel
} from '@renderer/config/models'
import { getStoreSetting } from '@renderer/hooks/useSettings'
import { getAssistantSettings } from '@renderer/services/AssistantService'
import type { SettingsState } from '@renderer/store/settings'
import { Assistant, EFFORT_RATIO, Model, OpenAIServiceTier } from '@renderer/types'

// ===== OpenAI 相关参数 =====

/**
 * 获取 OpenAI 服务层级
 * 从 BaseApiClient.getServiceTier 迁移
 */
export function getServiceTier(model: Model): OpenAIServiceTier | undefined {
  if (!isOpenAIModel(model) || model.provider === 'github' || model.provider === 'copilot') {
    return undefined
  }

  const openAI = getStoreSetting('openAI') as SettingsState['openAI']
  let serviceTier = 'auto' as OpenAIServiceTier

  if (openAI && openAI?.serviceTier === 'flex') {
    if (isSupportedFlexServiceTier(model)) {
      serviceTier = 'flex'
    } else {
      serviceTier = 'auto'
    }
  } else {
    serviceTier = openAI.serviceTier
  }

  return serviceTier
}

/**
 * 获取 OpenAI 提供商特定参数
 * 从 OpenAIBaseClient.getProviderSpecificParameters 迁移
 */
export function getOpenAIProviderSpecificParameters(assistant: Assistant, model: Model) {
  const { maxTokens } = getAssistantSettings(assistant)

  if (model.provider === 'openrouter') {
    if (model.id.includes('deepseek-r1')) {
      return {
        include_reasoning: true
      }
    }
  }

  if (isOpenAIReasoningModel(model)) {
    return {
      max_tokens: undefined,
      max_completion_tokens: maxTokens
    }
  }

  return {}
}

/**
 * 获取 OpenAI 推理努力参数
 * 从 OpenAIBaseClient.getReasoningEffort 迁移
 */
export function getOpenAIReasoningEffort(assistant: Assistant, model: Model) {
  if (!isSupportedReasoningEffortOpenAIModel(model)) {
    return {}
  }

  const openAI = getStoreSetting('openAI') as SettingsState['openAI']
  const summaryText = openAI?.summaryText || 'off'

  let summary: string | undefined = undefined

  if (summaryText === 'off' || model.id.includes('o1-pro')) {
    summary = undefined
  } else {
    summary = summaryText
  }

  const reasoningEffort = assistant?.settings?.reasoning_effort
  if (!reasoningEffort) {
    return {}
  }

  if (isSupportedReasoningEffortOpenAIModel(model)) {
    return {
      reasoning: {
        effort: reasoningEffort,
        summary: summary
      }
    }
  }

  return {}
}

// ===== Anthropic 相关参数 =====

/**
 * 获取 Anthropic 思维预算令牌配置
 * 从 AnthropicAPIClient.getBudgetToken 迁移
 */
export function getAnthropicBudgetToken(assistant: Assistant, model: Model) {
  if (!isReasoningModel(model)) {
    return undefined
  }

  const { maxTokens } = getAssistantSettings(assistant)
  const reasoningEffort = assistant?.settings?.reasoning_effort

  if (reasoningEffort === undefined) {
    return {
      type: 'disabled'
    }
  }

  const effortRatio = EFFORT_RATIO[reasoningEffort]
  const tokenLimit = findTokenLimit(model.id)

  if (!tokenLimit) {
    return {
      type: 'enabled',
      budget_tokens: Math.max(1024, Math.floor((maxTokens || DEFAULT_MAX_TOKENS) * effortRatio))
    }
  }

  const budgetTokens = Math.max(
    1024,
    Math.floor(
      Math.min(
        (tokenLimit.max - tokenLimit.min) * effortRatio + tokenLimit.min,
        (maxTokens || DEFAULT_MAX_TOKENS) * effortRatio
      )
    )
  )

  return {
    type: 'enabled',
    budget_tokens: budgetTokens
  }
}

// ===== Gemini 相关参数 =====

/**
 * 获取 Gemini 思维配置
 * 从 GeminiAPIClient.getBudgetToken 迁移
 */
export function getGeminiBudgetToken(assistant: Assistant, model: Model) {
  if (isGeminiReasoningModel(model)) {
    const reasoningEffort = assistant?.settings?.reasoning_effort

    // 如果 thinking_budget 是 undefined，不思考
    if (reasoningEffort === undefined) {
      return {
        thinkingConfig: {
          includeThoughts: false,
          ...(GEMINI_FLASH_MODEL_REGEX.test(model.id) ? { thinkingBudget: 0 } : {})
        }
      }
    }

    const effortRatio = EFFORT_RATIO[reasoningEffort]

    if (effortRatio > 1) {
      return {
        thinkingConfig: {
          includeThoughts: true
        }
      }
    }

    const tokenLimit = findTokenLimit(model.id)
    const { min = 0, max = 0 } = tokenLimit || {}

    // 计算 budgetTokens，确保不低于 min
    const budget = Math.floor((max - min) * effortRatio + min)

    return {
      thinkingConfig: {
        ...(budget > 0 ? { thinkingBudget: budget } : {}),
        includeThoughts: true
      }
    }
  }

  return {}
}

/**
 * 获取 Gemini 安全设置
 * 从 GeminiAPIClient.getSafetySettings 迁移
 */
export function getGeminiSafetySettings() {
  return [
    {
      category: 'HARM_CATEGORY_HARASSMENT',
      threshold: 'BLOCK_NONE'
    },
    {
      category: 'HARM_CATEGORY_HATE_SPEECH',
      threshold: 'BLOCK_NONE'
    },
    {
      category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
      threshold: 'BLOCK_NONE'
    },
    {
      category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
      threshold: 'BLOCK_NONE'
    }
  ]
}

/**
 * 获取 Gemini 图像生成参数
 * 从 GeminiAPIClient.getGenerateImageParameter 迁移
 */
export function getGeminiGenerateImageParameter() {
  return {
    systemInstruction: undefined,
    responseModalities: [Modality.TEXT, Modality.IMAGE],
    responseMimeType: 'text/plain'
  }
}

// ===== Web 搜索相关参数 =====

/**
 * 获取 OpenAI 的 Web 搜索 providerOptions
 * 复用现有的 getOpenAIWebSearchParams 函数
 */
export function getOpenAIWebSearchProviderOptions(model: Model, enableWebSearch: boolean): Record<string, any> {
  return getOpenAIWebSearchParams(model, enableWebSearch)
}

/**
 * 获取 Anthropic 的 Web 搜索 providerOptions
 */
export function getAnthropicWebSearchProviderOptions(model: Model, enableWebSearch: boolean): Record<string, any> {
  if (!enableWebSearch) {
    return {}
  }

  // Anthropic 通过 tools 实现，但在 AI SDK 中应该通过 providerOptions 统一
  return {
    webSearch: {
      enabled: true,
      toolType: 'web_search_20250305',
      maxUses: 5
    }
  }
}

/**
 * 获取 Gemini 的 Web 搜索 providerOptions
 */
export function getGeminiWebSearchProviderOptions(model: Model, enableWebSearch: boolean): Record<string, any> {
  if (!enableWebSearch) {
    return {}
  }

  // Gemini 通过 googleSearch 工具实现，但在 AI SDK 中应该通过 providerOptions 统一
  return {
    webSearch: {
      enabled: true,
      toolType: 'googleSearch'
    }
  }
}

// ===== 通用辅助函数 =====

/**
 * 获取自定义参数
 * 从 BaseApiClient.getCustomParameters 迁移
 */
export function getCustomParameters(assistant: Assistant) {
  return (
    assistant?.settings?.customParameters?.reduce((acc, param) => {
      if (!param.name?.trim()) {
        return acc
      }
      if (param.type === 'json') {
        const value = param.value as string
        if (value === 'undefined') {
          return { ...acc, [param.name]: undefined }
        }
        try {
          return { ...acc, [param.name]: JSON.parse(value) }
        } catch {
          return { ...acc, [param.name]: value }
        }
      }
      return {
        ...acc,
        [param.name]: param.value
      }
    }, {}) || {}
  )
}
