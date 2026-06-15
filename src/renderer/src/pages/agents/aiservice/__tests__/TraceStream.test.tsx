import type { AgentTraceEvent } from '@renderer/types/aiServiceAgent'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import TraceStream from '../TraceStream'

function getTraceBody(): HTMLDivElement {
  const header = screen.getByText(/运行轨迹/).closest('div')
  const body = header?.nextElementSibling
  if (!(body instanceof HTMLDivElement)) {
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
  it('keeps the trace body pinned to the bottom as new events stream in', () => {
    const events: AgentTraceEvent[] = [{ seq: 1, type: 'run_start' }]
    const { rerender } = render(<TraceStream events={events} running eventCount={events.length} />)
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
    const { rerender } = render(<TraceStream events={events} running eventCount={events.length} />)
    const body = getTraceBody()

    setScrollMetrics(body, { scrollHeight: 500, clientHeight: 100, scrollTop: 150 })
    fireEvent.scroll(body)

    events.push({ seq: 2, type: 'system_notice', detail: '分析日志片段' })
    setScrollMetrics(body, { scrollHeight: 800, clientHeight: 100, scrollTop: 150 })
    rerender(<TraceStream events={events} running eventCount={events.length} />)
    expect(body.scrollTop).toBe(150)

    setScrollMetrics(body, { scrollHeight: 800, clientHeight: 100, scrollTop: 700 })
    fireEvent.scroll(body)

    events.push({ seq: 3, type: 'run_complete' })
    setScrollMetrics(body, { scrollHeight: 900, clientHeight: 100, scrollTop: 700 })
    rerender(<TraceStream events={events} running={false} eventCount={events.length} />)
    expect(body.scrollTop).toBe(900)
  })
})
