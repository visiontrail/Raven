/**
 * Providers 模块统一导出 - 现代化架构
 */

// ==================== 新版架构（推荐使用）====================

// Provider 注册表管理器
export { globalRegistryManagement, RegistryManagement } from './RegistryManagement'

// Provider 初始化器（核心功能）
export {
  clearAllProviders,
  getImageModel,
  getInitializedProviders,
  getLanguageModel,
  getProviderInfo,
  getSupportedProviders,
  getTextEmbeddingModel,
  hasInitializedProviders,
  // initializeImageProvider, // deprecated: 使用 initializeProvider 即可
  initializeProvider,
  initializeProviders,
  isProviderInitialized,
  isProviderSupported,
  ProviderInitializationError,
  ProviderInitializer,
  providerRegistry,
  reinitializeProvider
} from './registry'

// 动态Provider注册功能
export {
  cleanup,
  getAllAliases,
  getAllDynamicMappings,
  getDynamicProviders,
  getProviderMapping,
  isAlias,
  isDynamicProvider,
  registerDynamicProvider,
  registerMultipleProviders,
  resolveProviderId
} from './registry'

// ==================== 保留的导出（兼容性）====================

// 基础Provider数据源
export { baseProviderIds, baseProviders } from './schemas'

// Hub Provider 功能
export { createHubProvider, type HubProviderConfig, HubProviderError } from './HubProvider'

// 类型定义（可能被其他模块使用）
export type { ProviderConfig, ProviderId, ProviderSettingsMap } from './types'

// Provider验证功能（使用更好的Zod版本）
export { validateProviderConfig } from './schemas'

// 验证功能（可能被其他地方使用）
export { validateProviderId } from './schemas'
