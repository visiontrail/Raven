import type { SSEFrame } from '@renderer/types/aiServiceAgent'

export function parseSSEFrames(chunk: string): SSEFrame[] {
  const frames: SSEFrame[] = []
  const rawFrames = chunk.split(/\n\n|\r\n\r\n/)

  for (const raw of rawFrames) {
    const trimmed = raw.trim()
    if (!trimmed) continue

    let event: string | undefined
    let dataStr = ''

    for (const line of trimmed.split(/\r?\n/)) {
      if (line.startsWith('event:')) {
        event = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        const val = line.slice(5).trim()
        if (val) dataStr += val
      }
    }

    if (!dataStr) continue

    try {
      const data = JSON.parse(dataStr) as Record<string, unknown>
      frames.push({ event, data })
    } catch {
      // Skip malformed JSON frames
    }
  }

  return frames
}

export async function* streamSSE(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal?: AbortSignal
): AsyncGenerator<SSEFrame> {
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      if (signal?.aborted) break
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      const parts = buffer.split(/\n\n|\r\n\r\n/)
      buffer = parts.pop() || ''

      for (const part of parts) {
        const frames = parseSSEFrames(part + '\n\n')
        for (const frame of frames) {
          yield frame
        }
      }
    }

    if (buffer.trim()) {
      const frames = parseSSEFrames(buffer + '\n\n')
      for (const frame of frames) {
        yield frame
      }
    }
  } finally {
    reader.releaseLock()
  }
}
