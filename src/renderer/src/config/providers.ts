import BailianProviderLogo from '@renderer/assets/images/providers/bailian.png'
import DeepSeekProviderLogo from '@renderer/assets/images/providers/deepseek.png'
import GoogleProviderLogo from '@renderer/assets/images/providers/google.png'

const PROVIDER_LOGO_MAP = {
  deepseek: DeepSeekProviderLogo,
  dashscope: BailianProviderLogo,
  gemini: GoogleProviderLogo
} as const

export function getProviderLogo(providerId: string) {
  return PROVIDER_LOGO_MAP[providerId as keyof typeof PROVIDER_LOGO_MAP]
}

// export const SUPPORTED_REANK_PROVIDERS = ['silicon', 'jina', 'voyageai', 'dashscope', 'aihubmix']
export const NOT_SUPPORTED_REANK_PROVIDERS = ['ollama']
export const ONLY_SUPPORTED_DIMENSION_PROVIDERS = ['ollama', 'infini']

export const PROVIDER_CONFIG = {
  deepseek: {
    api: {
      url: 'https://api.deepseek.com'
    },
    websites: {
      official: 'https://deepseek.com/',
      apiKey: 'https://platform.deepseek.com/api_keys',
      docs: 'https://platform.deepseek.com/api-docs/',
      models: 'https://platform.deepseek.com/api-docs/'
    }
  },
  dashscope: {
    api: {
      url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/'
    },
    websites: {
      official: 'https://tongyi.aliyun.com/',
      apiKey: 'https://dashscope.console.aliyun.com/apiKey',
      docs: 'https://help.aliyun.com/zh/dashscope/',
      models: 'https://cloud.siliconflow.cn/models'
    }
  },
  gemini: {
    api: {
      url: 'https://generativelanguage.googleapis.com'
    },
    websites: {
      official: 'https://gemini.google.com/',
      apiKey: 'https://aistudio.google.com/app/apikey',
      docs: 'https://ai.google.dev/gemini-api/docs',
      models: 'https://ai.google.dev/gemini-api/docs/models/gemini'
    }
  }
}
