/**
 * 内置插件：MCP Prompt 模式
 * 为不支持原生 Function Call 的模型提供 prompt 方式的工具调用
 * 内置默认逻辑，支持自定义覆盖
 */
import { ToolExecutionError, ToolSet } from 'ai'

import { definePlugin } from '../index'
import type { AiRequestContext } from '../types'

/**
 * 使用 AI SDK 的 Tool 类型，更通用
 */
// export interface Tool {
//   type: 'function'
//   function: {
//     name: string
//     description?: string
//     parameters?: {
//       type: 'object'
//       properties: Record<string, any>
//       required?: string[]
//       additionalProperties?: boolean
//     }
//   }
// }

/**
 * 解析结果类型
 * 表示从AI响应中解析出的工具使用意图
 */
export interface ToolUseResult {
  id: string
  toolName: string
  arguments: any
  status: 'pending' | 'invoking' | 'done' | 'error'
}

/**
 * MCP Prompt 插件配置
 */
export interface MCPPromptConfig {
  // 是否启用（用于运行时开关）
  enabled?: boolean
  // 自定义系统提示符构建函数（可选，有默认实现）
  buildSystemPrompt?: (userSystemPrompt: string, tools: ToolSet) => Promise<string>
  // 自定义工具解析函数（可选，有默认实现）
  parseToolUse?: (content: string, tools: ToolSet) => ToolUseResult[]
}

/**
 * 扩展的 AI 请求上下文，支持 MCP 工具存储
 */
interface MCPRequestContext extends AiRequestContext {
  mcpTools?: ToolSet
}

/**
 * 默认系统提示符模板（提取自 Cherry Studio）
 */
const DEFAULT_SYSTEM_PROMPT = `In this environment you have access to a set of tools you can use to answer the user's question. \\
You can use one tool per message, and will receive the result of that tool use in the user's response. You use tools step-by-step to accomplish a given task, with each tool use informed by the result of the previous tool use.

## Tool Use Formatting

Tool use is formatted using XML-style tags. The tool name is enclosed in opening and closing tags, and each parameter is similarly enclosed within its own set of tags. Here's the structure:

<tool_use>
  <name>{tool_name}</name>
  <arguments>{json_arguments}</arguments>
</tool_use>

The tool name should be the exact name of the tool you are using, and the arguments should be a JSON object containing the parameters required by that tool. For example:
<tool_use>
  <name>python_interpreter</name>
  <arguments>{"code": "5 + 3 + 1294.678"}</arguments>
</tool_use>

The user will respond with the result of the tool use, which should be formatted as follows:

<tool_use_result>
  <name>{tool_name}</name>
  <result>{result}</result>
</tool_use_result>

The result should be a string, which can represent a file or any other output type. You can use this result as input for the next action.
For example, if the result of the tool use is an image file, you can use it in the next action like this:

<tool_use>
  <name>image_transformer</name>
  <arguments>{"image": "image_1.jpg"}</arguments>
</tool_use>

Always adhere to this format for the tool use to ensure proper parsing and execution.

## Tool Use Examples
{{ TOOL_USE_EXAMPLES }}

## Tool Use Available Tools
Above example were using notional tools that might not exist for you. You only have access to these tools:
{{ AVAILABLE_TOOLS }}

## Tool Use Rules
Here are the rules you should always follow to solve your task:
1. Always use the right arguments for the tools. Never use variable names as the action arguments, use the value instead.
2. Call a tool only when needed: do not call the search agent if you do not need information, try to solve the task yourself.
3. If no tool call is needed, just answer the question directly.
4. Never re-do a tool call that you previously did with the exact same parameters.
5. For tool use, MAKE SURE use XML tag format as shown in the examples above. Do not use any other format.

# User Instructions
{{ USER_SYSTEM_PROMPT }}

Now Begin! If you solve the task correctly, you will receive a reward of $1,000,000.`

/**
 * 默认工具使用示例（提取自 Cherry Studio）
 */
const DEFAULT_TOOL_USE_EXAMPLES = `
Here are a few examples using notional tools:
---
User: Generate an image of the oldest person in this document.

A: I can use the document_qa tool to find out who the oldest person is in the document.
<tool_use>
  <name>document_qa</name>
  <arguments>{"document": "document.pdf", "question": "Who is the oldest person mentioned?"}</arguments>
</tool_use>

User: <tool_use_result>
  <name>document_qa</name>
  <result>John Doe, a 55 year old lumberjack living in Newfoundland.</result>
</tool_use_result>

A: I can use the image_generator tool to create a portrait of John Doe.
<tool_use>
  <name>image_generator</name>
  <arguments>{"prompt": "A portrait of John Doe, a 55-year-old man living in Canada."}</arguments>
</tool_use>

User: <tool_use_result>
  <name>image_generator</name>
  <result>image.png</result>
</tool_use_result>

A: the image is generated as image.png

---
User: "What is the result of the following operation: 5 + 3 + 1294.678?"

A: I can use the python_interpreter tool to calculate the result of the operation.
<tool_use>
  <name>python_interpreter</name>
  <arguments>{"code": "5 + 3 + 1294.678"}</arguments>
</tool_use>

User: <tool_use_result>
  <name>python_interpreter</name>
  <result>1302.678</result>
</tool_use_result>

A: The result of the operation is 1302.678.

---
User: "Which city has the highest population , Guangzhou or Shanghai?"

A: I can use the search tool to find the population of Guangzhou.
<tool_use>
  <name>search</name>
  <arguments>{"query": "Population Guangzhou"}</arguments>
</tool_use>

User: <tool_use_result>
  <name>search</name>
  <result>Guangzhou has a population of 15 million inhabitants as of 2021.</result>
</tool_use_result>

A: I can use the search tool to find the population of Shanghai.
<tool_use>
  <name>search</name>
  <arguments>{"query": "Population Shanghai"}</arguments>
</tool_use>

User: <tool_use_result>
  <name>search</name>
  <result>26 million (2019)</result>
</tool_use_result>
Assistant: The population of Shanghai is 26 million, while Guangzhou has a population of 15 million. Therefore, Shanghai has the highest population.`

/**
 * 构建可用工具部分（提取自 Cherry Studio）
 */
function buildAvailableTools(tools: ToolSet): string {
  const availableTools = Object.keys(tools)
    .map((toolName: string) => {
      const tool = tools[toolName]
      return `
<tool>
  <name>${toolName}</name>
  <description>${tool.description || ''}</description>
  <arguments>
    ${tool.parameters ? JSON.stringify(tool.parameters) : ''}
  </arguments>
</tool>
`
    })
    .join('\n')
  return `<tools>
${availableTools}
</tools>`
}

/**
 * 默认的系统提示符构建函数（提取自 Cherry Studio）
 */
async function defaultBuildSystemPrompt(userSystemPrompt: string, tools: ToolSet): Promise<string> {
  const availableTools = buildAvailableTools(tools)

  const fullPrompt = DEFAULT_SYSTEM_PROMPT.replace('{{ TOOL_USE_EXAMPLES }}', DEFAULT_TOOL_USE_EXAMPLES)
    .replace('{{ AVAILABLE_TOOLS }}', availableTools)
    .replace('{{ USER_SYSTEM_PROMPT }}', userSystemPrompt || '')

  return fullPrompt
}

/**
 * 默认工具解析函数（提取自 Cherry Studio）
 * 解析 XML 格式的工具调用
 */
function defaultParseToolUse(content: string, tools: ToolSet): ToolUseResult[] {
  if (!content || !tools || Object.keys(tools).length === 0) {
    return []
  }

  // 支持两种格式：
  // 1. 完整的 <tool_use></tool_use> 标签包围的内容
  // 2. 只有内部内容（从 TagExtractor 提取出来的）

  let contentToProcess = content

  // 如果内容不包含 <tool_use> 标签，说明是从 TagExtractor 提取的内部内容，需要包装
  if (!content.includes('<tool_use>')) {
    contentToProcess = `<tool_use>\n${content}\n</tool_use>`
  }

  const toolUsePattern =
    /<tool_use>([\s\S]*?)<name>([\s\S]*?)<\/name>([\s\S]*?)<arguments>([\s\S]*?)<\/arguments>([\s\S]*?)<\/tool_use>/g
  const results: ToolUseResult[] = []
  let match
  let idx = 0

  // Find all tool use blocks
  while ((match = toolUsePattern.exec(contentToProcess)) !== null) {
    const toolName = match[2].trim()
    const toolArgs = match[4].trim()

    // Try to parse the arguments as JSON
    let parsedArgs
    try {
      parsedArgs = JSON.parse(toolArgs)
    } catch (error) {
      // If parsing fails, use the string as is
      parsedArgs = toolArgs
    }

    // Find the corresponding tool
    const tool = tools[toolName]
    if (!tool) {
      console.warn(`Tool "${toolName}" not found in available tools`)
      continue
    }

    // Add to results array
    results.push({
      id: `${toolName}-${idx++}`, // Unique ID for each tool use
      toolName: toolName,
      arguments: parsedArgs,
      status: 'pending'
    })
  }
  return results
}

/**
 * 创建 MCP Prompt 插件
 */
export const createMCPPromptPlugin = definePlugin((config: MCPPromptConfig = {}) => {
  const { enabled = true, buildSystemPrompt = defaultBuildSystemPrompt, parseToolUse = defaultParseToolUse } = config

  return {
    name: 'built-in:mcp-prompt',

    transformParams: async (params: any, context: MCPRequestContext) => {
      if (!enabled || !params.tools || typeof params.tools !== 'object') {
        return params
      }

      // 直接存储工具信息到 context 上，利用改进的插件引擎
      context.mcpTools = params.tools
      console.log('tools stored in context', params.tools)

      // 构建系统提示符
      const userSystemPrompt = typeof params.system === 'string' ? params.system : ''
      const systemPrompt = await buildSystemPrompt(userSystemPrompt, params.tools)

      // 移除 tools，改为 prompt 模式
      const transformedParams = {
        ...params,
        system: systemPrompt,
        tools: undefined
      }
      console.log('transformedParams', transformedParams)
      return transformedParams
    },

    // 流式处理：监听 step-finish 事件并处理工具调用
    transformStream: (_, context: MCPRequestContext) => () => {
      let textBuffer = ''
      let executedResults: { toolCallId: string; toolName: string; result: any; isError?: boolean }[] = []

      return new TransformStream<any>({
        async transform(chunk, controller) {
          console.log('chunk', chunk)
          // 收集文本内容
          if (chunk.type === 'text-delta') {
            textBuffer += chunk.textDelta || ''
            console.log('textBuffer', textBuffer)
            controller.enqueue(chunk)
            return
          }

          // 监听 step-finish 事件
          if (chunk.type === 'step-finish' || chunk.type === 'finish') {
            console.log('[MCP Prompt Stream] Received step-finish, checking for tool use...')

            // 从 context 获取工具信息
            const tools = context.mcpTools
            console.log('tools from context', tools)
            if (!tools || Object.keys(tools).length === 0) {
              console.log('[MCP Prompt Stream] No tools available, passing through')
              controller.enqueue(chunk)
              return
            }

            // 解析工具调用
            const parsedTools = parseToolUse(textBuffer, tools)
            const validToolUses = parsedTools.filter((t) => t.status === 'pending')
            console.log('parsedTools', parsedTools)

            // 如果没有有效的工具调用，直接传递原始事件
            if (validToolUses.length === 0) {
              console.log('[MCP Prompt Stream] No valid tool uses found, passing through')
              controller.enqueue(chunk)
              return
            }

            console.log('[MCP Prompt Stream] Found valid tool uses:', validToolUses.length)

            // 修改 step-finish 事件，标记为工具调用
            if (chunk.type !== 'finish') {
              controller.enqueue({
                ...chunk,
                finishReason: 'tool-call'
              })
            }

            // 发送 step-start 事件（工具调用步骤开始）
            controller.enqueue({
              type: 'step-start'
            })

            // 执行工具调用
            executedResults = []
            for (const toolUse of validToolUses) {
              try {
                const tool = tools[toolUse.toolName]
                if (!tool || typeof tool.execute !== 'function') {
                  throw new Error(`Tool "${toolUse.toolName}" has no execute method`)
                }

                console.log(`[MCP Prompt Stream] Executing tool: ${toolUse.toolName}`, toolUse.arguments)
                // 发送 tool-call 事件
                controller.enqueue({
                  type: 'tool-call',
                  toolCallId: toolUse.id,
                  toolName: toolUse.toolName,
                  args: toolUse.arguments
                })

                const result = await tool.execute(toolUse.arguments, {
                  toolCallId: toolUse.id,
                  messages: [],
                  abortSignal: new AbortController().signal
                })

                // 发送 tool-result 事件
                controller.enqueue({
                  type: 'tool-result',
                  toolCallId: toolUse.id,
                  toolName: toolUse.toolName,
                  args: toolUse.arguments,
                  result
                })

                executedResults.push({
                  toolCallId: toolUse.id,
                  toolName: toolUse.toolName,
                  result,
                  isError: false
                })
              } catch (error) {
                console.error(`[MCP Prompt Stream] Tool execution failed: ${toolUse.toolName}`, error)

                // 使用 AI SDK 标准错误格式
                const toolError = new ToolExecutionError({
                  toolName: toolUse.toolName,
                  toolArgs: toolUse.arguments,
                  toolCallId: toolUse.id,
                  message: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
                  cause: error instanceof Error ? error : undefined
                })

                // 发送标准错误事件
                controller.enqueue({
                  type: 'error',
                  error: {
                    message: toolError.message,
                    name: toolError.name,
                    toolName: toolError.toolName,
                    toolCallId: toolError.toolCallId
                  }
                })

                // 发送 tool-result 错误事件
                controller.enqueue({
                  type: 'tool-result',
                  toolCallId: toolUse.id,
                  toolName: toolUse.toolName,
                  args: toolUse.arguments,
                  isError: true,
                  result: toolError.message
                })

                executedResults.push({
                  toolCallId: toolUse.id,
                  toolName: toolUse.toolName,
                  result: toolError.message,
                  isError: true
                })
              }
            }

            // 发送最终的 step-finish 事件
            controller.enqueue({
              type: 'step-finish',
              finishReason: 'tool-call'
            })

            // 递归调用逻辑
            if (context.recursiveCall && validToolUses.length > 0) {
              console.log('[MCP Prompt] Starting recursive call after tool execution...')

              // 构建工具结果的文本表示，使用Cherry Studio标准格式
              const toolResultsText = executedResults
                .map((tr) => {
                  if (!tr.isError) {
                    return `<tool_use_result>\n  <name>${tr.toolName}</name>\n  <result>${JSON.stringify(tr.result)}</result>\n</tool_use_result>`
                  } else {
                    const error = tr.result || 'Unknown error'
                    return `<tool_use_result>\n  <name>${tr.toolName}</name>\n  <error>${error}</error>\n</tool_use_result>`
                  }
                })
                .join('\n\n')

              // 构建新的对话消息
              const newMessages = [
                ...(context.originalParams.messages || []),
                {
                  role: 'assistant',
                  content: textBuffer
                },
                {
                  role: 'user',
                  content: toolResultsText
                }
              ]

              // 递归调用，继续对话，重新传递 tools
              const recursiveParams = {
                ...context.originalParams,
                messages: newMessages,
                tools: tools
              }

              try {
                const recursiveResult = await context.recursiveCall(recursiveParams)

                // 将递归调用的结果流接入当前流
                if (recursiveResult && recursiveResult.fullStream) {
                  const reader = recursiveResult.fullStream.getReader()
                  try {
                    while (true) {
                      const { done, value } = await reader.read()
                      if (done) {
                        break
                      }

                      // 将递归流的数据传递到当前流
                      controller.enqueue(value)
                    }
                  } finally {
                    reader.releaseLock()
                  }
                } else {
                  console.warn('[MCP Prompt] No fullstream found in recursive result:', recursiveResult)
                }
              } catch (error) {
                console.error('[MCP Prompt] Recursive call failed:', error)

                // 使用 AI SDK 标准错误格式，但不中断流
                controller.enqueue({
                  type: 'error',
                  error: {
                    message: error instanceof Error ? error.message : String(error),
                    name: error instanceof Error ? error.name : 'RecursiveCallError'
                  }
                })

                // 继续发送文本增量，保持流的连续性
                controller.enqueue({
                  type: 'text-delta',
                  textDelta: '\n\n[工具执行后递归调用失败，继续对话...]'
                })
              }
            }

            // 清理状态
            textBuffer = ''
            executedResults = []
            return
          }

          // 对于其他类型的事件，直接传递
          controller.enqueue(chunk)
        },

        flush() {
          // 流结束时的清理工作
          console.log('[MCP Prompt] Stream ended, cleaning up...')
        }
      })
    }
  }
})
