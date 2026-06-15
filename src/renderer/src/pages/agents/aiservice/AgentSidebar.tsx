import Scrollbar from '@renderer/components/Scrollbar'
import { getAIServiceAgentNameLabel } from '@renderer/i18n/label'
import { type AIServiceAgentKind, backendToAgentKind, type ChatSessionSummary } from '@renderer/types/aiServiceAgent'
import { Button, Dropdown, Empty, Input, Modal, Spin } from 'antd'
import type { TFunction } from 'i18next'
import { MessageSquarePlus, MoreHorizontal, Pin, RefreshCw } from 'lucide-react'
import { FC, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
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

function relativeTime(iso: string | undefined, t: TFunction, locale: string): string {
  if (!iso) return ''
  const ts = new Date(iso).getTime()
  if (Number.isNaN(ts)) return ''
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return t('agents.aiservice.time.just_now')
  if (min < 60) return t('agents.aiservice.time.minutes_ago', { count: min })
  const hr = Math.floor(min / 60)
  if (hr < 24) return t('agents.aiservice.time.hours_ago', { count: hr })
  const day = Math.floor(hr / 24)
  if (day < 30) return t('agents.aiservice.time.days_ago', { count: day })
  return new Date(ts).toLocaleDateString(locale)
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
  const { t, i18n } = useTranslation()
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
    const title = s.title || t('agents.aiservice.session.untitled')
    Modal.confirm({
      title: t('agents.aiservice.session.delete_title'),
      content: t('agents.aiservice.session.delete_confirm', { title }),
      okText: t('agents.aiservice.action.delete'),
      okButtonProps: { danger: true },
      cancelText: t('common.cancel'),
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
        <SectionLabel>{t('agents.aiservice.sidebar.agents')}</SectionLabel>
        {AGENT_METAS.map((m) => (
          <AgentRow key={m.kind} $active={m.kind === agentKind} onClick={() => onAgentChange(m.kind)}>
            <m.icon size={16} />
            <AgentInfo>
              <AgentName>{getAIServiceAgentNameLabel(m.kind)}</AgentName>
            </AgentInfo>
          </AgentRow>
        ))}
      </Section>

      <Divider />

      <HistoryHeader>
        <SectionLabel>{t('agents.aiservice.sidebar.history')}</SectionLabel>
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
        {t('agents.aiservice.session.new')}
      </NewChatButton>

      <SessionList>
        {sessionsLoading && filtered.length === 0 ? (
          <Centered>
            <Spin size="small" />
          </Centered>
        ) : filtered.length === 0 ? (
          <Centered>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('agents.aiservice.session.empty')} />
          </Centered>
        ) : (
          filtered.map((s) => (
            <SessionRow key={s.id} $active={s.id === selectedSessionId} onClick={() => onSelectSession(s.id)}>
              <SessionMain>
                <SessionTitle>
                  {s.is_pinned && <Pin size={11} className="pin" />}
                  {s.title || t('agents.aiservice.session.untitled')}
                </SessionTitle>
                <SessionMeta>
                  {relativeTime(s.last_message_at || s.updated_at, t, i18n.language)} ·{' '}
                  {t('agents.aiservice.session.message_count', { count: s.message_count })}
                </SessionMeta>
              </SessionMain>
              <Dropdown
                trigger={['click']}
                menu={{
                  items: [
                    { key: 'rename', label: t('agents.aiservice.action.rename') },
                    {
                      key: 'pin',
                      label: s.is_pinned ? t('agents.aiservice.action.unpin') : t('agents.aiservice.action.pin')
                    },
                    { type: 'divider' },
                    { key: 'delete', label: t('agents.aiservice.action.delete'), danger: true }
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
        title={t('agents.aiservice.session.rename_title')}
        open={!!renameTarget}
        onOk={commitRename}
        onCancel={() => setRenameTarget(null)}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        okButtonProps={{ disabled: !renameValue.trim() }}>
        <Input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onPressEnter={commitRename}
          maxLength={80}
          placeholder={t('agents.aiservice.session.name_placeholder')}
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
