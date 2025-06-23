/**
 * 编排层导出
 * 面向用户的编排层接口
 */

// 主要编排函数
export { generateObject, generateText, streamObject, streamText } from './api'

// 类型定义
export type { OrchestrationConfig } from './types'

// 为了向后兼容，重新导出AiExecutor
export { AiExecutor } from '../core/execution/AiExecutor'
