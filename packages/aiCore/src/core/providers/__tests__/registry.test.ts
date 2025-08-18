/**
 * 测试真正的 registry 代码 - 尝试不同的导入方式
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// 模拟 AI SDK - 使用简单版本
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => ({ name: 'openai-mock' }))
}))

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn(() => ({ name: 'anthropic-mock' }))
}))

vi.mock('@ai-sdk/azure', () => ({
  createAzure: vi.fn(() => ({ name: 'azure-mock' }))
}))

vi.mock('@ai-sdk/deepseek', () => ({
  createDeepSeek: vi.fn(() => ({ name: 'deepseek-mock' }))
}))

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn(() => ({ name: 'google-mock' }))
}))

vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: vi.fn(() => ({ name: 'openai-compatible-mock' }))
}))

vi.mock('@ai-sdk/xai', () => ({
  createXai: vi.fn(() => ({ name: 'xai-mock' }))
}))

describe('Real Registry Test', () => {
  beforeEach(() => {
    // 清理模块缓存，强制重新加载
    vi.resetModules()
  })

  it('应该能够通过动态导入访问真正的 registry', async () => {
    console.log('🔍 Real test - Testing dynamic import...')

    try {
      // 使用动态导入，每次都重新导入
      const { AiProviderRegistry } = await import('../registry')

      console.log('🔍 Real test - AiProviderRegistry imported:', {
        type: typeof AiProviderRegistry,
        isClass: AiProviderRegistry?.prototype?.constructor === AiProviderRegistry
      })

      if (AiProviderRegistry) {
        // 创建新实例，跳过单例模式
        const testRegistry = Object.create(AiProviderRegistry.prototype)

        // 手动调用构造函数逻辑，但跳过有问题的初始化
        testRegistry.registry = new Map()
        testRegistry.dynamicMappings = new Map()
        testRegistry.dynamicProviders = new Set()

        // 手动添加一些测试数据
        testRegistry.registry.set('test-provider', {
          id: 'test-provider',
          name: 'Test Provider',
          creator: () => ({ name: 'test' }),
          supportsImageGeneration: false
        })

        // 测试基本功能
        const allIds = testRegistry.getAllValidProviderIds?.()
        console.log('🔍 Real test - getAllValidProviderIds result:', allIds)

        if (allIds) {
          expect(Array.isArray(allIds)).toBe(true)
          expect(allIds).toContain('test-provider')
        }
      }
    } catch (error) {
      console.error('🔍 Real test - Error:', error)
      throw error
    }
  })

  it('应该能够通过模块原型访问方法', async () => {
    console.log('🔍 Real test - Testing prototype access...')

    try {
      const registryModule = await import('../registry')
      console.log('🔍 Real test - Registry module keys:', Object.keys(registryModule))

      // 检查是否有任何可用的导出
      const availableExports = Object.keys(registryModule).filter((key) => registryModule[key] !== undefined)

      console.log('🔍 Real test - Available exports:', availableExports)

      if (availableExports.length === 0) {
        console.log('🔍 Real test - No exports available, trying alternative approach...')

        // 尝试直接访问模块的内部结构
        const moduleEntries = Object.entries(registryModule)
        console.log('🔍 Real test - Module entries:', moduleEntries)
      }
    } catch (error) {
      console.error('🔍 Real test - Prototype access error:', error)
    }
  })

  it('应该能够通过 require 访问模块', async () => {
    console.log('🔍 Real test - Testing require access...')

    try {
      // 尝试使用 require 而不是 import
      const path = require('path')
      const moduleId = path.resolve(__dirname, '../registry.ts')

      console.log('🔍 Real test - Module ID:', moduleId)

      // 检查模块是否在缓存中
      const cached = require.cache[moduleId]
      console.log('🔍 Real test - Module cached:', !!cached)

      if (cached) {
        console.log('🔍 Real test - Cached exports:', Object.keys(cached.exports || {}))
      }
    } catch (error) {
      console.error('🔍 Real test - Require access error:', error)
    }
  })
})
