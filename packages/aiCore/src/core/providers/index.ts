/**
 * Providers 模块统一导出 - 现代化架构
 */

// ==================== 新版动态Registry（推荐使用）====================

// 基于AI SDK原生的动态Provider注册表
export { DynamicProviderRegistry, globalDynamicRegistry } from './DynamicProviderRegistry'

// ==================== 保留的导出（兼容性）====================

// 基础Provider数据源
export { baseProviderIds, baseProviders } from './schemas'

// 类型定义（可能被其他模块使用）
export type { ProviderConfig, ProviderId, ProviderSettingsMap } from './types'

// Provider创建功能（可能被其他地方使用）
export { createImageProvider, createProvider, ProviderCreationError, validateProviderConfig } from './creator'

// 验证功能（可能被其他地方使用）
export { validateProviderId } from './schemas'
