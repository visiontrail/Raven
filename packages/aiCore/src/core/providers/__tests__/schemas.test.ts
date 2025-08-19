import { describe, expect, it, vi } from 'vitest'

import {
  type BaseProviderId,
  baseProviderIds,
  baseProviderIdSchema,
  baseProviders,
  type DynamicProviderId,
  dynamicProviderIdSchema,
  dynamicProviderRegistrationSchema,
  getBaseProviderConfig,
  isBaseProviderId,
  isValidDynamicProviderId,
  providerConfigSchema,
  type ProviderId,
  providerIdSchema,
  validateDynamicProviderRegistration,
  validateProviderConfig,
  validateProviderId
} from '../schemas'

describe('Provider Schemas', () => {
  describe('baseProviders', () => {
    it('包含所有预期的基础 providers', () => {
      expect(baseProviders).toBeDefined()
      expect(Array.isArray(baseProviders)).toBe(true)
      expect(baseProviders.length).toBeGreaterThan(0)

      const expectedIds = [
        'openai',
        'openai-responses',
        'openai-compatible',
        'anthropic',
        'google',
        'xai',
        'azure',
        'deepseek'
      ]
      const actualIds = baseProviders.map((p) => p.id)
      expectedIds.forEach((id) => {
        expect(actualIds).toContain(id)
      })
    })

    it('每个基础 provider 有必要的属性', () => {
      baseProviders.forEach((provider) => {
        expect(provider).toHaveProperty('id')
        expect(provider).toHaveProperty('name')
        expect(provider).toHaveProperty('creator')
        expect(provider).toHaveProperty('supportsImageGeneration')

        expect(typeof provider.id).toBe('string')
        expect(typeof provider.name).toBe('string')
        expect(typeof provider.creator).toBe('function')
        expect(typeof provider.supportsImageGeneration).toBe('boolean')
      })
    })

    it('provider ID 是唯一的', () => {
      const ids = baseProviders.map((p) => p.id)
      const uniqueIds = [...new Set(ids)]
      expect(ids).toEqual(uniqueIds)
    })
  })

  describe('baseProviderIds', () => {
    it('正确提取所有基础 provider IDs', () => {
      expect(baseProviderIds).toBeDefined()
      expect(Array.isArray(baseProviderIds)).toBe(true)
      expect(baseProviderIds.length).toBe(baseProviders.length)

      baseProviders.forEach((provider) => {
        expect(baseProviderIds).toContain(provider.id)
      })
    })
  })

  describe('baseProviderIdSchema', () => {
    it('验证有效的基础 provider IDs', () => {
      baseProviderIds.forEach((id) => {
        expect(baseProviderIdSchema.safeParse(id).success).toBe(true)
      })
    })

    it('拒绝无效的基础 provider IDs', () => {
      const invalidIds = ['invalid', 'not-exists', '']
      invalidIds.forEach((id) => {
        expect(baseProviderIdSchema.safeParse(id).success).toBe(false)
      })
    })
  })

  describe('dynamicProviderIdSchema', () => {
    it('接受有效的动态 provider IDs', () => {
      const validIds = ['custom-provider', 'my-ai-service', 'company-llm-v2']
      validIds.forEach((id) => {
        expect(dynamicProviderIdSchema.safeParse(id).success).toBe(true)
      })
    })

    it('拒绝与基础 provider IDs 冲突的 IDs', () => {
      baseProviderIds.forEach((id) => {
        expect(dynamicProviderIdSchema.safeParse(id).success).toBe(false)
      })
    })

    it('拒绝空字符串', () => {
      expect(dynamicProviderIdSchema.safeParse('').success).toBe(false)
    })
  })

  describe('providerIdSchema', () => {
    it('接受基础 provider IDs', () => {
      baseProviderIds.forEach((id) => {
        expect(providerIdSchema.safeParse(id).success).toBe(true)
      })
    })

    it('接受有效的动态 provider IDs', () => {
      const validDynamicIds = ['custom-provider', 'my-ai-service']
      validDynamicIds.forEach((id) => {
        expect(providerIdSchema.safeParse(id).success).toBe(true)
      })
    })

    it('拒绝无效的 IDs', () => {
      const invalidIds = ['', undefined, null, 123]
      invalidIds.forEach((id) => {
        expect(providerIdSchema.safeParse(id).success).toBe(false)
      })
    })
  })

  describe('providerConfigSchema', () => {
    it('验证带有 creator 的有效配置', () => {
      const validConfig = {
        id: 'openai',
        name: 'OpenAI',
        creator: vi.fn(),
        supportsImageGeneration: true
      }
      expect(providerConfigSchema.safeParse(validConfig).success).toBe(true)
    })

    it('验证带有 import 配置的有效配置', () => {
      const validConfig = {
        id: 'custom-provider',
        name: 'Custom Provider',
        import: vi.fn(),
        creatorFunctionName: 'createCustom',
        supportsImageGeneration: false
      }
      expect(providerConfigSchema.safeParse(validConfig).success).toBe(true)
    })

    it('拒绝既没有 creator 也没有 import 配置的配置', () => {
      const invalidConfig = {
        id: 'invalid',
        name: 'Invalid Provider',
        supportsImageGeneration: false
      }
      expect(providerConfigSchema.safeParse(invalidConfig).success).toBe(false)
    })

    it('为 supportsImageGeneration 设置默认值', () => {
      const config = {
        id: 'test',
        name: 'Test',
        creator: vi.fn()
      }
      const result = providerConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.supportsImageGeneration).toBe(false)
      }
    })

    it('拒绝缺少必需字段的配置', () => {
      const invalidConfigs = [
        { name: 'Missing ID', creator: vi.fn() },
        { id: 'missing-name', creator: vi.fn() },
        { id: '', name: 'Empty ID', creator: vi.fn() },
        { id: 'valid', name: '', creator: vi.fn() }
      ]

      invalidConfigs.forEach((config) => {
        expect(providerConfigSchema.safeParse(config).success).toBe(false)
      })
    })
  })

  describe('dynamicProviderRegistrationSchema', () => {
    it('验证有效的动态 provider 注册配置', () => {
      const validConfig = {
        id: 'custom-provider',
        name: 'Custom Provider',
        creator: vi.fn(),
        supportsImageGeneration: true,
        mappings: { model1: 'mapped-model1' }
      }
      expect(dynamicProviderRegistrationSchema.safeParse(validConfig).success).toBe(true)
    })

    it('拒绝使用基础 provider ID 的配置', () => {
      const invalidConfig = {
        id: 'openai',
        name: 'Should Fail',
        creator: vi.fn()
      }
      expect(dynamicProviderRegistrationSchema.safeParse(invalidConfig).success).toBe(false)
    })

    it('要求 creator 或 import 配置', () => {
      const configWithoutCreator = {
        id: 'custom-provider',
        name: 'Custom Provider'
      }
      expect(dynamicProviderRegistrationSchema.safeParse(configWithoutCreator).success).toBe(false)
    })
  })

  describe('validateProviderId', () => {
    it('验证基础 provider IDs', () => {
      baseProviderIds.forEach((id) => {
        expect(validateProviderId(id)).toBe(true)
      })
    })

    it('验证有效的动态 provider IDs', () => {
      const validDynamicIds = ['custom-provider', 'my-service', 'company-llm']
      validDynamicIds.forEach((id) => {
        expect(validateProviderId(id)).toBe(true)
      })
    })

    it('拒绝无效的 IDs', () => {
      const invalidIds = [undefined as any, null as any, 123 as any]
      invalidIds.forEach((id) => {
        expect(validateProviderId(id)).toBe(false)
      })

      // 空字符串和只有空格的字符串会被当作有效的动态 provider ID
      expect(validateProviderId('')).toBe(false)
    })
  })

  describe('isBaseProviderId', () => {
    it('正确识别基础 provider IDs', () => {
      baseProviderIds.forEach((id) => {
        expect(isBaseProviderId(id)).toBe(true)
      })
    })

    it('拒绝动态 provider IDs', () => {
      const dynamicIds = ['custom-provider', 'my-service']
      dynamicIds.forEach((id) => {
        expect(isBaseProviderId(id)).toBe(false)
      })
    })

    it('拒绝无效的 IDs', () => {
      const invalidIds = ['', 'invalid', undefined as any]
      invalidIds.forEach((id) => {
        expect(isBaseProviderId(id)).toBe(false)
      })
    })
  })

  describe('isValidDynamicProviderId', () => {
    it('接受有效的动态 provider IDs', () => {
      const validIds = ['custom-provider', 'my-ai-service', 'company-llm-v2']
      validIds.forEach((id) => {
        expect(isValidDynamicProviderId(id)).toBe(true)
      })
    })

    it('拒绝基础 provider IDs', () => {
      baseProviderIds.forEach((id) => {
        expect(isValidDynamicProviderId(id)).toBe(false)
      })
    })

    it('拒绝无效的 IDs', () => {
      const invalidIds = [undefined as any, null as any]
      invalidIds.forEach((id) => {
        expect(isValidDynamicProviderId(id)).toBe(false)
      })

      // 空字符串会被 schema 拒绝
      expect(isValidDynamicProviderId('')).toBe(false)
      // 只有空格的字符串是有效的动态 provider ID（但不推荐使用）
      expect(isValidDynamicProviderId('   ')).toBe(true)
    })
  })

  describe('validateProviderConfig', () => {
    it('返回有效配置', () => {
      const validConfig = {
        id: 'openai',
        name: 'OpenAI',
        creator: vi.fn(),
        supportsImageGeneration: true
      }
      const result = validateProviderConfig(validConfig)
      expect(result).not.toBeNull()
      expect(result?.id).toBe('openai')
      expect(result?.name).toBe('OpenAI')
    })

    it('对无效配置返回 null', () => {
      const invalidConfig = {
        id: '',
        name: 'Invalid'
      }
      const result = validateProviderConfig(invalidConfig)
      expect(result).toBeNull()
    })

    it('处理完全无效的输入', () => {
      const invalidInputs = [undefined, null, 'string', 123, []]
      invalidInputs.forEach((input) => {
        const result = validateProviderConfig(input)
        expect(result).toBeNull()
      })
    })
  })

  describe('validateDynamicProviderRegistration', () => {
    it('返回有效的动态 provider 注册配置', () => {
      const validConfig = {
        id: 'custom-provider',
        name: 'Custom Provider',
        creator: vi.fn(),
        mappings: { model1: 'mapped-model1' }
      }
      const result = validateDynamicProviderRegistration(validConfig)
      expect(result).not.toBeNull()
      expect(result?.id).toBe('custom-provider')
      expect(result?.name).toBe('Custom Provider')
    })

    it('对无效配置返回 null', () => {
      const invalidConfig = {
        id: 'openai',
        name: 'Should Fail'
      }
      const result = validateDynamicProviderRegistration(invalidConfig)
      expect(result).toBeNull()
    })
  })

  describe('getBaseProviderConfig', () => {
    it('返回有效基础 provider ID 的配置', () => {
      const config = getBaseProviderConfig('openai')
      expect(config).toBeDefined()
      expect(config?.id).toBe('openai')
      expect(config?.name).toBe('OpenAI')
      expect(config?.creator).toBeDefined()
    })

    it('对无效 ID 返回 undefined', () => {
      const config = getBaseProviderConfig('invalid' as BaseProviderId)
      expect(config).toBeUndefined()
    })

    it('返回所有基础 providers 的配置', () => {
      baseProviderIds.forEach((id) => {
        const config = getBaseProviderConfig(id)
        expect(config).toBeDefined()
        expect(config?.id).toBe(id)
      })
    })
  })

  describe('类型推导', () => {
    it('BaseProviderId 类型正确', () => {
      const id: BaseProviderId = 'openai'
      expect(baseProviderIds).toContain(id)
    })

    it('DynamicProviderId 类型是字符串', () => {
      const id: DynamicProviderId = 'custom-provider'
      expect(typeof id).toBe('string')
    })

    it('ProviderId 类型支持基础和动态 IDs', () => {
      const baseId: ProviderId = 'openai'
      const dynamicId: ProviderId = 'custom-provider'
      expect(typeof baseId).toBe('string')
      expect(typeof dynamicId).toBe('string')
    })
  })
})
