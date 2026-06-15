import type { ChatEntry } from '@renderer/types/aiServiceAgent'
import { Bot } from 'lucide-react'
import { FC, memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import styled from 'styled-components'

import { THINKING_PLACEHOLDER } from './conversationStore'
import TraceStream from './TraceStream'

interface Props {
  message: ChatEntry
}

const MessageItem: FC<Props> = ({ message }) => {
  if (message.role === 'user') {
    return (
      <UserRow>
        <UserBubble>{message.content}</UserBubble>
      </UserRow>
    )
  }

  const isThinking = message.content === THINKING_PLACEHOLDER
  const hasTrace = (message.traceEvents && message.traceEvents.length > 0) || message.traceRunning

  return (
    <AiRow>
      <Avatar>
        <Bot size={15} />
      </Avatar>
      <AiBody>
        <AiName>RAVENAI</AiName>
        {hasTrace && <TraceStream events={message.traceEvents || []} running={!!message.traceRunning} />}
        {isThinking ? (
          !message.traceRunning && <Thinking>正在思考…</Thinking>
        ) : (
          <AiText className="markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </AiText>
        )}
      </AiBody>
    </AiRow>
  )
}

const UserRow = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
`

const UserBubble = styled.div`
  background: var(--color-background-soft);
  color: var(--color-text-1);
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14.5px;
  line-height: 1.55;
  max-width: 85%;
  white-space: pre-wrap;
  word-break: break-word;
`

const AiRow = styled.div`
  display: flex;
  gap: 12px;
  align-items: flex-start;
`

const Avatar = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--color-primary);
  color: #fff;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  margin-top: 2px;
`

const AiBody = styled.div`
  flex: 1;
  min-width: 0;
`

const AiName = styled.div`
  font-size: 12px;
  color: var(--color-text-3);
  font-weight: 600;
  margin-bottom: 6px;
  letter-spacing: 0.2px;
`

const AiText = styled.div`
  font-size: 14.5px;
  color: var(--color-text-1);
  line-height: 1.62;

  p:first-child {
    margin-top: 0;
  }
  p:last-child {
    margin-bottom: 0;
  }
  pre {
    background: var(--color-background-soft);
    border-radius: 8px;
    padding: 10px 12px;
    overflow-x: auto;
  }
  code {
    font-family: var(--code-font-family, monospace);
  }
`

const Thinking = styled.div`
  font-size: 13px;
  color: var(--color-text-3);
`

export default memo(MessageItem)
