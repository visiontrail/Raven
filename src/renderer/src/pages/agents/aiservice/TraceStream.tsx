import type { AgentTraceEvent } from '@renderer/types/aiServiceAgent'
import { Brain, ChevronDown, ChevronRight, CircleAlert, Info, Loader2, Wrench } from 'lucide-react'
import { FC, useMemo, useState } from 'react'
import styled from 'styled-components'

interface Props {
  events: AgentTraceEvent[]
  running: boolean
}

type Row =
  | { kind: 'tool'; id: string; tool: string; status: 'running' | 'ok' | 'error'; output: string; duration?: number }
  | { kind: 'thinking'; id: string; text: string }
  | { kind: 'notice'; id: string; text: string }
  | { kind: 'status'; id: string; text: string }
  | { kind: 'error'; id: string; text: string }

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function buildRows(events: AgentTraceEvent[]): Row[] {
  const rows: Row[] = []
  const toolByStep = new Map<string, Extract<Row, { kind: 'tool' }>>()
  const thinkByStep = new Map<string, Extract<Row, { kind: 'thinking' }>>()
  let counter = 0
  const nextId = () => `r${counter++}`

  for (const ev of events) {
    const stepId = str(ev.step_id)
    switch (ev.type) {
      case 'run_start':
        rows.push({ kind: 'status', id: nextId(), text: '开始运行' })
        break
      case 'step_start': {
        const row: Extract<Row, { kind: 'tool' }> = {
          kind: 'tool',
          id: nextId(),
          tool: str(ev.tool_name) || '工具',
          status: 'running',
          output: ''
        }
        toolByStep.set(stepId, row)
        rows.push(row)
        break
      }
      case 'step_delta': {
        const row = toolByStep.get(stepId)
        if (row) row.output += str(ev.output_chunk)
        break
      }
      case 'step_end': {
        const row = toolByStep.get(stepId)
        if (row) {
          row.status = ev.status === 'error' ? 'error' : 'ok'
          if (typeof ev.duration_seconds === 'number') row.duration = ev.duration_seconds
          const excerpt = str(ev.output_excerpt)
          if (excerpt) row.output = excerpt
        }
        break
      }
      case 'thinking_start': {
        const row: Extract<Row, { kind: 'thinking' }> = { kind: 'thinking', id: nextId(), text: '' }
        thinkByStep.set(stepId, row)
        rows.push(row)
        break
      }
      case 'thinking_delta': {
        const row = thinkByStep.get(stepId)
        if (row) row.text += str(ev.text_chunk)
        break
      }
      case 'thinking_end': {
        const row = thinkByStep.get(stepId)
        const text = str(ev.text)
        if (row && text) row.text = text
        break
      }
      case 'system_notice': {
        const text = str(ev.detail) || str(ev.subtype) || str(ev.kind)
        if (text) rows.push({ kind: 'notice', id: nextId(), text })
        break
      }
      case 'run_complete':
        rows.push({ kind: 'status', id: nextId(), text: '运行完成' })
        break
      case 'cancelled':
        rows.push({ kind: 'status', id: nextId(), text: '已取消' })
        break
      case 'error':
        rows.push({ kind: 'error', id: nextId(), text: str(ev.message) || '运行出错' })
        break
      default:
        break
    }
  }
  return rows
}

const TraceStream: FC<Props> = ({ events, running }) => {
  const rows = useMemo(() => buildRows(events), [events])
  const [expanded, setExpanded] = useState(true)

  if (rows.length === 0 && !running) return null

  return (
    <Wrapper>
      <Header onClick={() => setExpanded((v) => !v)}>
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {running ? <Loader2 size={13} className="spin" /> : null}
        <span>运行轨迹{rows.length ? ` · ${rows.length}` : ''}</span>
      </Header>
      {expanded && (
        <Body>
          {rows.map((row) => (
            <RowItem key={row.id}>
              <RowIcon $kind={row.kind}>
                {row.kind === 'tool' && <Wrench size={12} />}
                {row.kind === 'thinking' && <Brain size={12} />}
                {row.kind === 'notice' && <Info size={12} />}
                {row.kind === 'status' && <Info size={12} />}
                {row.kind === 'error' && <CircleAlert size={12} />}
              </RowIcon>
              <RowBody>
                {row.kind === 'tool' && (
                  <>
                    <RowTitle>
                      {row.tool}
                      <RowBadge $status={row.status}>
                        {row.status === 'running' ? '执行中' : row.status === 'ok' ? '完成' : '失败'}
                      </RowBadge>
                      {typeof row.duration === 'number' && <RowMeta>{row.duration.toFixed(1)}s</RowMeta>}
                    </RowTitle>
                    {row.output.trim() && <RowText>{row.output.trim().slice(0, 600)}</RowText>}
                  </>
                )}
                {row.kind === 'thinking' && (
                  <>
                    <RowTitle>思考</RowTitle>
                    {row.text.trim() && <RowText className="dim">{row.text.trim().slice(0, 600)}</RowText>}
                  </>
                )}
                {(row.kind === 'notice' || row.kind === 'status') && <RowText>{row.text}</RowText>}
                {row.kind === 'error' && <RowText className="err">{row.text}</RowText>}
              </RowBody>
            </RowItem>
          ))}
          {rows.length === 0 && running && <RowText className="dim">正在准备…</RowText>}
        </Body>
      )}
    </Wrapper>
  )
}

const Wrapper = styled.div`
  border: 0.5px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-background-soft);
  margin-bottom: 10px;
`

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-2);
  cursor: pointer;
  user-select: none;

  .spin {
    animation: rw-spin 1s linear infinite;
  }
  @keyframes rw-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 10px 10px;
  max-height: 320px;
  overflow-y: auto;
`

const RowItem = styled.div`
  display: flex;
  gap: 8px;
`

const RowIcon = styled.div<{ $kind: string }>`
  flex-shrink: 0;
  margin-top: 1px;
  color: ${({ $kind }) =>
    $kind === 'error' ? 'var(--color-error)' : $kind === 'thinking' ? '#a855f7' : 'var(--color-text-3)'};
`

const RowBody = styled.div`
  flex: 1;
  min-width: 0;
`

const RowTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: var(--color-text-1);
`

const RowBadge = styled.span<{ $status: string }>`
  font-size: 10px;
  padding: 0 5px;
  border-radius: 4px;
  color: ${({ $status }) => ($status === 'error' ? '#ff4d4f' : $status === 'ok' ? '#52c41a' : 'var(--color-text-3)')};
  background: ${({ $status }) =>
    $status === 'error'
      ? 'rgba(255,77,79,0.1)'
      : $status === 'ok'
        ? 'rgba(82,196,26,0.1)'
        : 'var(--color-background-mute)'};
`

const RowMeta = styled.span`
  font-size: 10px;
  color: var(--color-text-3);
  font-family: monospace;
`

const RowText = styled.div`
  font-size: 12px;
  color: var(--color-text-2);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;

  &.dim {
    color: var(--color-text-3);
  }
  &.err {
    color: var(--color-error);
  }
`

export default TraceStream
