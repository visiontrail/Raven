const express = require('express')
const path = require('path')
const cors = require('cors')
const fs = require('fs')

// 导入路由
const packagesRouter = require('./routes/packages')
const uploadRouter = require('./routes/upload')
const downloadRouter = require('./routes/download')
const aiRouter = require('./routes/ai')

const app = express()
const PORT = process.env.PORT || 8083
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads')

// 确保上传目录存在
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

// 中间件配置
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// 请求日志中间件
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - 收到请求`)
  next()
})

// 静态文件服务
app.use(express.static(path.join(__dirname, '../public')))

// API 路由
app.use('/api/packages', packagesRouter)
app.use('/api/upload', uploadRouter)
app.use('/api/download', downloadRouter)
app.use('/api/ai', aiRouter)

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
})

// 404 处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  })
})

// 错误处理中间件
app.use((error, req, res) => {
  console.error('Server error:', error)
  res.status(500).json({
    success: false,
    message: '服务器内部错误'
  })
})

// 启动服务器
app.listen(PORT, () => {
  console.log(`\n🚀 Galaxy Package Server 启动成功!`)
  console.log(`📦 服务地址: http://localhost:${PORT}`)
  console.log(`📁 上传目录: ${UPLOAD_DIR}`)
  console.log(`⚡ 环境: ${process.env.NODE_ENV || 'development'}`)
  console.log(`\n访问 http://localhost:${PORT} 开始使用包管理系统\n`)
})
