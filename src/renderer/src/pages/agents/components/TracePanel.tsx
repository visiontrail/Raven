import type { AgentTraceEvent } from '@renderer/types/aiServiceAgent'
import { Tag } from 'antd'
import { FC } from 'react'
import styled from 'styled-components'

interface Props {
  events: AgentTraceEvent[]
}

const TYPE_COLORS: Record<string, string> = {
  run_start: 'blue',
  step_start: 'cyan',
  step_delta: 'default',
  step_end: 'cyan',
  thinking_start: 'purple',
  thinking_delta: 'default',
  thinking_end: 'purple',
  system_notice: 'orange',
  answer_delta: 'green',
  run_complete: 'green',
  cancelled: 'gold',
  error: 'red'
}

const TYPE_LABELS: Record<string, string> = {
  run_start: '运行开始',
  step_start: '工具调用',
  step_delta: '工具输出',
  step_end: '工具完成',
  thinking_start: '思考开始',
  thinking_delta: '思考中',
  thinking_end: '思考结束',
  system_notice: '系统通知',
  answer_delta: '回答',
  run_complete: '运行完成',
  cancelled: '已取消',
  error: '错误'
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('zh-CN', { hour12: false })
}

function getEventSummary(event: AgentTraceEvent): string {
  const d = event.data || {}

  if (event.type === 'step_start' || event.type === 'step_end') {
    const tool = (d.tool_name as string) || (d.name as string) || ''
    const status = (d.status as string) || ''
    return tool ? `${tool}${status ? ` (${status})` : ''}` : ''
  }

  if (event.type === 'system_notice') {
    return (d.message as string) || (d.content as string) || ''
  }

  if (event.type === 'error') {
    return (d.message as string) || (d.detail as string) || ''
  }

  if (event.type === 'answer_delta') {
    const content = (d.content as string) || ''
    return content.length > 60 ? content.slice(0, 60) + '...' : content
  }

  if (event.type === 'thinking_delta') {
    const content = (d.content as string) || ''
    return content.length > 60 ? content.slice(0, 60) + '...' : content
  }

  return ''
}

const TracePanel: FC<Props> = ({ events }) => {
  const displayEvents = events.filter((e) => e.type !== 'answer_delta')

  return (
    <TraceList>
      {displayEvents.map((event, idx) => {
        const summary = getEventSummary(event)
        return (
          <TraceItem key={idx}>
            <TraceTime>{formatTime(event.timestamp)}</TraceTime>
            <Tag color={TYPE_COLORS[event.type] || 'default'} style={{ fontSize: 11, margin: 0 }}>
              {TYPE_LABELS[event.type] || event.type}
            </Tag>
            {summary && <TraceSummary>{summary}</TraceSummary>}
          </TraceItem>
        )
      })}
      {events.length === 0 && <EmptyTrace>暂无 trace 事件</EmptyTrace>}
    </TraceList>
  )
}

const TraceList = styled.div`
  max-height: 300px;
  overflow-y: auto;
  padding: 8px 12px;
`

const TraceItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  border-bottom: 0.5px solid var(--color-border);
  &:last-child {
    border-bottom: none;
  }
`

const TraceTime = styled.span`
  font-size: 11px;
  color: var(--color-text-3);
  font-family: monospace;
  min-width: 60px;
`

const TraceSummary = styled.span`
  font-size: 12px;
  color: var(--color-text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
`

const EmptyTrace = styled.div`
  text-align: center;
  color: var(--color-text-3);
  font-size: 12px;
  padding: 16px;
`

export default TracePanel
