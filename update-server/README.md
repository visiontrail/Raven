# Raven 自定义更新服务器

这是一个为 Raven 应用程序设计的自定义更新服务器，支持版本管理、文件上传和自动更新检查。

## 功能特性

- 🚀 版本管理和发布
- 📦 文件上传和存储
- 🔍 自动更新检查
- 📊 下载统计
- 🔒 API 密钥认证
- 📱 多平台支持
- 🔄 断点续传
- 📋 兼容 electron-updater

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env` 并修改配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
PORT=8082
BASE_URL=https://your-update-server.com
ADMIN_API_KEY=your-super-secret-admin-key
LOG_LEVEL=info
```

### 3. 启动服务器

开发模式：
```bash
npm run dev
```

生产模式：
```bash
npm start
```

## 前端管理页面

服务器启动后，可以通过浏览器访问管理页面：

- **上传页面**: `http://localhost:8082/upload.html` 或 `http://localhost:8082/`
- **功能特性**:
  - 🔐 API密钥认证
  - 📁 拖拽上传文件
  - 📊 上传进度显示
  - 📝 版本说明编辑
  - 📋 版本列表管理
  - 🗑️ 版本删除功能
  - 📱 响应式设计

**使用步骤**:
1. 输入管理员API密钥（在`.env`文件中配置的`ADMIN_API_KEY`）
2. 填写版本号（如：1.0.0）
3. 添加版本更新说明
4. 选择或拖拽文件到上传区域
5. 点击"上传版本"按钮

## API 文档

### 公开 API

#### 获取最新版本
```http
GET /api/version/latest
```

#### 检查更新
```http
GET /api/version/check?current=1.0.0&platform=win32&arch=x64
```

#### 获取版本列表
```http
GET /api/version/list
```

#### 下载文件
```http
GET /api/download/:version/:filename
```

### 管理 API（需要 API 密钥）

#### 创建版本
```http
POST /api/admin/version
Headers: X-API-Key: your-api-key
Content-Type: application/json

{
  "version": "1.0.0",
  "changelog": "新功能和修复",
  "required": false,
  "minVersion": "0.9.0"
}
```

#### 上传文件
```http
POST /api/admin/version/:version/upload
Headers: X-API-Key: your-api-key
Content-Type: multipart/form-data

file: [binary file]
platform: win32
arch: x64
```

#### 更新版本信息
```http
PUT /api/admin/version/:version
Headers: X-API-Key: your-api-key
Content-Type: application/json

{
  "changelog": "更新的说明",
  "required": true
}
```

#### 删除版本
```http
DELETE /api/admin/version/:version
Headers: X-API-Key: your-api-key
```

#### 获取服务器状态
```http
GET /api/admin/status
Headers: X-API-Key: your-api-key
```

## 部署指南

### 使用 PM2 部署

1. 安装 PM2：
```bash
npm install -g pm2
```

2. 创建 PM2 配置文件 `ecosystem.config.js`：
```javascript
module.exports = {
  apps: [{
    name: 'raven-update-server',
    script: 'src/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env:
      NODE_ENV: 'production',
      PORT: 8082
    }
  }]
};
```

3. 启动应用：
```bash
pm2 start ecosystem.config.js
```

### 使用 Docker 部署

#### 方式一：使用提供的脚本（推荐）

我们提供了便捷的脚本来管理 Docker 容器：

**Linux/macOS:**
```bash
# 部署服务
./scripts/deploy.sh

# 停止服务
./scripts/stop.sh

# 重启服务
./scripts/restart.sh
```

**Windows:**
```cmd
REM 部署服务
scripts\deploy.bat

REM 停止服务
scripts\stop.bat

REM 重启服务
scripts\restart.bat
```

#### 方式二：手动部署

1. 创建环境配置：
```bash
cp .env.example .env
# 编辑 .env 文件配置
```

2. 构建和运行：
```bash
docker build -t raven-update-server .
docker run -d \
  --name raven-update-server \
  --restart unless-stopped \
  -p 8082:8082 \
  --env-file .env \
  -v "$(pwd)/data:/app/data" \
  -v "$(pwd)/releases:/app/releases" \
  -v "$(pwd)/logs:/app/logs" \
  raven-update-server
```

### Nginx 反向代理配置

```nginx
server {
    listen 80;
    server_name your-update-server.com;
    
    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-update-server.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # 增加上传文件大小限制
    client_max_body_size 500M;
    
    location / {
        proxy_pass http://localhost:8082;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # 静态文件缓存
    location /releases/ {
        proxy_pass http://localhost:8082;
        proxy_cache_valid 200 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## 使用示例

### 发布新版本

1. 创建版本：
```bash
curl -X POST https://your-server.com/api/admin/version \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.1.0",
    "changelog": "修复了一些bug，添加了新功能",
    "required": false
  }'
```

2. 上传文件：
```bash
# Windows 版本
curl -X POST https://your-server.com/api/admin/version/1.1.0/upload \
  -H "X-API-Key: your-api-key" \
  -F "file=@Raven-1.1.0-x64-setup.exe" \
  -F "platform=win32" \
  -F "arch=x64"

# macOS 版本
curl -X POST https://your-server.com/api/admin/version/1.1.0/upload \
  -H "X-API-Key: your-api-key" \
  -F "file=@Raven-1.1.0-x64.dmg" \
  -F "platform=darwin" \
  -F "arch=x64"
```

### 检查更新

```bash
curl "https://your-server.com/api/version/check?current=1.0.0&platform=win32&arch=x64"
```

## 监控和维护

### 日志文件

- 应用日志：`logs/combined.log`
- 错误日志：`logs/error.log`

### 健康检查

```bash
curl https://your-server.com/health
```

### 备份

定期备份以下内容：
- 版本数据：`data/versions.json`
- 发布文件：`releases/` 目录
- 配置文件：`.env`

## 故障排除

### 常见问题

1. **文件上传失败**
   - 检查文件大小限制
   - 确认磁盘空间充足
   - 验证 API 密钥

2. **更新检查失败**
   - 检查网络连接
   - 验证服务器状态
   - 查看日志文件

3. **下载速度慢**
   - 配置 CDN
   - 优化服务器带宽
   - 启用文件压缩

### 性能优化

1. 使用 CDN 分发文件
2. 启用 Gzip 压缩
3. 配置适当的缓存策略
4. 使用负载均衡

## 安全建议

1. 使用强 API 密钥
2. 启用 HTTPS
3. 定期更新依赖
4. 限制文件上传大小
5. 监控异常访问
6. 定期备份数据

## 许可证

MIT License