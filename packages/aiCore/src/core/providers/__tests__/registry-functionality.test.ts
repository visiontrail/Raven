/**
 * 测试真正的 AiProviderRegistry 功能
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// 模拟 AI SDK
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

import {
  AiProviderRegistry,
  cleanup,
  getAllDynamicMappings,
  getAllProviders,
  getAllValidProviderIds,
  getDynamicProviders,
  getProvider,
  getProviderMapping,
  isDynamicProvider,
  isProviderSupported,
  registerDynamicProvider,
  registerMultipleProviders,
  registerProvider,
  validateProviderIdRegistry
} from '../registry'
import type { DynamicProviderRegistration, ProviderConfig } from '../schemas'

describe('AiProviderRegistry 功能测试', () => {
  beforeEach(() => {
    // 清理状态
    cleanup()
  })

  describe('基础功能', () => {
    it('能够获取所有 providers', () => {
      const providers = getAllProviders()
      expect(Array.isArray(providers)).toBe(true)
      expect(providers.length).toBeGreaterThan(0)

      // 包含基础 providers
      const providerIds = providers.map((p) => p.id)
      expect(providerIds).toContain('openai')
      expect(providerIds).toContain('anthropic')
      expect(providerIds).toContain('google')
    })

    it('能够检查 provider 支持状态', () => {
      expect(isProviderSupported('openai')).toBe(true)
      expect(isProviderSupported('anthropic')).toBe(true)
      expect(isProviderSupported('google')).toBe(true)
      expect(isProviderSupported('non-existent')).toBe(true) // validateProviderId 通过
      expect(isProviderSupported('')).toBe(false)
    })

    it('能够获取有效的 provider IDs', () => {
      const allIds = getAllValidProviderIds()
      expect(Array.isArray(allIds)).toBe(true)
      expect(allIds).toContain('openai')
      expect(allIds).toContain('anthropic')
    })

    it('能够根据 ID 获取特定的 provider', () => {
      // 获取存在的 provider
      const openaiProvider = getProvider('openai')
      expect(openaiProvider).toBeDefined()
      expect(openaiProvider?.id).toBe('openai')
      expect(openaiProvider?.name).toBe('OpenAI')

      // 获取不存在的 provider，fallback到openai-compatible
      const nonExistentProvider = getProvider('non-existent')
      expect(nonExistentProvider).toBeDefined()
      expect(nonExistentProvider?.id).toBe('openai-compatible')
    })

    it('能够验证 provider ID', () => {
      expect(validateProviderIdRegistry('valid-id')).toBe(true)
      expect(validateProviderIdRegistry('another-valid-id')).toBe(true)
      expect(validateProviderIdRegistry('')).toBe(false)
      // 注意：单个空格字符被认为是有效的，因为它不是空字符串
      // 如果需要更严格的验证，schemas 包含更多验证规则
      expect(validateProviderIdRegistry(' ')).toBe(true)
    })
  })

  describe('动态 Provider 注册', () => {
    it('能够注册动态 provider', () => {
      const config = {
        id: 'custom-provider',
        name: 'Custom Provider',
        creator: vi.fn(() => ({ name: 'custom' })),
        supportsImageGeneration: false
      }

      const success = registerDynamicProvider(config)
      expect(success).toBe(true)

      expect(isDynamicProvider('custom-provider')).toBe(true)
      expect(isProviderSupported('custom-provider')).toBe(true)

      const allIds = getAllValidProviderIds()
      expect(allIds).toContain('custom-provider')
    })

    it('拒绝与基础 provider 冲突的配置', () => {
      const config = {
        id: 'openai',
        name: 'Duplicate OpenAI',
        creator: vi.fn(() => ({ name: 'duplicate' })),
        supportsImageGeneration: false
      }

      const success = registerDynamicProvider(config)
      expect(success).toBe(false)
      expect(isDynamicProvider('openai')).toBe(false)
    })

    it('拒绝无效的配置', () => {
      // 缺少必要字段
      const invalidConfig = {
        id: 'invalid-provider'
        // 缺少 name, creator 等
      }

      const success = registerDynamicProvider(invalidConfig as any)
      expect(success).toBe(false)
    })

    it('能够批量注册动态 providers', () => {
      const configs: DynamicProviderRegistration[] = [
        {
          id: 'provider-1',
          name: 'Provider 1',
          creator: vi.fn(() => ({ name: 'provider-1' })),
          supportsImageGeneration: false
        },
        {
          id: 'provider-2',
          name: 'Provider 2',
          creator: vi.fn(() => ({ name: 'provider-2' })),
          supportsImageGeneration: true
        },
        {
          id: 'openai', // 这个失败，因为与基础 provider 冲突
          name: 'Invalid Provider',
          creator: vi.fn(() => ({ name: 'invalid' })),
          supportsImageGeneration: false
        }
      ]

      const successCount = registerMultipleProviders(configs)
      expect(successCount).toBe(2) // 只有前两个成功

      expect(isDynamicProvider('provider-1')).toBe(true)
      expect(isDynamicProvider('provider-2')).toBe(true)
      expect(isDynamicProvider('openai')).toBe(false) // 基础 provider，不是动态的
    })

    it('支持带映射关系的动态 provider', () => {
      const configWithMappings: DynamicProviderRegistration = {
        id: 'custom-provider-with-mappings',
        name: 'Custom Provider with Mappings',
        creator: vi.fn(() => ({ name: 'custom-mapped' })),
        supportsImageGeneration: false,
        mappings: {
          'custom-alias-1': 'custom-provider-with-mappings',
          'custom-alias-2': 'custom-provider-with-mappings'
        }
      }

      const success = registerDynamicProvider(configWithMappings)
      expect(success).toBe(true)

      // 验证映射关系
      expect(getProviderMapping('custom-alias-1')).toBe('custom-provider-with-mappings')
      expect(getProviderMapping('custom-alias-2')).toBe('custom-provider-with-mappings')
      expect(getProviderMapping('custom-provider-with-mappings')).toBe('custom-provider-with-mappings')
    })
  })

  describe('Registry 管理', () => {
    it('能够清理动态 providers', () => {
      // 注册动态 provider
      registerDynamicProvider({
        id: 'temp-provider',
        name: 'Temp Provider',
        creator: vi.fn(() => ({ name: 'temp' })),
        supportsImageGeneration: false
      })

      expect(isDynamicProvider('temp-provider')).toBe(true)

      // 清理
      cleanup()

      expect(isDynamicProvider('temp-provider')).toBe(false)
      expect(isProviderSupported('openai')).toBe(true) // 基础 providers 仍存在
    })

    it('保持单例模式', () => {
      const instance1 = AiProviderRegistry.getInstance()
      const instance2 = AiProviderRegistry.getInstance()
      expect(instance1).toBe(instance2)
    })

    it('能够注册基础 provider', () => {
      const customConfig: ProviderConfig = {
        id: 'custom-base-provider',
        name: 'Custom Base Provider',
        creator: vi.fn(() => ({ name: 'custom-base' })),
        supportsImageGeneration: false
      }

      // 注册基础 provider 不抛出错误
      expect(() => registerProvider(customConfig)).not.toThrow()

      // 验证注册成功
      const registeredProvider = getProvider('custom-base-provider')
      expect(registeredProvider).toBeDefined()
      expect(registeredProvider?.id).toBe('custom-base-provider')
      expect(registeredProvider?.name).toBe('Custom Base Provider')
    })

    it('能够获取动态 providers 列表', () => {
      // 初始状态没有动态 providers
      expect(getDynamicProviders()).toEqual([])

      // 注册一些动态 providers
      registerDynamicProvider({
        id: 'dynamic-1',
        name: 'Dynamic 1',
        creator: vi.fn(() => ({ name: 'dynamic-1' })),
        supportsImageGeneration: false
      })

      registerDynamicProvider({
        id: 'dynamic-2',
        name: 'Dynamic 2',
        creator: vi.fn(() => ({ name: 'dynamic-2' })),
        supportsImageGeneration: true
      })

      const dynamicProviders = getDynamicProviders()
      expect(Array.isArray(dynamicProviders)).toBe(true)
      expect(dynamicProviders).toContain('dynamic-1')
      expect(dynamicProviders).toContain('dynamic-2')
      expect(dynamicProviders.length).toBe(2)
    })

    it('能够获取所有动态映射', () => {
      // 初始状态没有动态映射
      expect(getAllDynamicMappings()).toEqual({})

      // 注册带映射的动态 provider
      registerDynamicProvider({
        id: 'mapped-provider',
        name: 'Mapped Provider',
        creator: vi.fn(() => ({ name: 'mapped' })),
        supportsImageGeneration: false,
        mappings: {
          'alias-1': 'mapped-provider',
          'alias-2': 'mapped-provider',
          'custom-name': 'mapped-provider'
        }
      })

      const allMappings = getAllDynamicMappings()
      expect(allMappings).toEqual({
        'alias-1': 'mapped-provider',
        'alias-2': 'mapped-provider',
        'custom-name': 'mapped-provider'
      })
    })
  })

  describe('错误处理', () => {
    it('优雅处理空配置', () => {
      const success = registerDynamicProvider(null as any)
      expect(success).toBe(false)
    })

    it('优雅处理未定义配置', () => {
      const success = registerDynamicProvider(undefined as any)
      expect(success).toBe(false)
    })

    it('处理空字符串 ID', () => {
      const config = {
        id: '',
        name: 'Empty ID Provider',
        creator: vi.fn(() => ({ name: 'empty' })),
        supportsImageGeneration: false
      }

      const success = registerDynamicProvider(config)
      expect(success).toBe(false)
    })

    it('处理注册基础 provider 时的无效 ID', () => {
      const invalidConfig: ProviderConfig = {
        id: '', // 无效 ID
        name: 'Invalid Provider',
        creator: vi.fn(() => ({ name: 'invalid' })),
        supportsImageGeneration: false
      }

      expect(() => registerProvider(invalidConfig)).toThrow('Invalid provider ID:')
    })

    it('处理获取不存在映射时的情况', () => {
      expect(getProviderMapping('non-existent-mapping')).toBeUndefined()
    })

    it('处理批量注册时的部分失败', () => {
      const mixedConfigs: DynamicProviderRegistration[] = [
        {
          id: 'valid-provider-1',
          name: 'Valid Provider 1',
          creator: vi.fn(() => ({ name: 'valid-1' })),
          supportsImageGeneration: false
        },
        {
          id: '', // 无效配置
          name: 'Invalid Provider',
          creator: vi.fn(() => ({ name: 'invalid' })),
          supportsImageGeneration: false
        },
        {
          id: 'valid-provider-2',
          name: 'Valid Provider 2',
          creator: vi.fn(() => ({ name: 'valid-2' })),
          supportsImageGeneration: true
        }
      ]

      const successCount = registerMultipleProviders(mixedConfigs)
      expect(successCount).toBe(2) // 只有两个有效配置成功

      expect(isDynamicProvider('valid-provider-1')).toBe(true)
      expect(isDynamicProvider('valid-provider-2')).toBe(true)
      expect(getDynamicProviders()).not.toContain('')
    })
  })

  describe('集成测试', () => {
    it('正确处理复杂的注册、映射和清理场景', () => {
      // 初始状态验证
      const initialProviders = getAllProviders()
      const initialIds = getAllValidProviderIds()
      expect(initialProviders.length).toBeGreaterThan(0)
      expect(getDynamicProviders()).toEqual([])
      expect(getAllDynamicMappings()).toEqual({})

      // 注册多个带映射的动态 providers
      const configs: DynamicProviderRegistration[] = [
        {
          id: 'integration-provider-1',
          name: 'Integration Provider 1',
          creator: vi.fn(() => ({ name: 'integration-1' })),
          supportsImageGeneration: false,
          mappings: {
            'alias-1': 'integration-provider-1',
            'short-name-1': 'integration-provider-1'
          }
        },
        {
          id: 'integration-provider-2',
          name: 'Integration Provider 2',
          creator: vi.fn(() => ({ name: 'integration-2' })),
          supportsImageGeneration: true,
          mappings: {
            'alias-2': 'integration-provider-2',
            'short-name-2': 'integration-provider-2'
          }
        }
      ]

      const successCount = registerMultipleProviders(configs)
      expect(successCount).toBe(2)

      // 验证注册后的状态
      const afterRegisterProviders = getAllProviders()
      const afterRegisterIds = getAllValidProviderIds()
      expect(afterRegisterProviders.length).toBe(initialProviders.length + 2)
      expect(afterRegisterIds.length).toBeGreaterThanOrEqual(initialIds.length + 2)

      // 验证动态 providers
      const dynamicProviders = getDynamicProviders()
      expect(dynamicProviders).toContain('integration-provider-1')
      expect(dynamicProviders).toContain('integration-provider-2')

      // 验证映射
      const mappings = getAllDynamicMappings()
      expect(mappings['alias-1']).toBe('integration-provider-1')
      expect(mappings['alias-2']).toBe('integration-provider-2')
      expect(mappings['short-name-1']).toBe('integration-provider-1')
      expect(mappings['short-name-2']).toBe('integration-provider-2')

      // 验证通过映射能够获取 provider
      expect(getProviderMapping('alias-1')).toBe('integration-provider-1')
      expect(getProviderMapping('integration-provider-1')).toBe('integration-provider-1')

      // 清理
      cleanup()

      // 验证清理后的状态
      const afterCleanupProviders = getAllProviders()
      const afterCleanupIds = getAllValidProviderIds()
      expect(afterCleanupProviders.length).toBe(initialProviders.length)
      expect(afterCleanupIds.length).toBe(initialIds.length)
      expect(getDynamicProviders()).toEqual([])
      expect(getAllDynamicMappings()).toEqual({})
    })

    it('正确处理 provider 的优先级和 fallback 机制', () => {
      // 验证 getProvider 的 fallback 机制
      const existingProvider = getProvider('openai')
      expect(existingProvider?.id).toBe('openai')

      const nonExistentProvider = getProvider('definitely-non-existent')
      expect(nonExistentProvider?.id).toBe('openai-compatible') // fallback

      // 注册自定义 provider 后能直接获取
      registerDynamicProvider({
        id: 'priority-test-provider',
        name: 'Priority Test Provider',
        creator: vi.fn(() => ({ name: 'priority-test' })),
        supportsImageGeneration: false
      })

      const customProvider = getProvider('priority-test-provider')
      expect(customProvider?.id).toBe('priority-test-provider')
      expect(customProvider?.name).toBe('Priority Test Provider')
    })

    it('正确处理大量动态 providers 的注册和管理', () => {
      const largeConfigList: DynamicProviderRegistration[] = []

      // 生成100个动态 providers
      for (let i = 0; i < 100; i++) {
        largeConfigList.push({
          id: `bulk-provider-${i}`,
          name: `Bulk Provider ${i}`,
          creator: vi.fn(() => ({ name: `bulk-${i}` })),
          supportsImageGeneration: i % 2 === 0, // 偶数支持图像生成
          mappings: {
            [`alias-${i}`]: `bulk-provider-${i}`,
            [`short-${i}`]: `bulk-provider-${i}`
          }
        })
      }

      const successCount = registerMultipleProviders(largeConfigList)
      expect(successCount).toBe(100)

      // 验证所有 providers 都被正确注册
      const dynamicProviders = getDynamicProviders()
      expect(dynamicProviders.length).toBe(100)

      // 验证映射数量
      const mappings = getAllDynamicMappings()
      expect(Object.keys(mappings).length).toBe(200) // 每个 provider 有2个映射

      // 随机验证几个 providers
      expect(isDynamicProvider('bulk-provider-0')).toBe(true)
      expect(isDynamicProvider('bulk-provider-50')).toBe(true)
      expect(isDynamicProvider('bulk-provider-99')).toBe(true)

      // 验证映射工作正常
      expect(getProviderMapping('alias-25')).toBe('bulk-provider-25')
      expect(getProviderMapping('short-75')).toBe('bulk-provider-75')

      // 清理能正确处理大量数据
      cleanup()
      expect(getDynamicProviders()).toEqual([])
      expect(getAllDynamicMappings()).toEqual({})
    })
  })

  describe('边界测试', () => {
    it('处理包含特殊字符的 provider IDs', () => {
      const specialCharsConfigs: DynamicProviderRegistration[] = [
        {
          id: 'provider-with-dashes',
          name: 'Provider With Dashes',
          creator: vi.fn(() => ({ name: 'dashes' })),
          supportsImageGeneration: false
        },
        {
          id: 'provider_with_underscores',
          name: 'Provider With Underscores',
          creator: vi.fn(() => ({ name: 'underscores' })),
          supportsImageGeneration: false
        },
        {
          id: 'provider.with.dots',
          name: 'Provider With Dots',
          creator: vi.fn(() => ({ name: 'dots' })),
          supportsImageGeneration: false
        }
      ]

      const successCount = registerMultipleProviders(specialCharsConfigs)
      expect(successCount).toBeGreaterThan(0) // 至少有一些成功

      // 验证支持的特殊字符格式
      if (isDynamicProvider('provider-with-dashes')) {
        expect(getProvider('provider-with-dashes')).toBeDefined()
      }
      if (isDynamicProvider('provider_with_underscores')) {
        expect(getProvider('provider_with_underscores')).toBeDefined()
      }
    })

    it('处理空的批量注册', () => {
      const successCount = registerMultipleProviders([])
      expect(successCount).toBe(0)
      expect(getDynamicProviders()).toEqual([])
    })

    it('处理重复的 provider 注册', () => {
      const config: DynamicProviderRegistration = {
        id: 'duplicate-test-provider',
        name: 'Duplicate Test Provider',
        creator: vi.fn(() => ({ name: 'duplicate' })),
        supportsImageGeneration: false
      }

      // 第一次注册成功
      expect(registerDynamicProvider(config)).toBe(true)
      expect(isDynamicProvider('duplicate-test-provider')).toBe(true)

      // 重复注册相同的 provider
      expect(registerDynamicProvider(config)).toBe(true) // 允许覆盖
      expect(isDynamicProvider('duplicate-test-provider')).toBe(true)

      // 验证只有一个实例
      const dynamicProviders = getDynamicProviders()
      const duplicateCount = dynamicProviders.filter((id) => id === 'duplicate-test-provider').length
      expect(duplicateCount).toBe(1)
    })
  })
})
