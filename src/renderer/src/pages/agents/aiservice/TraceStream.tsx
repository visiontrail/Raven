import type { AgentTraceEvent } from '@renderer/types/aiServiceAgent'
import type { TFunction } from 'i18next'
import { Brain, ChevronDown, ChevronRight, CircleAlert, Info, Loader2, Wrench } from 'lucide-react'
import { FC, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface Props {
  events: AgentTraceEvent[]
  running: boolean
  /**
   * Length of `events`. The array is mutated in place upstream, so its reference
   * is stable; this primitive is what actually changes and re-triggers the
   * `buildRows` memo as new trace events stream in.
   */
  eventCount: number
}

type Row =
  | { kind: 'tool'; id: string; tool: string; status: 'running' | 'ok' | 'error'; output: string; duration?: number }
  | { kind: 'thinking'; id: string; text: string }
  | { kind: 'notice'; id: string; text: string }
  | { kind: 'status'; id: string; text: string }
  | { kind: 'error'; id: string; text: string }

const AUTO_SCROLL_BOTTOM_THRESHOLD = 32
const TECHNICAL_TRACE_VALUES = new Set([
  'thinking_tokens',
  'reasoning_tokens',
  'reasoning_mode',
  'thinking_budget',
  'max_thinking_tokens'
])

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function isTechnicalTraceText(text: string): boolean {
  return TECHNICAL_TRACE_VALUES.has(text.trim().toLowerCase())
}

function readableText(text: string): string {
  const trimmed = text.trim()
  return trimmed && !isTechnicalTraceText(trimmed) ? trimmed : ''
}

function buildRows(events: AgentTraceEvent[], t: TFunction): Row[] {
  const rows: Row[] = []
  const toolByStep = new Map<string, Extract<Row, { kind: 'tool' }>>()
  const thinkByStep = new Map<string, { row?: Extract<Row, { kind: 'thinking' }>; text: string }>()
  let counter = 0
  const nextId = () => `r${counter++}`

  const ensureThinkingRow = (stepId: string): Extract<Row, { kind: 'thinking' }> => {
    let state = thinkByStep.get(stepId)
    if (!state) {
      state = { text: '' }
      thinkByStep.set(stepId, state)
    }
    if (!state.row) {
      state.row = { kind: 'thinking', id: nextId(), text: '' }
      rows.push(state.row)
    }
    return state.row
  }

  for (const ev of events) {
    const stepId = str(ev.step_id)
    switch (ev.type) {
      case 'run_start':
        rows.push({ kind: 'status', id: nextId(), text: t('agents.aiservice.trace.status.run_start') })
        break
      case 'step_start': {
        const row: Extract<Row, { kind: 'tool' }> = {
          kind: 'tool',
          id: nextId(),
          tool: str(ev.tool_name) || t('agents.aiservice.trace.tool'),
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
        if (!thinkByStep.has(stepId)) thinkByStep.set(stepId, { text: '' })
        break
      }
      case 'thinking_delta': {
        const chunk = str(ev.text_chunk)
        if (!chunk) break
        const state = thinkByStep.get(stepId) || { text: '' }
        state.text += chunk
        thinkByStep.set(stepId, state)
        const text = readableText(state.text)
        if (text) ensureThinkingRow(stepId).text = text
        break
      }
      case 'thinking_end': {
        const state = thinkByStep.get(stepId) || { text: '' }
        const text = readableText(str(ev.text) || state.text)
        if (text) ensureThinkingRow(stepId).text = text
        break
      }
      case 'system_notice': {
        const text = readableText(str(ev.detail) || str(ev.subtype) || str(ev.kind))
        if (text) rows.push({ kind: 'notice', id: nextId(), text })
        break
      }
      case 'result_validation':
        rows.push({ kind: 'status', id: nextId(), text: t('agents.aiservice.trace.status.result_validation') })
        break
      case 'run_complete':
        rows.push({ kind: 'status', id: nextId(), text: t('agents.aiservice.trace.status.run_complete') })
        break
      case 'cancelled':
        rows.push({ kind: 'status', id: nextId(), text: t('agents.aiservice.trace.status.cancelled') })
        break
      case 'error':
        rows.push({ kind: 'error', id: nextId(), text: str(ev.message) || t('agents.aiservice.trace.status.error') })
        break
      default:
        break
    }
  }
  return rows
}

const TraceStream: FC<Props> = ({ events, running, eventCount }) => {
  const { t } = useTranslation()
  // `eventCount` is intentionally in the dep list: `events` is mutated in place,
  // so its reference alone never invalidates the memo. The linter can't see the
  // mutation and flags it as unnecessary, hence the disable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rows = useMemo(() => buildRows(events, t), [events, eventCount, t])
  const [expanded, setExpanded] = useState(() => running)
  const bodyRef = useRef<HTMLDivElement>(null)
  const shouldAutoScrollRef = useRef(true)
  const previousRunningRef = useRef(running)

  const scrollToBottom = useCallback(() => {
    const el = bodyRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [])

  const handleBodyScroll = useCallback(() => {
    const el = bodyRef.current
    if (!el) return
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    shouldAutoScrollRef.current = distanceToBottom <= AUTO_SCROLL_BOTTOM_THRESHOLD
  }, [])

  const toggleExpanded = useCallback(() => {
    setExpanded((value) => {
      const next = !value
      if (next) shouldAutoScrollRef.current = true
      return next
    })
  }, [])

  useLayoutEffect(() => {
    const wasRunning = previousRunningRef.current
    previousRunningRef.current = running

    if (!wasRunning && running) {
      shouldAutoScrollRef.current = true
      setExpanded(true)
      return
    }

    if (wasRunning && !running) {
      setExpanded(false)
    }
  }, [running])

  useLayoutEffect(() => {
    if (!expanded || !shouldAutoScrollRef.current) return
    scrollToBottom()
  }, [eventCount, expanded, rows.length, running, scrollToBottom])

  if (rows.length === 0 && !running) return null

  return (
    <Wrapper>
      <Header onClick={toggleExpanded}>
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {running ? <Loader2 size={13} className="spin" /> : null}
        <span>
          {t('agents.aiservice.trace.title')}
          {rows.length ? ` · ${rows.length}` : ''}
        </span>
      </Header>
      {expanded && (
        <Body ref={bodyRef} onScroll={handleBodyScroll}>
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
                        {row.status === 'running'
                          ? t('agents.aiservice.trace.badge.running')
                          : row.status === 'ok'
                            ? t('agents.aiservice.trace.badge.ok')
                            : t('agents.aiservice.trace.badge.error')}
                      </RowBadge>
                      {typeof row.duration === 'number' && <RowMeta>{row.duration.toFixed(1)}s</RowMeta>}
                    </RowTitle>
                    {row.output.trim() && <RowText>{row.output.trim().slice(0, 600)}</RowText>}
                  </>
                )}
                {row.kind === 'thinking' && (
                  <>
                    <RowTitle>{t('agents.aiservice.trace.thinking')}</RowTitle>
                    {row.text.trim() && <RowText className="dim">{row.text.trim().slice(0, 600)}</RowText>}
                  </>
                )}
                {(row.kind === 'notice' || row.kind === 'status') && <RowText>{row.text}</RowText>}
                {row.kind === 'error' && <RowText className="err">{row.text}</RowText>}
              </RowBody>
            </RowItem>
          ))}
          {rows.length === 0 && running && <RowText className="dim">{t('agents.aiservice.trace.preparing')}</RowText>}
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
