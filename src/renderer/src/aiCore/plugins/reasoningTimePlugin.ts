import { definePlugin } from '@cherrystudio/ai-core'

export default definePlugin({
  name: 'reasoningTimePlugin',

  transformStream: () => () => {
    // === 时间跟踪状态 ===
    let thinkingStartTime = 0
    let hasStartedThinking = false
    let accumulatedThinkingContent = ''

    return new TransformStream({
      transform(chunk, controller) {
        if (chunk.type !== 'reasoning') {
          // === 处理 reasoning 结束  ===
          if (hasStartedThinking) {
            console.log(`[ReasoningPlugin] Ending reasoning.`)

            // 生成 reasoning-signature
            controller.enqueue({
              type: 'reasoning-signature',
              text: accumulatedThinkingContent,
              thinking_millsec: performance.now() - thinkingStartTime
            })

            // 重置状态
            accumulatedThinkingContent = ''
            hasStartedThinking = false
            thinkingStartTime = 0
          }

          controller.enqueue(chunk)
          return
        }

        // === 处理 reasoning 类型 ===

        // 1. 时间跟踪逻辑
        if (!hasStartedThinking) {
          hasStartedThinking = true
          thinkingStartTime = performance.now()
          console.log(`[ReasoningPlugin] Starting reasoning session`)
        }
        accumulatedThinkingContent += chunk.textDelta

        // 2. 直接透传 chunk，并附加上时间
        console.log(`[ReasoningPlugin] Forwarding reasoning chunk: "${chunk.textDelta}"`)
        controller.enqueue({
          ...chunk,
          thinking_millsec: performance.now() - thinkingStartTime
        })
      },

      // === flush 处理流结束时仍在reasoning状态的场景 ===
      flush(controller) {
        if (hasStartedThinking) {
          console.log(`[ReasoningPlugin] Final flush for reasoning-signature.`)
          controller.enqueue({
            type: 'reasoning-signature',
            text: accumulatedThinkingContent,
            thinking_millsec: performance.now() - thinkingStartTime
          })
        }
      }
    })
  }
})
