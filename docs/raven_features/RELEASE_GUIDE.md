# Raven 项目发布指南

## 概述

本指南详细说明如何发布Raven项目版本，包括构建命令、GitHub发布流程以及自动更新配置。

## 前置准备

### 1. 修改项目配置

#### 更新 package.json
```json
{
  "name": "your-raven-fork",
  "productName": "YourRaven",
  "description": "Your customized Raven application",
  "author": "Your Name <your.email@example.com>",
  "homepage": "https://github.com/yourusername/your-raven-fork",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/your-raven-fork.git"
  }
}
```

#### 更新 electron-builder.yml
```yaml
appId: com.yourcompany.yourraven
productName: YourRaven

# 更新发布配置
publish:
  provider: github
  owner: yourusername
  repo: your-raven-fork
  # 或者使用自定义服务器
  # provider: generic
  # url: https://your-update-server.com
```

#### 更新常量配置 (src/shared/config/constant.ts)
```typescript
export enum FeedUrl {
  PRODUCTION = 'https://your-update-server.com', // 或 GitHub releases
  GITHUB_LATEST = 'https://github.com/yourusername/your-raven-fork/releases/latest/download',
  PRERELEASE_LOWEST = 'https://your-update-server.com/prerelease',
  CUSTOM_SERVER = 'http://localhost:3000'
}
```

### 2. 设置GitHub仓库

#### 创建GitHub Token
1. 访问 GitHub Settings > Developer settings > Personal access tokens
2. 创建新token，权限包括：
   - `repo` (完整仓库访问)
   - `write:packages` (发布包)

#### 配置环境变量

**方式一：Windows PowerShell 临时设置**
```powershell
# 在 PowerShell 中设置（仅当前会话有效）
$env:GH_TOKEN="your_github_token"
$env:CSC_LINK="D:\path\to\your\certificate.p12"  # 使用完整路径
$env:CSC_KEY_PASSWORD="certificate_password"

# 验证设置是否成功
echo $env:GH_TOKEN
```

**方式二：Windows 系统环境变量（永久设置）**
```powershell
# 方法1: 使用 PowerShell 设置用户环境变量
[Environment]::SetEnvironmentVariable("GH_TOKEN", "your_github_token", "User")
[Environment]::SetEnvironmentVariable("CSC_LINK", "D:\path\to\your\certificate.p12", "User")
[Environment]::SetEnvironmentVariable("CSC_KEY_PASSWORD", "certificate_password", "User")

# 方法2: 通过系统设置界面
# 1. Win + R 打开运行对话框
# 2. 输入 sysdm.cpl 并回车
# 3. 点击"高级"选项卡 -> "环境变量"
# 4. 在"用户变量"中点击"新建"
# 5. 分别添加 GH_TOKEN、CSC_LINK、CSC_KEY_PASSWORD
```

**方式三：创建 .env 文件（推荐）**

在项目根目录创建 `.env` 文件：
```bash
# 在项目根目录 (d:\workspace\Code\GalaxySpaceAI\Raven) 创建 .env 文件
# Windows/macOS/Linux 通用方式

# GitHub Token (必需)
GH_TOKEN=your_github_token

# 代码签名证书 (可选)
CSC_LINK=D:\path\to\your\certificate.p12
CSC_KEY_PASSWORD=certificate_password

# macOS 公证 (仅 macOS 需要)
APPLE_ID=your_apple_id@example.com
APPLE_ID_PASSWORD=app_specific_password
APPLE_TEAM_ID=your_team_id
```

**Windows 创建 .env 文件的具体步骤：**
```powershell
# 方法1: 使用 PowerShell 创建
cd D:\workspace\Code\GalaxySpaceAI\Raven
New-Item -Path ".env" -ItemType File
notepad .env  # 用记事本编辑

# 方法2: 使用命令行创建
echo GH_TOKEN=your_github_token > .env
echo CSC_LINK=D:\path\to\your\certificate.p12 >> .env
echo CSC_KEY_PASSWORD=certificate_password >> .env

# 方法3: 直接在文件资源管理器中
# 右键 -> 新建 -> 文本文档 -> 重命名为 .env
# 注意：需要显示文件扩展名才能正确重命名
```

**macOS/Linux 创建 .env 文件：**
```bash
# 在项目根目录
cd /path/to/your/raven/project

# 创建 .env 文件
touch .env

# 编辑文件
nano .env
# 或使用其他编辑器
vim .env
code .env  # VS Code
```

## 构建与发布流程

### 1. 本地构建测试

#### 安装依赖
```bash
yarn install
```

#### 开发环境测试
```bash
yarn dev
```

#### 构建所有平台
```bash
# 构建所有平台
yarn build

# 或分平台构建
yarn build:win    # Windows
yarn build:mac    # macOS
yarn build:linux  # Linux
```

#### 构建输出结果
构建完成后，在 `dist` 目录下会生成：

**Windows:**
- `YourRaven-x.x.x-x64-setup.exe` (NSIS安装包)
- `YourRaven-x.x.x-x64-portable.exe` (便携版)
- `latest.yml` (更新清单)

**macOS:**
- `YourRaven-x.x.x-arm64.dmg` (Apple Silicon)
- `YourRaven-x.x.x-x64.dmg` (Intel)
- `YourRaven-x.x.x-arm64.zip`
- `YourRaven-x.x.x-x64.zip`
- `latest-mac.yml` (更新清单)

**Linux:**
- `YourRaven-x.x.x-x86_64.AppImage`
- `yourraven_x.x.x_amd64.deb`
- `latest-linux.yml` (更新清单)

### 2. 版本发布

#### 更新版本号
```bash
# 自动更新版本号
npm version patch   # 补丁版本 (1.0.0 -> 1.0.1)
npm version minor   # 次要版本 (1.0.0 -> 1.1.0)
npm version major   # 主要版本 (1.0.0 -> 2.0.0)

# 或手动编辑 package.json 中的 version 字段
```

#### 发布到GitHub Releases
```bash
# 构建并自动发布到GitHub
yarn build --publish=always

# 或者分步骤
yarn build
yarn electron-builder --publish=always
```

#### 发布命令选项
```bash
# 仅构建，不发布
yarn build --publish=never

# 构建并发布到GitHub
yarn build --publish=always

# 仅在CI环境发布
yarn build --publish=onTagOrDraft
```

## GitHub自动更新配置

### 1. GitHub Releases方式

#### 自动发布配置
当使用 `--publish=always` 时，electron-builder会：
1. 自动创建GitHub Release
2. 上传所有构建产物
3. 生成更新清单文件
4. 设置release为已发布状态

#### 更新清单文件
GitHub Releases会自动提供以下文件：
- `latest.yml` (Windows更新清单)
- `latest-mac.yml` (macOS更新清单)
- `latest-linux.yml` (Linux更新清单)


---


### 2. 自定义更新服务器方式

#### 部署更新服务器
```bash
# 进入更新服务器目录
cd update-server

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件设置数据库和管理员密钥

# 启动服务器
npm start
```

#### 上传版本到自定义服务器
```bash
# 使用管理员API上传新版本
curl -X POST "https://your-update-server.com/api/version/upload" \
  -H "Authorization: Bearer YOUR_ADMIN_KEY" \
  -F "version=1.0.0" \
  -F "platform=win32" \
  -F "arch=x64" \
  -F "file=@dist/YourRaven-1.0.0-x64-setup.exe"
```

## CI/CD自动化发布

### GitHub Actions配置

创建 `.github/workflows/release.yml`：

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ${{ matrix.os }}
    
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'yarn'
          
      - name: Install dependencies
        run: yarn install --frozen-lockfile
        
      - name: Build and release
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: yarn build --publish=always
```

### 触发发布
```bash
# 创建并推送标签
git tag v1.0.0
git push origin v1.0.0

# GitHub Actions会自动构建并发布
```

## 客户端自动更新配置

### 1. 使用GitHub Releases

确保 `src/shared/config/constant.ts` 中的配置正确：
```typescript
export enum FeedUrl {
  PRODUCTION = 'https://github.com/yourusername/your-raven-fork/releases/latest/download',
  GITHUB_LATEST = 'https://github.com/yourusername/your-raven-fork/releases/latest/download',
  // ...
}
```

### 2. 使用自定义服务器

```typescript
export enum FeedUrl {
  PRODUCTION = 'https://your-update-server.com',
  CUSTOM_SERVER = 'https://your-update-server.com',
  // ...
}
```

## 测试自动更新

### 1. 本地测试
```bash
# 启动开发版本
yarn dev

# 在设置中点击"检查更新"
# 或使用开发者工具
window.api.checkForUpdate()
```

### 2. 生产环境测试
1. 安装较旧版本的应用
2. 发布新版本到GitHub/更新服务器
3. 在应用中检查更新
4. 验证下载和安装流程

## 常见问题解决

### 1. 代码签名问题
```bash
# Windows: 需要有效的代码签名证书
# 临时禁用签名验证（仅开发环境）
set CSC_IDENTITY_AUTO_DISCOVERY=false
```

### 2. 网络问题
```bash
# 使用代理
set HTTPS_PROXY=http://proxy.company.com:8080
set HTTP_PROXY=http://proxy.company.com:8080
```

### 3. 权限问题
```bash
# 确保GitHub Token有足够权限
# 检查仓库设置中的Actions权限
```

## 最佳实践

### 1. 版本管理
- 使用语义化版本号 (Semantic Versioning)
- 为每个版本创建详细的发布说明
- 使用Git标签标记发布版本

### 2. 测试流程
- 在发布前进行充分测试
- 使用预发布版本进行内部测试
- 设置自动化测试流程

### 3. 安全考虑
- 妥善保管代码签名证书
- 定期轮换GitHub Token
- 使用HTTPS进行所有更新通信

### 4. 用户体验
- 提供清晰的更新日志
- 支持增量更新以减少下载时间
- 提供回滚机制以防更新失败

## 总结

通过以上流程，您可以：
1. 成功构建和发布您的Raven fork版本
2. 在GitHub上设置自动更新支持
3. 为用户提供无缝的更新体验
4. 建立可靠的CI/CD发布流程

记住在发布前充分测试，并为用户提供清晰的更新说明和支持文档。