import WebSearchService from '@renderer/services/WebSearchService'
import { WebSearchProvider } from '@renderer/types'
import aiSdk from 'ai'

import { AiSdkTool, ToolCallResult } from './types'

export const webSearchTool = (webSearchProviderId: WebSearchProvider['id'], requestId: string): AiSdkTool => {
  const webSearchService = WebSearchService.getInstance(webSearchProviderId)
  return {
    name: 'web_search',
    description: 'Search the web for information',
    inputSchema: aiSdk.jsonSchema({
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The query to search for' }
      },
      required: ['query']
    }),
    execute: async ({ query }): Promise<ToolCallResult> => {
      try {
        const response = await webSearchService.processWebsearch(query, requestId)
        return {
          success: true,
          data: response
        }
      } catch (error) {
        return {
          success: false,
          data: error
        }
      }
    }
  }
}
