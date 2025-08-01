import { processKnowledgeSearch } from '@renderer/services/KnowledgeService'
import type { Assistant, KnowledgeReference } from '@renderer/types'
import { ExtractResults } from '@renderer/utils/extract'
import { type InferToolInput, type InferToolOutput, tool } from 'ai'
import { isEmpty } from 'lodash'
import { z } from 'zod'

// Schema definitions - 添加 userMessage 字段来获取用户消息
const KnowledgeSearchInputSchema = z.object({
  query: z.string().describe('The search query for knowledge base'),
  rewrite: z.string().optional().describe('Optional rewritten query with alternative phrasing'),
  userMessage: z.string().describe('The original user message content for direct search mode')
})

export type KnowledgeSearchToolInput = InferToolInput<ReturnType<typeof knowledgeSearchTool>>
export type KnowledgeSearchToolOutput = InferToolOutput<ReturnType<typeof knowledgeSearchTool>>

/**
 * 知识库搜索工具
 * 基于 ApiService.ts 中的 searchKnowledgeBase 逻辑实现
 */
export const knowledgeSearchTool = (assistant: Assistant) => {
  return tool({
    name: 'builtin_knowledge_search',
    description: 'Search the knowledge base for relevant information',
    inputSchema: KnowledgeSearchInputSchema,
    execute: async ({ query, rewrite, userMessage }) => {
      console.log('🔍 [KnowledgeSearchTool] Executing search:', { query, rewrite, userMessage })

      try {
        // 获取助手的知识库配置
        const knowledgeBaseIds = assistant.knowledge_bases?.map((base) => base.id)
        const hasKnowledgeBase = !isEmpty(knowledgeBaseIds)
        const knowledgeRecognition = assistant.knowledgeRecognition || 'on'

        // 检查是否有知识库
        if (!hasKnowledgeBase) {
          console.log('🔍 [KnowledgeSearchTool] No knowledge bases found for assistant')
          return []
        }

        // 构建搜索条件 - 复制原逻辑
        let searchCriteria: { question: string[]; rewrite: string }

        if (knowledgeRecognition === 'off') {
          // 直接模式：使用用户消息内容 (类似原逻辑的 getMainTextContent(lastUserMessage))
          const directContent = userMessage || query || 'search'
          searchCriteria = {
            question: [directContent],
            rewrite: directContent
          }
          console.log('🔍 [KnowledgeSearchTool] Direct mode - using user message:', directContent)
        } else {
          // 自动模式：使用意图识别的结果 (类似原逻辑的 extractResults.knowledge)
          searchCriteria = {
            question: [query],
            rewrite: rewrite || query
          }
          console.log('🔍 [KnowledgeSearchTool] Auto mode - using intent analysis result')
        }

        // 检查是否需要搜索
        if (searchCriteria.question[0] === 'not_needed') {
          console.log('🔍 [KnowledgeSearchTool] Search not needed')
          return []
        }

        // 构建 ExtractResults 对象 - 与原逻辑一致
        const extractResults: ExtractResults = {
          websearch: undefined,
          knowledge: searchCriteria
        }

        console.log('🔍 [KnowledgeSearchTool] Search criteria:', searchCriteria)
        console.log('🔍 [KnowledgeSearchTool] Knowledge base IDs:', knowledgeBaseIds)

        // 执行知识库搜索
        const knowledgeReferences = await processKnowledgeSearch(extractResults, knowledgeBaseIds)

        console.log('🔍 [KnowledgeSearchTool] Search results:', knowledgeReferences)

        // 返回结果数组
        return knowledgeReferences.map((ref: KnowledgeReference) => ({
          id: ref.id,
          content: ref.content,
          sourceUrl: ref.sourceUrl,
          type: ref.type,
          file: ref.file
        }))
      } catch (error) {
        console.error('🔍 [KnowledgeSearchTool] Search failed:', error)

        // 返回空数组而不是抛出错误，避免中断对话流程
        return []
      }
    }
  })
}

export default knowledgeSearchTool
