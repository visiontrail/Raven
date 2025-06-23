/**
 * Execution 模块导出
 * 提供执行器能力
 */

// 主要执行器
export { AiExecutor } from './AiExecutor'
export type { ExecutionOptions, ExecutorConfig, GenericExecutorConfig } from './types'

// 便捷工厂函数
import { type ProviderId, type ProviderSettingsMap } from '../../types'
import { type AiPlugin } from '../plugins'
import { AiExecutor } from './AiExecutor'

/**
 * 创建AI执行器 - 支持类型安全的已知provider
 */
export function createExecutor<T extends ProviderId>(
  providerId: T,
  options: ProviderSettingsMap[T],
  plugins?: AiPlugin[]
): AiExecutor<T>

/**
 * 创建AI执行器 - 支持未知provider
 */
export function createExecutor(providerId: string, options: any, plugins?: AiPlugin[]): AiExecutor<any>

export function createExecutor(providerId: string, options: any, plugins: AiPlugin[] = []): AiExecutor {
  return AiExecutor.create(providerId, plugins)
}

/**
 * 创建OpenAI Compatible执行器
 */
export function createOpenAICompatibleExecutor(
  options: ProviderSettingsMap['openai-compatible'],
  plugins: AiPlugin[] = []
): AiExecutor<'openai-compatible'> {
  return AiExecutor.createOpenAICompatible(plugins)
}

// 为了未来的agent功能预留目录结构
// 未来将在 ./agents/ 文件夹中添加：
// - AgentExecutor.ts
// - WorkflowManager.ts
// - ConversationManager.ts
