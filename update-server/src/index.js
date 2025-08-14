const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs-extra');
require('dotenv').config();

const logger = require('./utils/logger');
const versionRoutes = require('./routes/version');
const downloadRoutes = require('./routes/download');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// 安全中间件
app.use(helmet());
app.use(cors());

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 限制每个IP 15分钟内最多100个请求
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// 解析JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use('/releases', express.static(path.join(__dirname, '../releases')));

// 路由
app.use('/api/version', versionRoutes);
app.use('/api/download', downloadRoutes);
app.use('/api/admin', adminRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// 启动服务器
app.listen(PORT, () => {
  logger.info(`Raven Update Server is running on port ${PORT}`);
  
  // 确保必要的目录存在
  const dirs = ['releases', 'data'];
  dirs.forEach(dir => {
    const dirPath = path.join(__dirname, '..', dir);
    fs.ensureDirSync(dirPath);
    logger.info(`Ensured directory exists: ${dirPath}`);
  });
});

module.exports = app;