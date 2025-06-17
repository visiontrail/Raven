/**
 * AI Core 类型定义
 * 直接使用 Vercel AI SDK 的原生类型
 */

// 直接重新导出 AI SDK 的类型，避免重复定义
export type {
  // 通用类型
  CoreMessage,
  CoreTool,
  CoreToolChoice,
  // 其他有用的类型
  FinishReason,
  GenerateTextResult,
  LanguageModelV1,
  // 核心函数的参数和返回类型
  StreamTextResult,
  // 流式处理相关
  TextStreamPart,
  ToolSet
} from 'ai'

/**
 * 生命周期阶段定义
 */
export enum LifecycleStage {
  PRE_REQUEST = 'pre-request', // 请求预处理
  REQUEST_EXECUTION = 'execution', // 请求执行
  STREAM_PROCESSING = 'stream', // 流式处理（仅流模式）
  POST_RESPONSE = 'post-response', // 响应后处理
  ERROR_HANDLING = 'error' // 错误处理
}

/**
 * 生命周期上下文
 */
export interface LifecycleContext {
  currentStage: LifecycleStage
  startTime: number
  stageStartTime: number
  completedStages: Set<LifecycleStage>
  stageDurations: Map<LifecycleStage, number>
  metadata: Record<string, any>
}

/**
 * 中间件执行上下文
 */
export interface AiRequestContext {
  // 生命周期信息
  lifecycle: LifecycleContext

  // 请求信息
  method: 'streamText' | 'generateText'
  providerId: string
  originalParams: any // 使用 any，让 AI SDK 自己处理类型检查

  // 可变状态
  state: {
    transformedParams?: any
    result?: any
    error?: Error
    aborted?: boolean
    metadata: Record<string, any>
  }
}
