import Scrollbar from '@renderer/components/Scrollbar'
import { type AIServiceAgentKind, backendToAgentKind, type ChatSessionSummary } from '@renderer/types/aiServiceAgent'
import { Button, Dropdown, Empty, Input, Modal, Spin } from 'antd'
import { MessageSquarePlus, MoreHorizontal, Pin, RefreshCw } from 'lucide-react'
import { FC, useMemo, useState } from 'react'
import styled from 'styled-components'

import { AGENT_METAS } from './agentMeta'

interface Props {
  agentKind: AIServiceAgentKind
  onAgentChange: (kind: AIServiceAgentKind) => void
  sessions: ChatSessionSummary[]
  sessionsLoading: boolean
  selectedSessionId: string | null
  onSelectSession: (id: string) => void
  onNewChat: () => void
  onRefresh: () => void
  onDeleteSession: (id: string) => void
  onRenameSession: (id: string, title: string) => void
  onPinSession: (id: string, pinned: boolean) => void
}

function relativeTime(iso?: string): string {
  if (!iso) return ''
  const ts = new Date(iso).getTime()
  if (Number.isNaN(ts)) return ''
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} 小时前`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day} 天前`
  return new Date(ts).toLocaleDateString('zh-CN')
}

const AgentSidebar: FC<Props> = ({
  agentKind,
  onAgentChange,
  sessions,
  sessionsLoading,
  selectedSessionId,
  onSelectSession,
  onNewChat,
  onRefresh,
  onDeleteSession,
  onRenameSession,
  onPinSession
}) => {
  const [renameTarget, setRenameTarget] = useState<ChatSessionSummary | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const filtered = useMemo(() => {
    const list = sessions.filter((s) => backendToAgentKind(s.run_agent_kind) === agentKind)
    return [...list].sort((a, b) => {
      if (!!a.is_pinned !== !!b.is_pinned) return a.is_pinned ? -1 : 1
      return (
        new Date(b.last_message_at || b.updated_at).getTime() - new Date(a.last_message_at || a.updated_at).getTime()
      )
    })
  }, [sessions, agentKind])

  const confirmDelete = (s: ChatSessionSummary) => {
    Modal.confirm({
      title: '删除会话',
      content: `确定删除「${s.title || '未命名会话'}」吗？此操作不可恢复。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => onDeleteSession(s.id)
    })
  }

  const openRename = (s: ChatSessionSummary) => {
    setRenameTarget(s)
    setRenameValue(s.title || '')
  }

  const commitRename = () => {
    if (renameTarget && renameValue.trim()) {
      onRenameSession(renameTarget.id, renameValue.trim())
    }
    setRenameTarget(null)
  }

  return (
    <Container>
      <Section>
        <SectionLabel>智能体</SectionLabel>
        {AGENT_METAS.map((m) => (
          <AgentRow key={m.kind} $active={m.kind === agentKind} onClick={() => onAgentChange(m.kind)}>
            <m.icon size={16} />
            <AgentInfo>
              <AgentName>{m.name}</AgentName>
            </AgentInfo>
          </AgentRow>
        ))}
      </Section>

      <Divider />

      <HistoryHeader>
        <SectionLabel>会话历史</SectionLabel>
        <HeaderActions>
          <Button
            type="text"
            size="small"
            icon={<RefreshCw size={14} />}
            loading={sessionsLoading}
            onClick={onRefresh}
          />
        </HeaderActions>
      </HistoryHeader>

      <NewChatButton type="default" icon={<MessageSquarePlus size={15} />} onClick={onNewChat}>
        新建会话
      </NewChatButton>

      <SessionList>
        {sessionsLoading && filtered.length === 0 ? (
          <Centered>
            <Spin size="small" />
          </Centered>
        ) : filtered.length === 0 ? (
          <Centered>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无会话" />
          </Centered>
        ) : (
          filtered.map((s) => (
            <SessionRow key={s.id} $active={s.id === selectedSessionId} onClick={() => onSelectSession(s.id)}>
              <SessionMain>
                <SessionTitle>
                  {s.is_pinned && <Pin size={11} className="pin" />}
                  {s.title || '未命名会话'}
                </SessionTitle>
                <SessionMeta>
                  {relativeTime(s.last_message_at || s.updated_at)} · {s.message_count} 条
                </SessionMeta>
              </SessionMain>
              <Dropdown
                trigger={['click']}
                menu={{
                  items: [
                    { key: 'rename', label: '重命名' },
                    { key: 'pin', label: s.is_pinned ? '取消置顶' : '置顶' },
                    { type: 'divider' },
                    { key: 'delete', label: '删除', danger: true }
                  ],
                  onClick: ({ key, domEvent }) => {
                    domEvent.stopPropagation()
                    if (key === 'rename') openRename(s)
                    else if (key === 'pin') onPinSession(s.id, !s.is_pinned)
                    else if (key === 'delete') confirmDelete(s)
                  }
                }}>
                <RowAction
                  type="text"
                  size="small"
                  icon={<MoreHorizontal size={15} />}
                  onClick={(e) => e.stopPropagation()}
                />
              </Dropdown>
            </SessionRow>
          ))
        )}
      </SessionList>

      <Modal
        title="重命名会话"
        open={!!renameTarget}
        onOk={commitRename}
        onCancel={() => setRenameTarget(null)}
        okText="保存"
        cancelText="取消"
        okButtonProps={{ disabled: !renameValue.trim() }}>
        <Input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onPressEnter={commitRename}
          maxLength={80}
          placeholder="输入会话名称"
        />
      </Modal>
    </Container>
  )
}

const Container = styled.div`
  width: 260px;
  min-width: 240px;
  display: flex;
  flex-direction: column;
  border-right: 0.5px solid var(--color-border);
  height: 100%;
`

const Section = styled.div`
  padding: 12px 10px 6px;
`

const SectionLabel = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 0 6px 6px;
`

const AgentRow = styled.div<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  color: ${({ $active }) => ($active ? 'var(--color-primary)' : 'var(--color-text-1)')};
  background: ${({ $active }) => ($active ? 'var(--color-primary-bg, rgba(22,119,255,0.08))' : 'transparent')};

  &:hover {
    background: ${({ $active }) =>
      $active ? 'var(--color-primary-bg, rgba(22,119,255,0.08))' : 'var(--color-background-soft)'};
  }
`

const AgentInfo = styled.div`
  flex: 1;
  min-width: 0;
`

const AgentName = styled.div`
  font-size: 13.5px;
  font-weight: 500;
`

const Divider = styled.div`
  height: 0.5px;
  background: var(--color-border);
  margin: 6px 10px;
`

const HistoryHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 10px 0;
`

const HeaderActions = styled.div`
  display: flex;
`

const NewChatButton = styled(Button)`
  display: block;
  width: auto;
  margin: 6px 12px 8px;
`

const SessionList = styled(Scrollbar)`
  flex: 1;
  padding: 0 8px 12px;
  overflow-y: auto;
`

const Centered = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 32px 0;
`

const SessionRow = styled.div<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 8px 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  background: ${({ $active }) => ($active ? 'var(--color-background-soft)' : 'transparent')};

  &:hover {
    background: var(--color-background-soft);
  }
  &:hover button {
    opacity: 1;
  }
`

const SessionMain = styled.div`
  flex: 1;
  min-width: 0;
`

const SessionTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  color: var(--color-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  .pin {
    color: var(--color-text-3);
    flex-shrink: 0;
  }
`

const SessionMeta = styled.div`
  font-size: 11px;
  color: var(--color-text-3);
  margin-top: 2px;
`

const RowAction = styled(Button)`
  opacity: 0;
  flex-shrink: 0;
  transition: opacity 0.15s;
`

export default AgentSidebar
