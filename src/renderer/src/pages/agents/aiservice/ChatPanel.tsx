import type { AIServiceAgentKind, ConversationState, ProjectRepoOption } from '@renderer/types/aiServiceAgent'
import { Spin } from 'antd'
import { FC, useEffect, useRef } from 'react'
import styled from 'styled-components'

import { AGENT_META_BY_KIND, AGENT_METAS } from './agentMeta'
import Composer from './Composer'
import MessageItem from './MessageItem'

interface Props {
  title: string
  agentKind: AIServiceAgentKind
  onAgentChange: (kind: AIServiceAgentKind) => void
  conversation: ConversationState | null
  userName: string
  projectRepos: ProjectRepoOption[]
  projectRepoId: number | null
  onProjectRepoChange: (id: number | null) => void
  projectsLoading: boolean
  selectedFile: File | null
  onFileChange: (file: File | null) => void
  input: string
  onInputChange: (v: string) => void
  onSend: () => void
  onStop: () => void
}

const ChatPanel: FC<Props> = ({
  title,
  agentKind,
  onAgentChange,
  conversation,
  userName,
  projectRepos,
  projectRepoId,
  onProjectRepoChange,
  projectsLoading,
  selectedFile,
  onFileChange,
  input,
  onInputChange,
  onSend,
  onStop
}) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const messages = conversation?.messages || []
  const loading = !!conversation?.loadingMessages
  const isSending = !!conversation?.isSending || conversation?.runStatus === 'running'
  const isWelcome = messages.length === 0 && !loading

  // The store mutates message objects in place, so depend on length + the last
  // message's content length to keep auto-scroll firing as the answer streams.
  const lastContentLength = messages[messages.length - 1]?.content.length ?? 0

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, lastContentLength, conversation?.runStatus])

  const meta = AGENT_META_BY_KIND[agentKind]

  return (
    <Panel>
      <TopBar>
        <Title>{title}</Title>
        <TopMeta>
          {meta.name}
          {!isWelcome && messages.length > 0 ? ` · ${messages.length} 条消息` : ''}
        </TopMeta>
      </TopBar>

      <Scroll ref={scrollRef}>
        {loading ? (
          <Centered>
            <Spin />
          </Centered>
        ) : isWelcome ? (
          <Welcome>
            <WelcomeTitle>你好，{userName}</WelcomeTitle>
            <WelcomeSub>选择一个智能体开始对话，可连续多轮提问、选择项目并上传附件。</WelcomeSub>
            <CapGrid>
              {AGENT_METAS.map((m) => (
                <CapCard key={m.kind} $active={m.kind === agentKind} onClick={() => onAgentChange(m.kind)}>
                  <CapLabel>
                    <m.icon size={15} />
                    {m.name}
                  </CapLabel>
                  <CapDesc>{m.description}</CapDesc>
                </CapCard>
              ))}
            </CapGrid>
          </Welcome>
        ) : (
          <Thread>
            {messages.map((m) => (
              <MessageItem
                key={m.id}
                message={m}
                content={m.content}
                traceRunning={!!m.traceRunning}
                traceCount={m.traceEvents?.length ?? 0}
              />
            ))}
          </Thread>
        )}
      </Scroll>

      <Composer
        agentKind={agentKind}
        projectRepos={projectRepos}
        projectRepoId={projectRepoId}
        onProjectRepoChange={onProjectRepoChange}
        projectsLoading={projectsLoading}
        selectedFile={selectedFile}
        onFileChange={onFileChange}
        value={input}
        onChange={onInputChange}
        isSending={isSending}
        onSend={onSend}
        onStop={onStop}
      />
    </Panel>
  )
}

const Panel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
`

const TopBar = styled.header`
  height: 52px;
  flex-shrink: 0;
  border-bottom: 0.5px solid var(--color-border);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 24px;
`

const Title = styled.span`
  font-size: 14.5px;
  font-weight: 600;
  color: var(--color-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const TopMeta = styled.span`
  font-size: 12px;
  color: var(--color-text-3);
  flex-shrink: 0;
`

const Scroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 28px 0 16px;
`

const Centered = styled.div`
  display: flex;
  justify-content: center;
  padding-top: 60px;
`

const Thread = styled.div`
  max-width: 760px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
`

const Welcome = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 0 32px;
  text-align: center;
`

const WelcomeTitle = styled.h1`
  font-size: 30px;
  font-weight: 600;
  color: var(--color-text-1);
  margin: 0;
`

const WelcomeSub = styled.div`
  font-size: 14.5px;
  color: var(--color-text-2);
  max-width: 520px;
  line-height: 1.55;
`

const CapGrid = styled.div`
  margin-top: 8px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  width: 100%;
  max-width: 760px;
`

const CapCard = styled.div<{ $active?: boolean }>`
  border: 1px solid ${({ $active }) => ($active ? 'var(--color-primary)' : 'var(--color-border)')};
  border-radius: 12px;
  padding: 14px 16px;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: var(--color-primary);
  }
`

const CapLabel = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--color-text-1);
  margin-bottom: 6px;
`

const CapDesc = styled.div`
  font-size: 12.5px;
  color: var(--color-text-2);
  line-height: 1.5;
`

export default ChatPanel
