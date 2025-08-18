# Raven 项目发布指南

## 概述

本指南聚焦“发布操作流程”。所有与配置相关的内容（electron-builder、自动更新、构建插件策略等）已集中在 `docs/raven_features/AUTO_UPDATE_MECHANISM.md`，本指南不再重复配置细节。

## 环境准备

- 凭据：准备 GitHub Token（用于发布 Releases），可放入根目录 `.env`
- 代码签名（可选）：按需配置 Windows/macOS 的签名与公证凭据

在项目根目录创建 `.env`：
```bash
# GitHub Token（必需）
GH_TOKEN=your_github_token

# Windows/macOS 代码签名（可选）
CSC_LINK=/absolute/path/to/certificate.p12
CSC_KEY_PASSWORD=your_password

# macOS 公证（可选）
APPLE_ID=your_apple_id@example.com
APPLE_ID_PASSWORD=app_specific_password
APPLE_TEAM_ID=your_team_id
```

### 2. 设置GitHub仓库

#### 创建GitHub Token
1. 访问 GitHub Settings > Developer settings > Personal access tokens
2. 创建新token，权限包括：
   - `repo` (完整仓库访问)
   - `write:packages` (发布包)

#### 配置环境变量

（以下任选其一配置 GH_TOKEN）

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

#### 本地构建
```bash
yarn build:mac         # 仅构建 macOS 产物
# 如需 Windows/Linux，请在对应平台执行 yarn build:win / yarn build:linux
```

#### 构建产物位置
构建完成后产物在 `dist/` 目录（具体清单由构建系统自动生成）。

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
# 构建并自动发布到GitHub（跳过类型检查）
yarn build:mac:publish:no-check

# 或者分步骤
yarn build:mac
yarn electron-builder --mac --arm64 --x64 --publish=always
```

#### 其它命令
```bash
# 构建并发布到 GitHub
yarn build:mac:publish

# 仅在 CI 环境发布
yarn electron-builder --publish=onTagOrDraft
```

## 自动更新与配置说明
请参考 `docs/raven_features/AUTO_UPDATE_MECHANISM.md`，此处不再赘述配置细节。

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