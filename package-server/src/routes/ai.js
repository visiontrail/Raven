const express = require('express')
const fetch = require('node-fetch')

const router = express.Router()

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:9090'

// POST /api/ai/search -> proxy to Python /rag/search
router.post('/search', async (req, res) => {
  try {
    const upstream = await fetch(`${AI_SERVICE_URL}/rag/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    })

    if (!upstream.ok) {
      const text = await upstream.text()
      return res.status(502).json({ success: false, message: `AI后端错误: ${text}` })
    }

    const data = await upstream.json()
    return res.json({ success: true, data })
  } catch (error) {
    console.error('AI /search error:', error)
    return res.status(500).json({ success: false, message: 'AI搜索失败' })
  }
})

// GET /api/ai/chat/stream -> proxy SSE to Python /rag/chat/stream
router.get('/chat/stream', async (req, res) => {
  try {
    const url = new URL(`${AI_SERVICE_URL}/rag/chat/stream`)
    if (req.query.question) url.searchParams.set('question', req.query.question)
    if (req.query.ids) url.searchParams.set('ids', req.query.ids)

    const upstream = await fetch(url.toString())
    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => '')
      return res.status(502).json({ success: false, message: `AI后端错误: ${text}` })
    }

    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    })
    if (res.flushHeaders) res.flushHeaders()

    upstream.body.on('data', (chunk) => res.write(chunk))
    upstream.body.on('end', () => res.end())
    upstream.body.on('error', (err) => {
      console.error('AI stream error:', err)
      try {
        res.end()
      } catch {}
    })

    req.on('close', () => {
      try {
        upstream.body.destroy()
      } catch {}
    })
  } catch (error) {
    console.error('AI /chat/stream error:', error)
    try {
      res.end()
    } catch {}
  }
})

module.exports = router
