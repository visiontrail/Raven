import type { MCPToolInputSchema } from './index'

export type ToolType = 'builtin' | 'provider' | 'mcp'

export interface BaseTool {
  id: string
  name: string
  description?: string
  type: ToolType
}

// export interface ToolCallResponse {
//   id: string
//   toolName: string
//   arguments: Record<string, unknown> | undefined
//   status: 'invoking' | 'completed' | 'error'
//   result?: any // AI SDK的工具执行结果
//   error?: string
//   providerExecuted?: boolean // 标识是Provider端执行还是客户端执行
// }

export interface BuiltinTool extends BaseTool {
  inputSchema: MCPToolInputSchema
  type: 'builtin'
}

export interface MCPTool extends BaseTool {
  serverId: string
  serverName: string
  inputSchema: MCPToolInputSchema
  type: 'mcp'
}
