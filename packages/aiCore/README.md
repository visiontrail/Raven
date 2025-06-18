# @cherry-studio/ai-core

Cherry Studio AI Core 是一个基于 Vercel AI SDK 的统一 AI Provider 接口包。

## 特性

- 🚀 统一的 AI Provider 接口
- 🔄 动态导入支持
- 💾 智能缓存机制
- 🛠️ TypeScript 支持
- 📦 轻量级设计

## 支持的 Providers

基于 [AI SDK 官方支持的 providers](https://ai-sdk.dev/providers/ai-sdk-providers)：

**核心 Providers:**

- OpenAI
- Anthropic
- Google Generative AI
- Google Vertex AI
- Mistral AI
- xAI (Grok)
- Azure OpenAI
- Amazon Bedrock

**扩展 Providers:**

- Cohere
- Groq
- Together.ai
- Fireworks
- DeepSeek
- Cerebras
- DeepInfra
- Replicate
- Perplexity
- Fal AI
- Vercel

## 安装

```bash
npm install @cherry-studio/ai-core ai
```

还需要安装你要使用的 AI SDK provider:

```bash
npm install @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google
```

## 使用示例

### 基础用法

```typescript
import { createAiSdkClient } from '@cherry-studio/ai-core'

// 创建 OpenAI 客户端
const client = await createAiSdkClient('openai', {
  apiKey: 'your-api-key'
})

// 流式生成
const result = await client.stream({
  modelId: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
})

// 非流式生成
const response = await client.generate({
  modelId: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
})
```

### 便捷函数

```typescript
import { createOpenAIClient, streamGeneration } from '@cherry-studio/ai-core'

// 快速创建 OpenAI 客户端
const client = await createOpenAIClient({
  apiKey: 'your-api-key'
})

// 便捷流式生成
const result = await streamGeneration('openai', 'gpt-4', [{ role: 'user', content: 'Hello!' }], {
  apiKey: 'your-api-key'
})
```

### 多 Provider 支持

```typescript
import { createAiSdkClient } from '@cherry-studio/ai-core'

// 支持多种 AI providers
const openaiClient = await createAiSdkClient('openai', { apiKey: 'openai-key' })
const anthropicClient = await createAiSdkClient('anthropic', { apiKey: 'anthropic-key' })
const googleClient = await createAiSdkClient('google', { apiKey: 'google-key' })
const xaiClient = await createAiSdkClient('xai', { apiKey: 'xai-key' })
```

## License

MIT
