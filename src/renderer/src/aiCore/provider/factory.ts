import { AiCore, ProviderId } from '@cherrystudio/ai-core'
import { Provider } from '@renderer/types'

const PROVIDER_MAPPING: Record<string, ProviderId> = {
  anthropic: 'anthropic',
  gemini: 'google',
  vertexai: 'google-vertex',
  'azure-openai': 'azure',
  'openai-response': 'openai'
}

export function getAiSdkProviderId(provider: Provider): ProviderId | 'openai-compatible' {
  const providerId = PROVIDER_MAPPING[provider.type]

  if (providerId) {
    return providerId
  }

  if (AiCore.isSupported(provider.id)) {
    return provider.id as ProviderId
  }

  return 'openai-compatible'
}
