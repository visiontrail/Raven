/**
 * Execution 层类型定义
 */
import { type ProviderId } from '../../types'
import { type AiPlugin } from '../plugins'

/**
 * 执行器配置
 */
export interface ExecutorConfig<T extends ProviderId = ProviderId> {
  providerId: T
  plugins?: AiPlugin[]
}

/**
 * 通用执行器配置（用于未知provider）
 */
export interface GenericExecutorConfig {
  providerId: string
  plugins?: AiPlugin[]
}

/**
 * 执行选项
 */
export interface ExecutionOptions {
  // 未来可以添加执行级别的选项
  // 比如：超时设置、重试机制等
}
