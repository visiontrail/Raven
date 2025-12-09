const express = require('express')
const path = require('path')
const cors = require('cors')
const fs = require('fs')
const PackageServiceSingleton = require('./services/PackageServiceSingleton')
const getRAGServiceInstance = require('./services/RAGServiceSingleton')

// 导入路由
const packagesRouter = require('./routes/packages')
const uploadRouter = require('./routes/upload')
const downloadRouter = require('./routes/download')
const searchRouter = require('./routes/search')

const app = express()
const PORT = process.env.PORT || 8083
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads')
const packageService = new PackageServiceSingleton()
const ragService = getRAGServiceInstance()

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

// 包详情独立页面路由（支持可分享的 URL）
app.get('/package/:id', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/package-detail.html'))
})

// API 路由
app.use('/api/packages', packagesRouter)
app.use('/api/upload', uploadRouter)
app.use('/api/download', downloadRouter)
app.use('/api/search', searchRouter)

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
})

// 启动时检查并初始化智能搜索向量索引
async function initializeRagIndexOnStartup() {
  try {
    console.log('🧠 启动检查: 正在验证智能搜索向量索引状态...')
    const packages = await packageService.getAllPackages()
    const ready = await ragService.ensureInitialized(packages)

    if (ready) {
      console.log('✅ 智能搜索服务在线，向量索引已就绪')
    } else if (packages.length === 0) {
      console.log('ℹ️ 暂无包数据，跳过向量索引初始化')
    } else {
      console.warn('⚠️ 向量索引未初始化完成，请稍后尝试手动重建')
    }
  } catch (error) {
    console.error('❌ 启动时检查智能搜索索引失败:', error)
  }
}

initializeRagIndexOnStartup()

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
