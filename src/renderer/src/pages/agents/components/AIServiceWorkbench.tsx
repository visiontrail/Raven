import { Navbar, NavbarCenter } from '@renderer/components/app/Navbar'
import Scrollbar from '@renderer/components/Scrollbar'
import { useAIServiceAgentRun } from '@renderer/hooks/useAIServiceAgentRun'
import type { AIServiceAgentKind, AIServiceConfig, ProjectRepoOption } from '@renderer/types/aiServiceAgent'
import { Alert, Button, Input, Select, Spin, Tabs, Tag, Tooltip, Upload } from 'antd'
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  RefreshCw,
  Send,
  Square,
  Trash2
} from 'lucide-react'
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import styled from 'styled-components'

import TracePanel from './TracePanel'

const { TextArea } = Input

interface Props {
  onSwitchToTemplates: () => void
}

const AIServiceWorkbench: FC<Props> = ({ onSwitchToTemplates }) => {
  const [agentKind, setAgentKind] = useState<AIServiceAgentKind>('project-expert')
  const [message, setMessage] = useState('')
  const [selectedProjectRepoId, setSelectedProjectRepoId] = useState<number | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [config, setConfig] = useState<AIServiceConfig | null>(null)
  const [projectRepos, setProjectRepos] = useState<ProjectRepoOption[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [projectsError, setProjectsError] = useState<string | null>(null)
  const [configLoading, setConfigLoading] = useState(true)
  const [traceExpanded, setTraceExpanded] = useState(true)

  const { runState, initClient, startRun, cancelRun, retry, reset, client } = useAIServiceAgentRun()
  const answerEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    setConfigLoading(true)
    try {
      const cfg = await window.api.ravenAIService.getConfig()
      setConfig(cfg)
      initClient(cfg)
      loadProjectRepos(cfg)
    } catch {
      setConfig(null)
    } finally {
      setConfigLoading(false)
    }
  }

  const loadProjectRepos = async (cfg?: AIServiceConfig) => {
    const c = cfg || config
    if (!c) return
    setProjectsLoading(true)
    setProjectsError(null)
    try {
      if (!client.current) initClient(c)
      const repos = await client.current!.listProjectRepos()
      setProjectRepos(repos)
    } catch (err: unknown) {
      setProjectsError(err instanceof Error ? err.message : 'Failed to load projects')
    } finally {
      setProjectsLoading(false)
    }
  }

  const handleSubmit = useCallback(async () => {
    if (runState.status === 'running') return
    if (agentKind === 'project-expert' && !selectedProjectRepoId) {
      window.message.warning({ content: '请先选择一个项目仓库', key: 'project-required' })
      return
    }
    if (!message.trim() && agentKind === 'project-expert') {
      window.message.warning({ content: '请输入问题', key: 'message-required' })
      return
    }

    await startRun({
      agentKind,
      message: message.trim() || '请分析这个日志文件',
      projectRepoId: selectedProjectRepoId,
      file: selectedFile
    })
  }, [agentKind, message, selectedProjectRepoId, selectedFile, runState.status, startRun])

  const handleFileSelect = (file: File) => {
    setSelectedFile(file)
    return false
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  useEffect(() => {
    if (runState.status === 'running') {
      answerEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [runState.answerSoFar, runState.status])

  const isRunning = runState.status === 'running'
  const isTerminal = ['succeeded', 'failed', 'cancelled', 'stale'].includes(runState.status)

  const projectOptions = useMemo(
    () =>
      projectRepos.map((r) => ({
        value: r.id,
        label: `${r.project_name} (${r.project_code})`,
        description: r.description,
        branch: r.default_branch
      })),
    [projectRepos]
  )

  if (configLoading) {
    return (
      <WorkbenchContainer>
        <CenterContent>
          <Spin size="large" />
        </CenterContent>
      </WorkbenchContainer>
    )
  }

  return (
    <WorkbenchContainer>
      <Navbar>
        <NavbarCenter style={{ borderRight: 'none', justifyContent: 'space-between' }}>
          <span>AIService Agent 工作台</span>
          <Button type="text" size="small" onClick={onSwitchToTemplates}>
            模板助手
          </Button>
        </NavbarCenter>
      </Navbar>

      <WorkbenchBody>
        {/* Connection Status Bar */}
        <ConnectionBar>
          <ConnectionInfo>
            <Tag color={projectsError ? 'red' : 'green'}>
              {config ? config.baseUrl : '未连接'}
            </Tag>
            {config?.hasToken && <Tag color="blue">Token ✓</Tag>}
            {!config?.hasToken && <Tag color="orange">无 Token</Tag>}
            {projectsLoading && <Spin size="small" />}
            {projectsError && (
              <Tooltip title={projectsError}>
                <AlertCircle size={14} color="var(--color-error)" />
              </Tooltip>
            )}
          </ConnectionInfo>
          <Button
            type="text"
            size="small"
            icon={<RefreshCw size={14} />}
            onClick={() => loadProjectRepos()}
            loading={projectsLoading}
          />
        </ConnectionBar>

        {/* Agent Tabs */}
        <Tabs
          activeKey={agentKind}
          onChange={(k) => {
            setAgentKind(k as AIServiceAgentKind)
            if (!isRunning) reset()
          }}
          items={[
            { key: 'project-expert', label: '项目专家' },
            { key: 'log-analysis', label: '日志分析' }
          ]}
          style={{ padding: '0 16px' }}
        />

        <ContentArea>
          {/* Input Panel */}
          <InputPanel>
            {/* Project Selector */}
            <FormGroup>
              <FormLabel>
                项目仓库
                {agentKind === 'project-expert' && <Required>*</Required>}
              </FormLabel>
              <Select
                placeholder="选择项目仓库"
                value={selectedProjectRepoId}
                onChange={setSelectedProjectRepoId}
                options={projectOptions}
                loading={projectsLoading}
                allowClear
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                optionRender={(option) => (
                  <div>
                    <div>{option.label}</div>
                    {option.data.branch && (
                      <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
                        分支: {option.data.branch}
                        {option.data.description && ` · ${option.data.description}`}
                      </div>
                    )}
                  </div>
                )}
                style={{ width: '100%' }}
              />
            </FormGroup>

            {/* Log file upload (log-analysis only) */}
            {agentKind === 'log-analysis' && (
              <FormGroup>
                <FormLabel>日志文件</FormLabel>
                {selectedFile ? (
                  <FileDisplay>
                    <FileText size={14} />
                    <span>
                      {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </span>
                    <Button
                      type="text"
                      size="small"
                      icon={<Trash2 size={12} />}
                      onClick={() => setSelectedFile(null)}
                    />
                  </FileDisplay>
                ) : (
                  <Upload beforeUpload={handleFileSelect} showUploadList={false} accept=".log,.txt,.gz,.zip,.tar,.tar.gz">
                    <Button size="small" icon={<FileText size={14} />}>
                      选择日志文件
                    </Button>
                  </Upload>
                )}
              </FormGroup>
            )}

            {/* Message Input */}
            <FormGroup>
              <FormLabel>问题</FormLabel>
              <TextArea
                placeholder={agentKind === 'log-analysis' ? '请分析这个日志文件（可留空使用默认问题）' : '请输入你的问题...'}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                autoSize={{ minRows: 3, maxRows: 8 }}
                disabled={isRunning}
              />
            </FormGroup>

            {/* Action Buttons */}
            <ActionButtons>
              {!isRunning && (
                <Button type="primary" icon={<Send size={14} />} onClick={handleSubmit} disabled={isRunning}>
                  发送
                </Button>
              )}
              {isRunning && (
                <Button danger icon={<Square size={14} />} onClick={cancelRun}>
                  取消
                </Button>
              )}
              {isTerminal && (
                <Button icon={<RefreshCw size={14} />} onClick={retry}>
                  重试
                </Button>
              )}
            </ActionButtons>
          </InputPanel>

          {/* Results Panel */}
          <ResultsPanel>
            {/* Run Status */}
            {runState.status !== 'idle' && (
              <StatusBar $status={runState.status}>
                {isRunning && <Loader2 size={14} className="spin" />}
                <span>
                  {runState.status === 'running' && '运行中...'}
                  {runState.status === 'succeeded' && '运行完成'}
                  {runState.status === 'failed' && '运行失败'}
                  {runState.status === 'cancelled' && '已取消'}
                  {runState.status === 'stale' && '连接中断'}
                </span>
                {runState.sessionId && (
                  <Tag style={{ marginLeft: 8, fontSize: 10 }}>Session: {runState.sessionId.slice(0, 8)}...</Tag>
                )}
              </StatusBar>
            )}

            {/* Error Display */}
            {runState.error && (
              <Alert
                type="error"
                message={runState.error}
                showIcon
                closable
                style={{ margin: '0 0 12px' }}
              />
            )}

            {/* Answer Area */}
            {runState.answerSoFar && (
              <AnswerArea>
                <AnswerHeader>回答</AnswerHeader>
                <AnswerContent className="markdown">
                  <ReactMarkdown>{runState.answerSoFar}</ReactMarkdown>
                  <div ref={answerEndRef} />
                </AnswerContent>
              </AnswerArea>
            )}

            {/* Trace Panel */}
            {runState.traceEvents.length > 0 && (
              <TraceSection>
                <TraceSectionHeader onClick={() => setTraceExpanded(!traceExpanded)}>
                  <span>Agent Trace ({runState.traceEvents.length})</span>
                  {traceExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </TraceSectionHeader>
                {traceExpanded && <TracePanel events={runState.traceEvents} />}
              </TraceSection>
            )}

            {/* Idle state */}
            {runState.status === 'idle' && (
              <IdleMessage>
                {agentKind === 'project-expert'
                  ? '选择一个项目仓库，输入你的问题，开始与项目专家对话。'
                  : '上传日志文件或输入问题，开始日志分析。'}
              </IdleMessage>
            )}
          </ResultsPanel>
        </ContentArea>
      </WorkbenchBody>
    </WorkbenchContainer>
  )
}

const WorkbenchContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  height: 100%;
`

const CenterContent = styled.div`
  display: flex;
  flex: 1;
  justify-content: center;
  align-items: center;
`

const WorkbenchBody = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
`

const ConnectionBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 16px;
  border-bottom: 0.5px solid var(--color-border);
  background: var(--color-background-soft);
`

const ConnectionInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const ContentArea = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`

const InputPanel = styled(Scrollbar)`
  width: 340px;
  min-width: 300px;
  border-right: 0.5px solid var(--color-border);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

const FormLabel = styled.label`
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-2);
`

const Required = styled.span`
  color: var(--color-error);
  margin-left: 2px;
`

const FileDisplay = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--color-background-soft);
  border-radius: 6px;
  font-size: 12px;
  color: var(--color-text-2);
`

const ActionButtons = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 8px;
`

const ResultsPanel = styled(Scrollbar)`
  flex: 1;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
`

const StatusBar = styled.div<{ $status: string }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  background: ${({ $status }) =>
    $status === 'running'
      ? 'var(--color-primary-bg, rgba(22,119,255,0.08))'
      : $status === 'succeeded'
        ? 'rgba(82,196,26,0.08)'
        : $status === 'failed'
          ? 'rgba(255,77,79,0.08)'
          : 'var(--color-background-soft)'};
  color: ${({ $status }) =>
    $status === 'running'
      ? 'var(--color-primary, #1677ff)'
      : $status === 'succeeded'
        ? '#52c41a'
        : $status === 'failed'
          ? '#ff4d4f'
          : 'var(--color-text-2)'};

  .spin {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`

const AnswerArea = styled.div`
  border: 0.5px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
`

const AnswerHeader = styled.div`
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 500;
  background: var(--color-background-soft);
  border-bottom: 0.5px solid var(--color-border);
`

const AnswerContent = styled.div`
  padding: 12px;
  font-size: 14px;
  line-height: 1.6;
  max-height: 50vh;
  overflow-y: auto;
`

const TraceSection = styled.div`
  border: 0.5px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
`

const TraceSectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 500;
  background: var(--color-background-soft);
  cursor: pointer;
  user-select: none;
  &:hover {
    background: var(--color-background-mute);
  }
`

const IdleMessage = styled.div`
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  color: var(--color-text-3);
  font-size: 14px;
  text-align: center;
  padding: 40px;
`

export default AIServiceWorkbench
