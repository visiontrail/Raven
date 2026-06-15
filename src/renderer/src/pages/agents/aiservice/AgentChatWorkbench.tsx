import { loggerService } from '@logger'
import { Navbar, NavbarCenter } from '@renderer/components/app/Navbar'
import { AIServiceAgentClient, AIServiceConnectionError } from '@renderer/services/AIServiceAgentClient'
import {
  type AIServiceAgentKind,
  type AIServiceConfig,
  backendToAgentKind,
  type ProjectRepoOption,
  type UserProfile
} from '@renderer/types/aiServiceAgent'
import { uuid } from '@renderer/utils'
import { Button, Dropdown, Spin, Tag } from 'antd'
import { LogOut, User } from 'lucide-react'
import { FC, useCallback, useEffect, useRef, useState } from 'react'
import styled from 'styled-components'

import { AGENT_META_BY_KIND } from './agentMeta'
import AgentSidebar from './AgentSidebar'
import ChatPanel from './ChatPanel'
import { conversationStore } from './conversationStore'
import LoginView from './LoginView'
import { useConversation, useSessions } from './useConversation'

const logger = loggerService.withContext('AgentChatWorkbench')

interface Props {
  onSwitchToTemplates: () => void
}

const AgentChatWorkbench: FC<Props> = ({ onSwitchToTemplates }) => {
  const clientRef = useRef<AIServiceAgentClient | null>(null)

  const [config, setConfig] = useState<AIServiceConfig | null>(null)
  const [bootLoading, setBootLoading] = useState(true)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const [agentKind, setAgentKind] = useState<AIServiceAgentKind>('project-expert')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [projectRepoId, setProjectRepoId] = useState<number | null>(null)
  const [projectRepos, setProjectRepos] = useState<ProjectRepoOption[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)

  const conversation = useConversation(sessionId)
  const { sessions, loading: sessionsLoading } = useSessions()

  const loadProjectRepos = useCallback(async () => {
    if (!clientRef.current) return
    setProjectsLoading(true)
    try {
      setProjectRepos(await clientRef.current.listProjectRepos())
    } catch {
      setProjectRepos([])
    } finally {
      setProjectsLoading(false)
    }
  }, [])

  const onAuthenticated = useCallback(
    (user: UserProfile) => {
      setProfile(user)
      setAuthError(null)
      // Hydrate the user's locally cached history first so the sidebar is
      // populated immediately, then merge in the authoritative server list.
      conversationStore.attachUser(user.id)
      void conversationStore.loadSessions()
      void loadProjectRepos()
    },
    [loadProjectRepos]
  )

  // Boot: read config, build the shared client, validate any stored token.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const cfg = await window.api.ravenAIService.getConfig()
        if (cancelled) return
        setConfig(cfg)
        const client = new AIServiceAgentClient(cfg)
        clientRef.current = client
        conversationStore.setClient(client)
        if (cfg.token) {
          try {
            const user = await client.getProfile()
            if (cancelled) return
            onAuthenticated(user)
          } catch (err) {
            if (err instanceof AIServiceConnectionError) {
              setAuthError(`无法连接到 RavenAIService（${cfg.baseUrl}），请确认本地服务已启动。`)
            }
            // Stale / invalid token: fall back to the login screen.
            client.setToken(undefined)
          }
        }
      } finally {
        if (!cancelled) setBootLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [onAuthenticated])

  const handleLogin = useCallback(
    async (username: string, password: string) => {
      if (!clientRef.current) return
      setAuthLoading(true)
      setAuthError(null)
      try {
        const payload = await clientRef.current.login(username, password)
        await window.api.ravenAIService.setAuthToken(payload.token)
        onAuthenticated(payload.user)
      } catch (err) {
        setAuthError(
          err instanceof AIServiceConnectionError
            ? `无法连接到 RavenAIService（${config?.baseUrl}），请确认本地服务已启动。`
            : (err as Error)?.message || '登录失败，请检查用户名或密码。'
        )
      } finally {
        setAuthLoading(false)
      }
    },
    [config?.baseUrl, onAuthenticated]
  )

  const handleLogout = useCallback(async () => {
    await window.api.ravenAIService.setAuthToken(undefined)
    clientRef.current?.setToken(undefined)
    conversationStore.reset()
    setProfile(null)
    setSessionId(null)
    setInput('')
    setSelectedFile(null)
  }, [])

  const resetComposer = () => {
    setInput('')
    setSelectedFile(null)
  }

  const handleAgentChange = useCallback((kind: AIServiceAgentKind) => {
    setAgentKind(kind)
    setSessionId(null)
    setProjectRepoId(null)
    resetComposer()
  }, [])

  const handleNewChat = useCallback(() => {
    setSessionId(null)
    resetComposer()
  }, [])

  const handleSelectSession = useCallback(
    (id: string) => {
      setSessionId(id)
      resetComposer()
      const summary = sessions.find((s) => s.id === id)
      const kind = backendToAgentKind(summary?.run_agent_kind)
      if (kind) setAgentKind(kind)
      void conversationStore.loadSession(id, { force: true }).then((state) => {
        setProjectRepoId(state.lastProjectRepoId ?? null)
      })
    },
    [sessions]
  )

  const handleSend = useCallback(() => {
    const meta = AGENT_META_BY_KIND[agentKind]
    const content = input.trim()
    const fileToSend = meta.supportsFile ? selectedFile : null

    logger.info('handleSend invoked', {
      agentKind,
      hasContent: !!content,
      hasFile: !!fileToSend,
      projectRepoId,
      sessionId
    })

    if (meta.projectRepo === 'required' && projectRepoId == null) {
      logger.warn('handleSend blocked: project repo required but none selected', { agentKind })
      window.message?.warning({ content: '请先选择一个项目仓库', key: 'project-required' })
      void loadProjectRepos()
      return
    }
    if (!content && !fileToSend) {
      logger.warn('handleSend blocked: empty message and no file', { agentKind })
      return
    }

    let sid = sessionId
    if (!sid) {
      sid = uuid()
      setSessionId(sid)
    }

    resetComposer()
    void conversationStore.startRun(sid, {
      agentKind,
      message: content,
      projectRepoId,
      file: fileToSend
    })
  }, [agentKind, input, selectedFile, projectRepoId, sessionId, loadProjectRepos])

  const handleStop = useCallback(() => {
    if (sessionId) void conversationStore.cancelActiveRun(sessionId)
  }, [sessionId])

  const handleDeleteSession = useCallback(
    async (id: string) => {
      await conversationStore.deleteSession(id)
      if (id === sessionId) setSessionId(null)
    },
    [sessionId]
  )

  const title = sessionId ? sessions.find((s) => s.id === sessionId)?.title || '未命名会话' : '新对话'
  const userName = profile?.display_name || profile?.username || '用户'

  if (bootLoading) {
    return (
      <Container>
        <Centered>
          <Spin size="large" />
        </Centered>
      </Container>
    )
  }

  return (
    <Container>
      <Navbar>
        <NavbarCenter style={{ borderRight: 'none', justifyContent: 'space-between' }}>
          <span>智能体工作台</span>
          <Right>
            {config && <Tag color="blue">{config.baseUrl}</Tag>}
            {profile ? (
              <Dropdown
                trigger={['click']}
                menu={{
                  items: [{ key: 'logout', label: '退出登录', icon: <LogOut size={14} /> }],
                  onClick: ({ key }) => key === 'logout' && handleLogout()
                }}>
                <Button type="text" size="small" icon={<User size={14} />}>
                  {userName}
                </Button>
              </Dropdown>
            ) : null}
            <Button type="text" size="small" onClick={onSwitchToTemplates}>
              模板助手
            </Button>
          </Right>
        </NavbarCenter>
      </Navbar>

      {!profile ? (
        <LoginView baseUrl={config?.baseUrl || ''} loading={authLoading} error={authError} onLogin={handleLogin} />
      ) : (
        <Body>
          <AgentSidebar
            agentKind={agentKind}
            onAgentChange={handleAgentChange}
            sessions={sessions}
            sessionsLoading={sessionsLoading}
            selectedSessionId={sessionId}
            onSelectSession={handleSelectSession}
            onNewChat={handleNewChat}
            onRefresh={() => conversationStore.loadSessions()}
            onDeleteSession={handleDeleteSession}
            onRenameSession={(id, t) => conversationStore.renameSession(id, t)}
            onPinSession={(id, pinned) => conversationStore.pinSession(id, pinned)}
          />
          <ChatPanel
            title={title}
            agentKind={agentKind}
            onAgentChange={handleAgentChange}
            conversation={conversation}
            userName={userName}
            projectRepos={projectRepos}
            projectRepoId={projectRepoId}
            onProjectRepoChange={setProjectRepoId}
            projectsLoading={projectsLoading}
            selectedFile={selectedFile}
            onFileChange={setSelectedFile}
            input={input}
            onInputChange={setInput}
            onSend={handleSend}
            onStop={handleStop}
          />
        </Body>
      )}
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  height: 100%;
`

const Centered = styled.div`
  display: flex;
  flex: 1;
  justify-content: center;
  align-items: center;
`

const Body = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`

const Right = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`

export default AgentChatWorkbench
