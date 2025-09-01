/**
 * 锁定设置配置文件
 * 包含系统使用的三个主要Provider的API配置
 * 启用锁定模式后禁止用户修改任何设置
 */

// 是否启用锁定模式（设为true时禁用所有用户输入）
export const LOCKED_MODE_ENABLED = true

// 预定义的API密钥（按Provider ID分组）
export const LOCKED_API_KEYS = {
  // 主要使用的三个Provider
  deepseek: 'sk-2b0270e6881340a7ba2c10757d070d78', // 深度求索
  dashscope: 'sk-f580e7deed644abd961ca8d1f8a63115', // 通义千问（bailian）
  gemini: 'AIzaSyA5I8ugEa7PYCSQVqkEsINCYqYVPgDisn0' // 谷歌Gemini
} as const

// 预定义的API Host（按Provider ID分组）
export const LOCKED_API_HOSTS = {
  deepseek: 'https://api.deepseek.com/',
  dashscope: 'https://dashscope.aliyuncs.com/compatible-mode/v1/', // 通义千问（bailian）
  gemini: 'https://generativelanguage.googleapis.com/'
} as const

// 预定义的API版本（如有需要）
export const LOCKED_API_VERSIONS = {
  // 当前使用的providers不需要特定版本号
} as const

// 其他锁定设置
export const LOCKED_SETTINGS = {
  // 功能禁用控制
  DISABLE_PROVIDER_ADDITION: true,
  DISABLE_MODEL_ADDITION: true,
  DISABLE_API_KEY_EDITING: true,
  DISABLE_API_HOST_EDITING: true,
  DISABLE_PROVIDER_DELETION: true,
  DISABLE_MODEL_DELETION: true,
  // 添加缺失的属性
  LMSTUDIO_KEEP_ALIVE: 0,
  VERTEX_AI_SERVICE_ACCOUNT: {
    clientEmail: '',
    privateKey: ''
  },
  VERTEX_AI_PROJECT_ID: '',
  VERTEX_AI_LOCATION: '',
  DMXAPI_PLATFORM: ''
} as const

// 获取锁定的API Key
export function getLockedApiKey(providerId: string): string {
  if (!LOCKED_MODE_ENABLED) return ''
  return LOCKED_API_KEYS[providerId as keyof typeof LOCKED_API_KEYS] || ''
}

// 获取锁定的API Host
export function getLockedApiHost(providerId: string): string {
  if (!LOCKED_MODE_ENABLED) return ''
  return LOCKED_API_HOSTS[providerId as keyof typeof LOCKED_API_HOSTS] || ''
}

// 获取锁定的API版本
export function getLockedApiVersion(providerId: string): string {
  if (!LOCKED_MODE_ENABLED) return ''
  return LOCKED_API_VERSIONS[providerId as keyof typeof LOCKED_API_VERSIONS] || ''
}

// 检查是否启用锁定模式
export function isLockedModeEnabled(): boolean {
  return LOCKED_MODE_ENABLED
}

// 检查特定功能是否被禁用
export function isFeatureDisabled(feature: keyof typeof LOCKED_SETTINGS): boolean {
  if (!LOCKED_MODE_ENABLED) return false
  return LOCKED_SETTINGS[feature] === true
}
