import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'

import { createContext, PluginManager } from '..'
import { ContentFilterPlugin, LoggingPlugin } from './example-plugins'

/**
 * 完整的 AI SDK 集成示例
 */
export async function exampleAiRequest() {
  // 1. 创建插件管理器
  const pluginManager = new PluginManager([LoggingPlugin, ContentFilterPlugin])

  // 2. 创建请求上下文
  const context = createContext('openai', 'gpt-4', {
    messages: [{ role: 'user', content: 'Hello!' }]
  })

  try {
    // 3. 触发请求开始事件
    await pluginManager.executeParallel('onRequestStart', context)

    // 4. 解析模型别名
    // const resolvedModel = await pluginManager.executeFirst('resolveModel', 'gpt-4', context)
    // const modelId = resolvedModel || 'gpt-4'

    // 5. 转换请求参数
    const params = {
      messages: [{ role: 'user' as const, content: 'Hello, AI!' }],
      temperature: 0.7
    }
    const transformedParams = await pluginManager.executeSequential('transformParams', params, context)

    // 6. 收集流转换器（关键：AI SDK 原生支持数组！）
    const streamTransforms = pluginManager.collectStreamTransforms()

    // 7. 调用 AI SDK，直接传入转换器工厂数组
    const result = await streamText({
      model: openai('gpt-4'),
      ...transformedParams,
      experimental_transform: streamTransforms // 直接传入工厂函数数组
    })

    // 8. 处理结果
    let fullText = ''
    for await (const textPart of result.textStream) {
      fullText += textPart
      console.log('Streaming:', textPart)
    }

    // 9. 转换最终结果
    const finalResult = { text: fullText, usage: await result.usage }
    const transformedResult = await pluginManager.executeSequential('transformResult', finalResult, context)

    // 10. 触发完成事件
    await pluginManager.executeParallel('onRequestEnd', context, transformedResult)

    return transformedResult
  } catch (error) {
    // 11. 触发错误事件
    await pluginManager.executeParallel('onError', context, undefined, error as Error)
    throw error
  }
}

/**
 * 流转换器数组的其他使用方式
 */
export function demonstrateStreamTransforms() {
  const pluginManager = new PluginManager([
    ContentFilterPlugin,
    {
      name: 'text-replacer',
      transformStream() {
        return () =>
          new TransformStream({
            transform(chunk, controller) {
              if (chunk.type === 'text-delta') {
                const replaced = chunk.textDelta.replace(/hello/gi, 'hi')
                controller.enqueue({ ...chunk, textDelta: replaced })
              } else {
                controller.enqueue(chunk)
              }
            }
          })
      }
    }
  ])

  // 获取所有流转换器
  const transforms = pluginManager.collectStreamTransforms()
  console.log(`收集到 ${transforms.length} 个流转换器`)

  // 可以单独使用每个转换器
  transforms.forEach((factory, index) => {
    console.log(`转换器 ${index + 1} 已准备就绪`)
    const transform = factory({ stopStream: () => {} })
    console.log('Transform created:', transform)
  })

  return transforms
}
