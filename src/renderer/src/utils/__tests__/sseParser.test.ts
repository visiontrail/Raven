import { describe, expect, it } from 'vitest'

import { parseSSEFrames } from '../sseParser'

describe('parseSSEFrames', () => {
  it('should parse a single data frame', () => {
    const chunk = 'data: {"type":"answer_delta","content":"hello"}\n\n'
    const frames = parseSSEFrames(chunk)
    expect(frames).toHaveLength(1)
    expect(frames[0].data).toEqual({ type: 'answer_delta', content: 'hello' })
  })

  it('should parse multiple frames separated by double newlines', () => {
    const chunk =
      'data: {"type":"answer_delta","content":"a"}\n\n' +
      'data: {"type":"answer_delta","content":"b"}\n\n'
    const frames = parseSSEFrames(chunk)
    expect(frames).toHaveLength(2)
    expect(frames[0].data.content).toBe('a')
    expect(frames[1].data.content).toBe('b')
  })

  it('should handle CRLF line endings', () => {
    const chunk = 'data: {"type":"done"}\r\n\r\n'
    const frames = parseSSEFrames(chunk)
    expect(frames).toHaveLength(1)
    expect(frames[0].data.type).toBe('done')
  })

  it('should parse event field', () => {
    const chunk = 'event: message\ndata: {"type":"run_start"}\n\n'
    const frames = parseSSEFrames(chunk)
    expect(frames).toHaveLength(1)
    expect(frames[0].event).toBe('message')
  })

  it('should ignore empty frames', () => {
    const chunk = '\n\n\n\ndata: {"type":"done"}\n\n\n\n'
    const frames = parseSSEFrames(chunk)
    expect(frames).toHaveLength(1)
  })

  it('should skip malformed JSON', () => {
    const chunk = 'data: {not valid json}\n\n' + 'data: {"type":"done"}\n\n'
    const frames = parseSSEFrames(chunk)
    expect(frames).toHaveLength(1)
    expect(frames[0].data.type).toBe('done')
  })

  it('should skip frames with no data field', () => {
    const chunk = 'event: ping\n\n'
    const frames = parseSSEFrames(chunk)
    expect(frames).toHaveLength(0)
  })

  it('should return empty array for empty input', () => {
    expect(parseSSEFrames('')).toEqual([])
    expect(parseSSEFrames('\n\n')).toEqual([])
  })

  it('should handle mixed CRLF and LF', () => {
    const chunk = 'data: {"a":1}\r\n\r\ndata: {"b":2}\n\n'
    const frames = parseSSEFrames(chunk)
    expect(frames).toHaveLength(2)
  })
})
