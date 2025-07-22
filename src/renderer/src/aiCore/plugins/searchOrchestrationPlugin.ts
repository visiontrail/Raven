/**
 * 搜索编排插件
 *
 * 功能：
 * 1. onRequestStart: 智能意图识别 - 分析是否需要网络搜索、知识库搜索、记忆搜索
 * 2. transformParams: 根据意图分析结果动态添加对应的工具
 * 3. onRequestEnd: 自动记忆存储
 */
import type { AiRequestContext, ModelMessage } from '@cherrystudio/ai-core'
import { definePlugin } from '@cherrystudio/ai-core'
import { RuntimeExecutor } from '@cherrystudio/ai-core/core/runtime/executor'
// import { generateObject } from '@cherrystudio/ai-core'
import {
  SEARCH_SUMMARY_PROMPT,
  SEARCH_SUMMARY_PROMPT_KNOWLEDGE_ONLY,
  SEARCH_SUMMARY_PROMPT_WEB_ONLY
} from '@renderer/config/prompts'
import { getDefaultModel, getProviderByModel } from '@renderer/services/AssistantService'
import store from '@renderer/store'
import { selectCurrentUserId, selectGlobalMemoryEnabled, selectMemoryConfig } from '@renderer/store/memory'
import type { Assistant } from '@renderer/types'
import { isEmpty } from 'lodash'
import { z } from 'zod'

import { MemoryProcessor } from '../../services/MemoryProcessor'
import { memorySearchTool } from '../tools/MemorySearchTool'
import { webSearchTool } from '../tools/WebSearchTool'

const getMessageContent = (message: ModelMessage) => {
  if (typeof message.content === 'string') return message.content
  return message.content.reduce((acc, part) => {
    if (part.type === 'text') {
      return acc + part.text + '\n'
    }
    return acc
  }, '')
}

// === Schema Definitions ===

const WebSearchSchema = z.object({
  question: z
    .array(z.string())
    .describe('Search queries for web search. Use "not_needed" if no web search is required.'),
  links: z.array(z.string()).optional().describe('Specific URLs to search or summarize if mentioned in the query.')
})

const KnowledgeSearchSchema = z.object({
  question: z
    .array(z.string())
    .describe('Search queries for knowledge base. Use "not_needed" if no knowledge search is required.'),
  rewrite: z
    .string()
    .describe('Rewritten query with alternative phrasing while preserving original intent and meaning.')
})

const SearchIntentAnalysisSchema = z.object({
  websearch: WebSearchSchema.optional().describe('Web search intent analysis results.'),
  knowledge: KnowledgeSearchSchema.optional().describe('Knowledge base search intent analysis results.')
})

type SearchIntentResult = z.infer<typeof SearchIntentAnalysisSchema>

/**
 * 🧠 意图分析函数 - 使用结构化输出重构
 */
async function analyzeSearchIntent(
  lastUserMessage: ModelMessage,
  assistant: Assistant,
  options: {
    shouldWebSearch?: boolean
    shouldKnowledgeSearch?: boolean
    shouldMemorySearch?: boolean
    lastAnswer?: ModelMessage
    context?:
      | AiRequestContext
      | {
          executor: RuntimeExecutor
        }
  } = {}
): Promise<SearchIntentResult | undefined> {
  const { shouldWebSearch = false, shouldKnowledgeSearch = false, lastAnswer, context } = options

  if (!lastUserMessage) return undefined

  // 根据配置决定是否需要提取
  const needWebExtract = shouldWebSearch
  const needKnowledgeExtract = shouldKnowledgeSearch

  if (!needWebExtract && !needKnowledgeExtract) return undefined

  // 选择合适的提示词和schema
  let prompt: string
  let schema: z.Schema

  if (needWebExtract && !needKnowledgeExtract) {
    prompt = SEARCH_SUMMARY_PROMPT_WEB_ONLY
    schema = z.object({ websearch: WebSearchSchema })
  } else if (!needWebExtract && needKnowledgeExtract) {
    prompt = SEARCH_SUMMARY_PROMPT_KNOWLEDGE_ONLY
    schema = z.object({ knowledge: KnowledgeSearchSchema })
  } else {
    prompt = SEARCH_SUMMARY_PROMPT
    schema = SearchIntentAnalysisSchema
  }

  // 构建消息上下文
  const messages = lastAnswer ? [lastAnswer, lastUserMessage] : [lastUserMessage]
  console.log('messagesmessagesmessagesmessagesmessagesmessagesmessages', messages)
  // 格式化消息为提示词期望的格式
  // const chatHistory =
  //   messages.length > 1
  //     ? messages
  //         .slice(0, -1)
  //         .map((msg) => `${msg.role}: ${getMainTextContent(msg)}`)
  //         .join('\n')
  //     : ''
  // const question = getMainTextContent(lastUserMessage) || ''

  // // 使用模板替换变量
  // const formattedPrompt = prompt.replace('{chat_history}', chatHistory).replace('{question}', question)

  // 获取模型和provider信息
  const model = assistant.model || getDefaultModel()
  const provider = getProviderByModel(model)

  if (!provider || isEmpty(provider.apiKey)) {
    console.error('Provider not found or missing API key')
    return getFallbackResult()
  }

  try {
    const result = await context?.executor?.generateObject(model.id, { schema, prompt })
    console.log('result', context)
    const parsedResult = result?.object as SearchIntentResult

    // 根据需求过滤结果
    return {
      websearch: needWebExtract ? parsedResult?.websearch : undefined,
      knowledge: needKnowledgeExtract ? parsedResult?.knowledge : undefined
    }
  } catch (e: any) {
    console.error('analyze search intent error', e)
    return getFallbackResult()
  }

  function getFallbackResult(): SearchIntentResult {
    const fallbackContent = getMessageContent(lastUserMessage)
    return {
      websearch: shouldWebSearch ? { question: [fallbackContent || 'search'] } : undefined,
      knowledge: shouldKnowledgeSearch
        ? {
            question: [fallbackContent || 'search'],
            rewrite: fallbackContent || 'search'
          }
        : undefined
    }
  }
}

/**
 * 🧠 记忆存储函数 - 基于注释代码中的 processConversationMemory
 */
async function storeConversationMemory(messages: ModelMessage[], assistant: Assistant): Promise<void> {
  const globalMemoryEnabled = selectGlobalMemoryEnabled(store.getState())

  if (!globalMemoryEnabled || !assistant.enableMemory) {
    console.log('Memory storage is disabled')
    return
  }

  try {
    const memoryConfig = selectMemoryConfig(store.getState())

    // 转换消息为记忆处理器期望的格式
    const conversationMessages = messages
      .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
      .map((msg) => ({
        role: msg.role,
        content: getMessageContent(msg) || ''
      }))
      .filter((msg) => msg.content.trim().length > 0)

    if (conversationMessages.length < 2) {
      console.log('Need at least a user message and assistant response for memory processing')
      return
    }

    const currentUserId = selectCurrentUserId(store.getState())
    const lastUserMessage = messages.findLast((m) => m.role === 'user')

    const processorConfig = MemoryProcessor.getProcessorConfig(
      memoryConfig,
      assistant.id,
      currentUserId,
      // TODO
      lastUserMessage?.id
    )

    console.log('Processing conversation memory...', { messageCount: conversationMessages.length })

    // 后台处理对话记忆（不阻塞 UI）
    const memoryProcessor = new MemoryProcessor()
    memoryProcessor
      .processConversation(conversationMessages, processorConfig)
      .then((result) => {
        console.log('Memory processing completed:', result)
        if (result.facts?.length > 0) {
          console.log('Extracted facts from conversation:', result.facts)
          console.log('Memory operations performed:', result.operations)
        } else {
          console.log('No facts extracted from conversation')
        }
      })
      .catch((error) => {
        console.error('Background memory processing failed:', error)
      })
  } catch (error) {
    console.error('Error in conversation memory processing:', error)
    // 不抛出错误，避免影响主流程
  }
}

/**
 * 🎯 搜索编排插件
 */
export const searchOrchestrationPlugin = (assistant: Assistant) => {
  // 存储意图分析结果
  const intentAnalysisResults: { [requestId: string]: SearchIntentResult } = {}
  const userMessages: { [requestId: string]: ModelMessage } = {}
  console.log('searchOrchestrationPlugin', assistant)
  return definePlugin({
    name: 'search-orchestration',
    enforce: 'pre', // 确保在其他插件之前执行

    /**
     * 🔍 Step 1: 意图识别阶段
     */
    onRequestStart: async (context: AiRequestContext) => {
      console.log('🧠 [SearchOrchestration] Starting intent analysis...', context.requestId)

      try {
        // 从参数中提取信息
        const messages = context.originalParams.messages

        if (!messages || messages.length === 0) {
          console.log('🧠 [SearchOrchestration] No messages found, skipping analysis')
          return
        }

        const lastUserMessage = messages[messages.length - 1]
        const lastAssistantMessage = messages.length >= 2 ? messages[messages.length - 2] : undefined

        // 存储用户消息用于后续记忆存储
        userMessages[context.requestId] = lastUserMessage

        // 判断是否需要各种搜索
        const knowledgeBaseIds = assistant.knowledge_bases?.map((base) => base.id)
        const hasKnowledgeBase = !isEmpty(knowledgeBaseIds)
        const knowledgeRecognition = assistant.knowledgeRecognition || 'on'
        const globalMemoryEnabled = selectGlobalMemoryEnabled(store.getState())

        const shouldWebSearch = !!assistant.webSearchProviderId
        const shouldKnowledgeSearch = hasKnowledgeBase && knowledgeRecognition === 'on'
        const shouldMemorySearch = globalMemoryEnabled && assistant.enableMemory

        console.log('🧠 [SearchOrchestration] Search capabilities:', {
          shouldWebSearch,
          shouldKnowledgeSearch,
          shouldMemorySearch
        })

        // 执行意图分析
        if (shouldWebSearch || shouldKnowledgeSearch) {
          const analysisResult = await analyzeSearchIntent(lastUserMessage, assistant, {
            shouldWebSearch,
            shouldKnowledgeSearch,
            shouldMemorySearch,
            lastAnswer: lastAssistantMessage,
            context
          })

          if (analysisResult) {
            intentAnalysisResults[context.requestId] = analysisResult
            console.log('🧠 [SearchOrchestration] Intent analysis completed:', analysisResult)
          }
        }
      } catch (error) {
        console.error('🧠 [SearchOrchestration] Intent analysis failed:', error)
        // 不抛出错误，让流程继续
      }
    },

    /**
     * 🔧 Step 2: 工具配置阶段
     */
    transformParams: async (params: any, context: AiRequestContext) => {
      console.log('🔧 [SearchOrchestration] Configuring tools based on intent...', context.requestId)

      try {
        const analysisResult = intentAnalysisResults[context.requestId]
        console.log('analysisResult', analysisResult)
        if (!analysisResult || !assistant) {
          console.log('🔧 [SearchOrchestration] No analysis result or assistant, skipping tool configuration')
          return params
        }

        // 确保 tools 对象存在
        if (!params.tools) {
          params.tools = {}
        }

        // 🌐 网络搜索工具配置
        if (analysisResult.websearch && assistant.webSearchProviderId) {
          const needsSearch = analysisResult.websearch.question && analysisResult.websearch.question[0] !== 'not_needed'

          if (needsSearch) {
            console.log('🌐 [SearchOrchestration] Adding web search tool')
            params.tools['builtin_web_search'] = webSearchTool(assistant.webSearchProviderId)
          }
        }

        // 📚 知识库搜索工具配置
        if (analysisResult.knowledge) {
          const needsKnowledgeSearch =
            analysisResult.knowledge.question && analysisResult.knowledge.question[0] !== 'not_needed'

          if (needsKnowledgeSearch) {
            console.log('📚 [SearchOrchestration] Adding knowledge search tool')
            // TODO: 添加知识库搜索工具
            // params.tools['builtin_knowledge_search'] = knowledgeSearchTool(assistant.knowledge_bases)
          }
        }

        // 🧠 记忆搜索工具配置
        const globalMemoryEnabled = selectGlobalMemoryEnabled(store.getState())
        if (globalMemoryEnabled && assistant.enableMemory) {
          console.log('🧠 [SearchOrchestration] Adding memory search tool')
          params.tools['builtin_memory_search'] = memorySearchTool()
        }

        console.log('🔧 [SearchOrchestration] Tools configured:', Object.keys(params.tools))
        return params
      } catch (error) {
        console.error('🔧 [SearchOrchestration] Tool configuration failed:', error)
        return params
      }
    },

    /**
     * 💾 Step 3: 记忆存储阶段
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onRequestEnd: async (context: AiRequestContext, _result: any) => {
      console.log('💾 [SearchOrchestration] Starting memory storage...', context.requestId)

      try {
        const assistant = context.originalParams.assistant
        const messages = context.originalParams.messages

        if (messages && assistant) {
          await storeConversationMemory(messages, assistant)
        }

        // 清理缓存
        delete intentAnalysisResults[context.requestId]
        delete userMessages[context.requestId]
      } catch (error) {
        console.error('💾 [SearchOrchestration] Memory storage failed:', error)
        // 不抛出错误，避免影响主流程
      }
    }
  })
}

export default searchOrchestrationPlugin
