import { loggerService } from '@logger'
import type { PromptMessage, PromptResultMessage } from '@main/services/DeviceLinkContract'
import db from '@renderer/databases'
import { getDefaultAssistant, getDefaultTopic } from '@renderer/services/AssistantService'
import { getUserMessage } from '@renderer/services/MessagesService'
import { estimateUserPromptUsage } from '@renderer/services/TokenService'
import store from '@renderer/store'
import { addTopic } from '@renderer/store/assistants'
import { selectMessagesForTopic } from '@renderer/store/newMessage'
import { sendMessage } from '@renderer/store/thunk/messageThunk'
import type { Assistant, Topic } from '@renderer/types'
import type { MessageInputBaseParams } from '@renderer/types/newMessage'
import { getMainTextContent } from '@renderer/utils/messageUtils/find'
import { waitForTopicQueue } from '@renderer/utils/queue'

const logger = loggerService.withContext('DeviceLinkHandler')

class DeviceLinkHandler {
  private unsubscribe?: () => void

  start() {
    if (!window?.api?.deviceLink) {
      logger.warn('Device link API not available in renderer.')
      return
    }
    if (this.unsubscribe) {
      return
    }

    this.unsubscribe = window.api.deviceLink.onPrompt((payload: PromptMessage) => {
      this.handlePrompt(payload).catch((error) => {
        logger.error('Failed to handle device-link prompt', error as Error)
      })
    })

    logger.info('Device link handler started.')
  }

  stop() {
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = undefined
      logger.info('Device link handler stopped.')
    }
  }

  private getAssistant(): Assistant {
    const state = store.getState()
    const defaultAssistantId = state.assistants.defaultAssistant?.id || 'default'
    const assistant =
      state.assistants.assistants.find((item) => item.id === defaultAssistantId) ||
      state.assistants.assistants[0] ||
      getDefaultAssistant()

    return assistant
  }

  private async createTopic(assistant: Assistant, systemPrompt?: string): Promise<Topic> {
    const topic = { ...getDefaultTopic(assistant.id), prompt: systemPrompt }

    try {
      await db.topics.add({ id: topic.id, messages: [] })
    } catch (error) {
      logger.warn('Topic creation hit an existing id, continuing.', error as Error)
    }

    store.dispatch(addTopic({ assistantId: assistant.id, topic }))
    return topic
  }

  private buildAssistantWithPrompt(assistant: Assistant, topicPrompt?: string): Assistant {
    if (!topicPrompt) {
      return assistant
    }

    const prompt = assistant.prompt ? `${assistant.prompt}\n${topicPrompt}` : topicPrompt
    return { ...assistant, prompt }
  }

  private async handlePrompt(payload: PromptMessage) {
    let topic: Topic | undefined
    try {
      const assistant = this.getAssistant()
      topic = await this.createTopic(assistant, payload.system_prompt)
      const assistantForTopic = this.buildAssistantWithPrompt(assistant, topic.prompt)

      const usage = await estimateUserPromptUsage({ content: payload.prompt })
      const baseUserMessage: MessageInputBaseParams = {
        assistant: assistantForTopic,
        topic,
        content: payload.prompt,
        usage
      }

      const { message: userMessage, blocks } = getUserMessage(baseUserMessage)

      await store.dispatch(sendMessage(userMessage, blocks, assistantForTopic, topic.id))
      await waitForTopicQueue(topic.id)

      const topicMessages =
        (await db.topics.get(topic.id))?.messages || selectMessagesForTopic(store.getState(), topic.id)
      const assistantMessage = [...topicMessages].reverse().find((msg) => msg.role === 'assistant')

      const answer = assistantMessage ? getMainTextContent(assistantMessage) : ''

      const result: PromptResultMessage = {
        type: 'prompt_result',
        request_id: payload.request_id,
        session_id: payload.session_id,
        topic_id: topic.id,
        answer,
        raw_messages: topicMessages
      }

      try {
        await window.api.deviceLink.sendPromptResult(result)
      } catch (sendError) {
        logger.error('Failed to send prompt result to main process.', sendError as Error)
      }
    } catch (error) {
      logger.error('Device link prompt processing failed.', error as Error)

      const fallbackResult: PromptResultMessage = {
        type: 'prompt_result',
        request_id: payload.request_id,
        session_id: payload.session_id,
        topic_id: topic?.id || 'unknown',
        answer: `Error: ${(error as Error)?.message || 'Unknown error'}`,
        raw_messages: []
      }

      try {
        await window.api.deviceLink.sendPromptResult(fallbackResult)
      } catch (sendError) {
        logger.error('Failed to send error prompt result to main process.', sendError as Error)
      }
    }
  }
}

export const deviceLinkHandler = new DeviceLinkHandler()
