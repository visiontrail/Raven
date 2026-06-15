import type { AgentTraceEvent } from '@renderer/types/aiServiceAgent'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it } from 'vitest'

import i18n from '../../../../i18n'
import TraceStream from '../TraceStream'

function I18nWrapper({ children }: { children: ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}

function renderTrace(component: ReactNode) {
  return render(component, { wrapper: I18nWrapper })
}

function queryTraceBody(): HTMLDivElement | null {
  const header = screen.getByText(/运行轨迹/).closest('div')
  const body = header?.nextElementSibling
  return body instanceof HTMLDivElement ? body : null
}

function getTraceBody(): HTMLDivElement {
  const body = queryTraceBody()
  if (!body) {
    throw new Error('Trace stream body not found')
  }
  return body
}

function setScrollMetrics(
  element: HTMLDivElement,
  metrics: { scrollHeight: number; clientHeight: number; scrollTop: number }
) {
  Object.defineProperties(element, {
    scrollHeight: { configurable: true, writable: true, value: metrics.scrollHeight },
    clientHeight: { configurable: true, writable: true, value: metrics.clientHeight },
    scrollTop: { configurable: true, writable: true, value: metrics.scrollTop }
  })
}

describe('TraceStream', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-CN')
  })

  it('keeps the trace body pinned to the bottom as new events stream in', () => {
    const events: AgentTraceEvent[] = [{ seq: 1, type: 'run_start' }]
    const { rerender } = renderTrace(<TraceStream events={events} running eventCount={events.length} />)
    const body = getTraceBody()

    setScrollMetrics(body, { scrollHeight: 240, clientHeight: 100, scrollTop: 140 })
    fireEvent.scroll(body)

    events.push({ seq: 2, type: 'system_notice', detail: '读取项目上下文' })
    setScrollMetrics(body, { scrollHeight: 420, clientHeight: 100, scrollTop: 140 })
    rerender(<TraceStream events={events} running eventCount={events.length} />)

    expect(body.scrollTop).toBe(420)
  })

  it('does not force-scroll after the user scrolls up, then resumes when they return to bottom', () => {
    const events: AgentTraceEvent[] = [{ seq: 1, type: 'run_start' }]
    const { rerender } = renderTrace(<TraceStream events={events} running eventCount={events.length} />)
    const body = getTraceBody()

    setScrollMetrics(body, { scrollHeight: 500, clientHeight: 100, scrollTop: 150 })
    fireEvent.scroll(body)

    events.push({ seq: 2, type: 'system_notice', detail: '分析日志片段' })
    setScrollMetrics(body, { scrollHeight: 800, clientHeight: 100, scrollTop: 150 })
    rerender(<TraceStream events={events} running eventCount={events.length} />)
    expect(body.scrollTop).toBe(150)

    setScrollMetrics(body, { scrollHeight: 800, clientHeight: 100, scrollTop: 700 })
    fireEvent.scroll(body)

    events.push({ seq: 3, type: 'system_notice', detail: '生成候选结论' })
    setScrollMetrics(body, { scrollHeight: 900, clientHeight: 100, scrollTop: 700 })
    rerender(<TraceStream events={events} running eventCount={events.length} />)
    expect(body.scrollTop).toBe(900)
  })

  it('collapses automatically when the run finishes and keeps manual reopen available', () => {
    const events: AgentTraceEvent[] = [
      { seq: 1, type: 'run_start' },
      { seq: 2, type: 'system_notice', detail: '整理最终结论' }
    ]
    const { rerender } = renderTrace(<TraceStream events={events} running eventCount={events.length} />)
    expect(queryTraceBody()).toBeInstanceOf(HTMLDivElement)

    events.push({ seq: 3, type: 'run_complete' })
    rerender(<TraceStream events={events} running={false} eventCount={events.length} />)
    expect(queryTraceBody()).toBeNull()

    fireEvent.click(screen.getByText(/运行轨迹/))
    expect(queryTraceBody()).toBeInstanceOf(HTMLDivElement)

    rerender(<TraceStream events={events} running={false} eventCount={events.length} />)
    expect(queryTraceBody()).toBeInstanceOf(HTMLDivElement)
  })

  it('filters provider thinking-token notices from the user-facing trace', () => {
    const events: AgentTraceEvent[] = [
      { seq: 1, type: 'run_start' },
      { seq: 2, type: 'system_notice', detail: 'thinking_tokens' },
      { seq: 3, type: 'system_notice', subtype: 'reasoning_mode' },
      { seq: 4, type: 'system_notice', kind: 'thinking_budget' },
      { seq: 5, type: 'system_notice', detail: '读取项目上下文' }
    ]

    renderTrace(<TraceStream events={events} running eventCount={events.length} />)

    expect(screen.queryByText('thinking_tokens')).toBeNull()
    expect(screen.queryByText('reasoning_mode')).toBeNull()
    expect(screen.queryByText('thinking_budget')).toBeNull()
    expect(screen.getByText('读取项目上下文')).toBeInTheDocument()
  })

  it('does not render empty thinking placeholders', () => {
    const events: AgentTraceEvent[] = [
      { seq: 1, type: 'run_start' },
      { seq: 2, type: 'thinking_start', step_id: 'think-1' },
      { seq: 3, type: 'thinking_end', step_id: 'think-1' }
    ]

    renderTrace(<TraceStream events={events} running eventCount={events.length} />)

    expect(screen.queryByText('思考')).toBeNull()
  })

  it('keeps meaningful thinking summaries visible', () => {
    const events: AgentTraceEvent[] = [
      { seq: 1, type: 'run_start' },
      { seq: 2, type: 'thinking_start', step_id: 'think-1' },
      { seq: 3, type: 'thinking_delta', step_id: 'think-1', text_chunk: '正在比较异常栈和项目上下文' }
    ]

    renderTrace(<TraceStream events={events} running eventCount={events.length} />)

    expect(screen.getByText('思考')).toBeInTheDocument()
    expect(screen.getByText('正在比较异常栈和项目上下文')).toBeInTheDocument()
  })
})
