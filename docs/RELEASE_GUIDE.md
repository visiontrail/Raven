# Raven 项目发布指南

## 📑 目录

- [概述](#概述)
- [环境准备](#环境准备)
  - [设置 GitHub 仓库](#2-设置github仓库)
  - [配置环境变量](#配置环境变量)
- [构建与发布流程](#构建与发布流程)
  - [本地构建测试](#1-本地构建测试)
  - [版本发布](#2-版本发布)
    - [Windows 平台发布](#windows-平台发布)
    - [macOS 平台发布](#macos-平台发布)
    - [Linux 平台发布](#linux-平台发布)
    - [跨平台发布策略](#跨平台发布策略)
- [平台特定配置](#平台特定配置)
  - [Windows 平台配置](#windows-平台配置)
  - [macOS 平台配置](#macos-平台配置)
  - [Linux 平台配置](#linux-平台配置)
- [完整发布流程示例](#完整发布流程示例)
- [自动更新与配置说明](#自动更新与配置说明)
- [测试自动更新](#测试自动更新)
- [常见问题解决](#常见问题解决)
- [最佳实践](#最佳实践)
- [总结](#总结)

---

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
yarn build:win:x64     # 仅构建 Windows x64 产物
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

#### 发布到 GitHub Releases

根据你所在的开发平台，选择对应的发布命令。所有发布命令都会自动将构建产物上传到 GitHub Releases。

##### Windows 平台发布

**发布 Windows x64 版本：**

```powershell
# 方式1: 快速发布（跳过类型检查，推荐）
yarn build:win:x64:publish:no-check

# 方式2: 完整发布（包含类型检查）
yarn build:win:x64:publish

# 方式3: 分步骤执行
yarn build:win:x64
yarn electron-builder --win --x64 --publish=always
```

**发布 Windows ARM64 版本：**

```powershell
# 快速发布
yarn build:win:arm64:publish:no-check

# 完整发布
yarn build:win:arm64:publish

# 分步骤执行
yarn build:win:arm64
yarn electron-builder --win --arm64 --publish=always
```

**发布 Windows 全平台版本（x64 + ARM64）：**

```powershell
# 快速发布
yarn build:win:publish:no-check

# 完整发布
yarn build:win:publish

# 分步骤执行
yarn build:win
yarn electron-builder --win --x64 --arm64 --publish=always
```

**Windows 发布产物说明：**
- `Raven-Setup-${version}.exe` - 安装程序
- `Raven-${version}-win.zip` - 便携版压缩包
- `latest.yml` - 自动更新配置文件

##### macOS 平台发布

**发布 macOS ARM64 版本（Apple Silicon）：**

```bash
# 方式1: 快速发布（跳过类型检查，推荐）
yarn build:mac:arm64:publish:no-check

# 方式2: 完整发布（包含类型检查）
yarn build:mac:arm64:publish

# 方式3: 分步骤执行
yarn build:mac:arm64
yarn electron-builder --mac --arm64 --publish=always
```

**发布 macOS x64 版本（Intel）：**

```bash
# 快速发布
yarn build:mac:x64:publish:no-check

# 完整发布
yarn build:mac:x64:publish

# 分步骤执行
yarn build:mac:x64
yarn electron-builder --mac --x64 --publish=always
```

**发布 macOS 通用版本（Universal - ARM64 + x64）：**

```bash
# 快速发布（推荐）
yarn build:mac:publish:no-check

# 完整发布
yarn build:mac:publish

# 分步骤执行
yarn build:mac
yarn electron-builder --mac --arm64 --x64 --publish=always
```

**macOS 发布产物说明：**
- `Raven-${version}-arm64.dmg` - ARM64 安装镜像
- `Raven-${version}-x64.dmg` - x64 安装镜像
- `Raven-${version}-arm64-mac.zip` - ARM64 压缩包
- `Raven-${version}-x64-mac.zip` - x64 压缩包
- `latest-mac.yml` - 自动更新配置文件

##### Linux 平台发布

**发布 Linux x64 版本：**

```bash
# 方式1: 快速发布（跳过类型检查，推荐）
yarn build:linux:x64:publish:no-check

# 方式2: 完整发布（包含类型检查）
yarn build:linux:x64:publish

# 方式3: 分步骤执行
yarn build:linux:x64
yarn electron-builder --linux --x64 --publish=always
```

**发布 Linux ARM64 版本：**

```bash
# 快速发布
yarn build:linux:arm64:publish:no-check

# 完整发布
yarn build:linux:arm64:publish

# 分步骤执行
yarn build:linux:arm64
yarn electron-builder --linux --arm64 --publish=always
```

**发布 Linux 全平台版本（x64 + ARM64）：**

```bash
# 快速发布
yarn build:linux:publish:no-check

# 完整发布
yarn build:linux:publish

# 分步骤执行
yarn build:linux
yarn electron-builder --linux --x64 --arm64 --publish=always
```

**Linux 发布产物说明：**
- `Raven-${version}.AppImage` - AppImage 格式（推荐）
- `raven_${version}_amd64.deb` - Debian/Ubuntu 包
- `latest-linux.yml` - 自动更新配置文件

##### 跨平台发布策略

如果你需要为多个平台发布，有以下几种策略：

**策略一：使用 CI/CD（推荐）**

在 GitHub Actions 中配置多平台构建，让 CI 自动为所有平台构建和发布：

```yaml
# .github/workflows/release.yml 示例
jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - run: yarn install
      - run: yarn build:win:publish
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  build-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - run: yarn install
      - run: yarn build:mac:publish
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  build-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: yarn install
      - run: yarn build:linux:publish
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**策略二：本地多平台构建**

在本地为多个平台构建，然后统一发布：

```bash
# 1. 先构建所有平台（不发布）
yarn build:win:x64    # 在 Windows 上执行
yarn build:mac        # 在 macOS 上执行
yarn build:linux      # 在 Linux 上执行

# 2. 最后一次构建时加上 --publish=always 发布所有产物
yarn electron-builder --win --x64 --publish=always  # 发布到 GitHub
```

**策略三：分阶段发布**

先发布单个平台，后续再添加其他平台：

```bash
# 第一天：发布 Windows 版本
yarn build:win:publish:no-check

# 第二天：添加 macOS 版本到同一个 Release
yarn build:mac:publish:no-check

# 第三天：添加 Linux 版本到同一个 Release
yarn build:linux:publish:no-check
```

> **注意**：使用相同的版本号多次发布时，新的构建产物会自动添加到现有的 Release 中。

#### 发布选项说明

| 发布选项 | 说明 |
|---------|------|
| `--publish=always` | 总是发布，无论当前环境 |
| `--publish=never` | 从不发布，仅构建 |
| `--publish=onTag` | 仅在 Git tag 时发布 |
| `--publish=onTagOrDraft` | 在 Git tag 或草稿发布时发布（CI 推荐） |

#### 常用发布命令速查

```bash
# === 快速发布（跳过类型检查）===
yarn build:win:x64:publish:no-check      # Windows x64
yarn build:mac:arm64:publish:no-check    # macOS ARM64
yarn build:linux:x64:publish:no-check    # Linux x64

# === 完整发布（包含类型检查）===
yarn build:win:x64:publish               # Windows x64
yarn build:mac:arm64:publish             # macOS ARM64
yarn build:linux:x64:publish             # Linux x64

# === 仅构建不发布 ===
yarn build:win:x64                       # Windows x64
yarn build:mac:arm64                     # macOS ARM64
yarn build:linux:x64                     # Linux x64
```

## 完整发布流程示例

### Windows 平台完整发布示例

```powershell
# === 步骤 1: 准备环境 ===
# 确保已安装 Node.js 20+ 和 Yarn 4.6.0+
node --version
yarn --version

# === 步骤 2: 配置环境变量 ===
# 在项目根目录创建 .env 文件
cd D:\workspace\Code\GalaxySpaceAI\Raven
@"
GH_TOKEN=your_github_token
CSC_LINK=D:\path\to\certificate.p12
CSC_KEY_PASSWORD=your_password
"@ | Out-File -FilePath .env -Encoding utf8

# === 步骤 3: 拉取最新代码 ===
git pull origin main

# === 步骤 4: 安装依赖 ===
yarn install

# === 步骤 5: 运行测试（可选但推荐）===
yarn test
yarn lint
yarn typecheck

# === 步骤 6: 更新版本号 ===
# 方式1: 自动更新
npm version patch  # 1.0.0 -> 1.0.1

# 方式2: 手动编辑 package.json 中的 version 字段
code package.json

# === 步骤 7: 提交版本更新 ===
git add package.json
git commit -m "chore: bump version to $(node -p "require('./package.json').version")"
git push origin main

# === 步骤 8: 创建 Git Tag ===
$version = node -p "require('./package.json').version"
git tag -a "v$version" -m "Release v$version"
git push origin "v$version"

# === 步骤 9: 构建并发布 ===
# 发布 Windows x64 版本
yarn build:win:x64:publish:no-check

# 或发布全平台版本（x64 + ARM64）
yarn build:win:publish:no-check

# === 步骤 10: 验证发布 ===
# 1. 访问 GitHub Releases 页面
# 2. 确认新版本已创建
# 3. 检查安装包文件是否完整

# === 步骤 11: 编辑 Release 说明 ===
# 在 GitHub Release 页面添加更新日志
```

### macOS 平台完整发布示例

```bash
# === 步骤 1: 准备环境 ===
# 确保已安装 Node.js 20+ 和 Yarn 4.6.0+
node --version
yarn --version

# 安装 Xcode Command Line Tools（如果未安装）
xcode-select --install

# === 步骤 2: 配置环境变量 ===
# 在项目根目录创建 .env 文件
cd ~/Projects/Raven
cat > .env << EOF
GH_TOKEN=your_github_token
CSC_LINK=/path/to/certificate.p12
CSC_KEY_PASSWORD=your_password
APPLE_ID=your_apple_id@example.com
APPLE_ID_PASSWORD=app_specific_password
APPLE_TEAM_ID=your_team_id
EOF

# === 步骤 3: 拉取最新代码 ===
git pull origin main

# === 步骤 4: 安装依赖 ===
yarn install

# === 步骤 5: 运行测试（可选但推荐）===
yarn test
yarn lint
yarn typecheck

# === 步骤 6: 更新版本号 ===
npm version patch  # 1.0.0 -> 1.0.1

# === 步骤 7: 提交版本更新 ===
git add package.json
git commit -m "chore: bump version to $(node -p "require('./package.json').version")"
git push origin main

# === 步骤 8: 创建 Git Tag ===
VERSION=$(node -p "require('./package.json').version")
git tag -a "v$VERSION" -m "Release v$VERSION"
git push origin "v$VERSION"

# === 步骤 9: 构建并发布 ===
# 发布 Universal 版本（ARM64 + x64）
yarn build:mac:publish:no-check

# 或分别发布不同架构
yarn build:mac:arm64:publish:no-check  # Apple Silicon
yarn build:mac:x64:publish:no-check    # Intel

# === 步骤 10: 验证发布 ===
# 等待公证完成（可能需要几分钟）
# 访问 GitHub Releases 页面确认

# === 步骤 11: 编辑 Release 说明 ===
# 在 GitHub Release 页面添加更新日志
```

### Linux 平台完整发布示例

```bash
# === 步骤 1: 准备环境 ===
# 确保已安装 Node.js 20+ 和 Yarn 4.6.0+
node --version
yarn --version

# 安装构建依赖
sudo apt-get update
sudo apt-get install -y build-essential libssl-dev rpm

# === 步骤 2: 配置环境变量 ===
# 在项目根目录创建 .env 文件
cd ~/Projects/Raven
cat > .env << EOF
GH_TOKEN=your_github_token
EOF

# === 步骤 3: 拉取最新代码 ===
git pull origin main

# === 步骤 4: 安装依赖 ===
yarn install

# === 步骤 5: 运行测试（可选但推荐）===
yarn test
yarn lint
yarn typecheck

# === 步骤 6: 更新版本号 ===
npm version patch  # 1.0.0 -> 1.0.1

# === 步骤 7: 提交版本更新 ===
git add package.json
git commit -m "chore: bump version to $(node -p "require('./package.json').version")"
git push origin main

# === 步骤 8: 创建 Git Tag ===
VERSION=$(node -p "require('./package.json').version")
git tag -a "v$VERSION" -m "Release v$VERSION"
git push origin "v$VERSION"

# === 步骤 9: 构建并发布 ===
# 发布全平台版本（x64 + ARM64）
yarn build:linux:publish:no-check

# 或分别发布不同架构
yarn build:linux:x64:publish:no-check    # x64
yarn build:linux:arm64:publish:no-check  # ARM64

# === 步骤 10: 验证发布 ===
# 访问 GitHub Releases 页面确认

# === 步骤 11: 编辑 Release 说明 ===
# 在 GitHub Release 页面添加更新日志
```

### 使用 CI/CD 自动发布（推荐）

创建 `.github/workflows/release.yml`：

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release-windows:
    runs-on: windows-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Enable Corepack
        run: corepack enable

      - name: Install dependencies
        run: yarn install

      - name: Build and Release Windows
        run: yarn build:win:publish:no-check
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  release-macos:
    runs-on: macos-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Enable Corepack
        run: corepack enable

      - name: Install dependencies
        run: yarn install

      - name: Build and Release macOS
        run: yarn build:mac:publish:no-check
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_ID_PASSWORD: ${{ secrets.APPLE_ID_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}

  release-linux:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Enable Corepack
        run: corepack enable

      - name: Install dependencies
        run: yarn install

      - name: Build and Release Linux
        run: yarn build:linux:publish:no-check
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**使用 CI/CD 发布的步骤：**

```bash
# 1. 更新版本号
npm version patch

# 2. 提交更改
git add package.json
git commit -m "chore: bump version to $(node -p "require('./package.json').version")"
git push origin main

# 3. 创建并推送 Tag
VERSION=$(node -p "require('./package.json').version")
git tag -a "v$VERSION" -m "Release v$VERSION"
git push origin "v$VERSION"

# 4. GitHub Actions 会自动触发构建和发布
# 访问 https://github.com/your-username/Raven/actions 查看进度
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

## 平台特定配置

### Windows 平台配置

#### 代码签名证书

Windows 平台建议配置代码签名证书，以避免 SmartScreen 警告：

```powershell
# 方式1: 使用 .env 文件
CSC_LINK=D:\path\to\certificate.p12
CSC_KEY_PASSWORD=your_certificate_password

# 方式2: 临时环境变量
$env:CSC_LINK="D:\path\to\certificate.p12"
$env:CSC_KEY_PASSWORD="your_certificate_password"

# 方式3: 禁用代码签名（仅开发环境）
$env:CSC_IDENTITY_AUTO_DISCOVERY="false"
```

#### Windows 构建要求

- **操作系统**: Windows 10/11 或 Windows Server 2016+
- **权限**: 普通用户权限即可（无需管理员）
- **工具**: 自动下载所需的 WinSDK 工具

#### Windows 特定问题

```powershell
# 问题1: 构建卡在签名步骤
# 解决: 临时禁用签名
$env:CSC_IDENTITY_AUTO_DISCOVERY="false"

# 问题2: 缺少 Windows SDK
# 解决: electron-builder 会自动下载，或手动安装
# https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/

# 问题3: EPERM 错误
# 解决: 关闭杀毒软件或添加项目目录到白名单
```

### macOS 平台配置

#### 代码签名与公证

macOS 平台需要 Apple 开发者账号进行代码签名和公证：

```bash
# 在 .env 文件中配置
# 代码签名证书
CSC_LINK=/path/to/certificate.p12
CSC_KEY_PASSWORD=your_certificate_password

# Apple 公证配置
APPLE_ID=your_apple_id@example.com
APPLE_ID_PASSWORD=app_specific_password
APPLE_TEAM_ID=your_team_id

# 或者使用 Keychain 中的证书（推荐）
CSC_NAME="Developer ID Application: Your Name (TEAM_ID)"
```

#### 获取 Apple 公证凭据

1. **Apple ID**: 你的 Apple 开发者账号邮箱
2. **App-Specific Password**: 
   - 访问 https://appleid.apple.com
   - 登录后进入"安全"设置
   - 生成"应用专用密码"
3. **Team ID**: 
   - 访问 https://developer.apple.com/account
   - 在"Membership"中找到 Team ID

#### macOS 构建要求

- **操作系统**: macOS 10.15+ (推荐 macOS 12+)
- **Xcode**: 安装最新版 Xcode Command Line Tools
  ```bash
  xcode-select --install
  ```
- **证书**: Apple Developer 证书（用于签名和公证）

#### macOS 特定问题

```bash
# 问题1: 公证失败
# 解决: 检查 APPLE_ID 和 APPLE_ID_PASSWORD 是否正确
# 确保使用的是"应用专用密码"而非 Apple ID 密码

# 问题2: 找不到证书
# 解决: 列出可用证书
security find-identity -v -p codesigning

# 问题3: 构建 Universal 版本失败
# 解决: 确保所有依赖都支持 ARM64 和 x64
# 或分别构建两个版本
yarn build:mac:arm64
yarn build:mac:x64

# 问题4: 无法公证旧版本 macOS
# 解决: 在 electron-builder 配置中设置最低系统版本
# electronBuilder.mac.minimumSystemVersion = "10.15"
```

### Linux 平台配置

#### Linux 构建要求

- **操作系统**: Ubuntu 18.04+ / Debian 10+ / Fedora 30+
- **依赖包**: 
  ```bash
  # Ubuntu/Debian
  sudo apt-get update
  sudo apt-get install -y build-essential libssl-dev rpm
  
  # Fedora/CentOS
  sudo dnf install -y gcc-c++ make openssl-devel rpm-build
  ```

#### Linux 特定配置

```bash
# 在 .env 文件中配置
GH_TOKEN=your_github_token

# Linux 不需要代码签名证书
# 但可以配置 GPG 签名（可选）
# GPG_KEY_ID=your_gpg_key_id
# GPG_PASSPHRASE=your_gpg_passphrase
```

#### Linux 特定问题

```bash
# 问题1: 缺少构建依赖
# 解决: 安装必要的系统依赖
sudo apt-get install -y libarchive-tools

# 问题2: AppImage 构建失败
# 解决: 确保安装了 fuse
sudo apt-get install -y fuse libfuse2

# 问题3: 权限问题
# 解决: 给予执行权限
chmod +x dist/*.AppImage

# 问题4: 无法在 Docker 中构建
# 解决: 使用特权模式或安装必要的依赖
docker run --privileged ...
```

## 常见问题解决

### 1. 代码签名问题

#### Windows 代码签名

```powershell
# 临时禁用签名验证（仅开发环境）
$env:CSC_IDENTITY_AUTO_DISCOVERY="false"

# 使用证书签名
$env:CSC_LINK="D:\path\to\certificate.p12"
$env:CSC_KEY_PASSWORD="certificate_password"

# 验证证书是否有效
certutil -dump "D:\path\to\certificate.p12"
```

#### macOS 代码签名

```bash
# 列出可用的签名证书
security find-identity -v -p codesigning

# 使用指定证书
export CSC_NAME="Developer ID Application: Your Name (TEAM_ID)"

# 临时禁用签名（仅开发环境）
export CSC_IDENTITY_AUTO_DISCOVERY=false
```

### 2. 网络问题

```bash
# Windows (PowerShell)
$env:HTTPS_PROXY="http://proxy.company.com:8080"
$env:HTTP_PROXY="http://proxy.company.com:8080"

# macOS/Linux (Bash)
export HTTPS_PROXY=http://proxy.company.com:8080
export HTTP_PROXY=http://proxy.company.com:8080

# 或在 .env 文件中配置
HTTPS_PROXY=http://proxy.company.com:8080
HTTP_PROXY=http://proxy.company.com:8080
```

### 3. GitHub 权限问题

```bash
# 检查 GitHub Token 权限
# Token 需要以下权限：
# - repo (完整仓库访问)
# - write:packages (发布包)

# 验证 Token 是否有效
curl -H "Authorization: token $GH_TOKEN" https://api.github.com/user

# 检查仓库 Actions 权限
# 1. 访问 GitHub 仓库
# 2. Settings > Actions > General
# 3. 确保 "Read and write permissions" 已启用
```

### 4. 构建失败问题

#### 清理缓存并重建

```bash
# 清理所有缓存
rm -rf dist out node_modules/.cache

# Windows 使用
rmdir /s /q dist
rmdir /s /q out
rmdir /s /q node_modules\.cache

# 重新安装依赖
yarn install

# 重新构建
yarn build
```

#### Node.js 版本问题

```bash
# 检查 Node.js 版本
node --version  # 应该是 v20.x.x 或更高

# 使用 nvm 切换版本
nvm install 20
nvm use 20

# 验证 Yarn 版本
yarn --version  # 应该是 4.6.0 或更高
```

### 5. 发布到 GitHub Releases 失败

#### 检查 Release 是否已存在

```bash
# 如果同版本 Release 已存在，需要先删除或使用不同版本号
# 1. 访问 GitHub Releases 页面
# 2. 删除现有的同版本 Release 和 Git Tag
# 3. 或者更新版本号
npm version patch
```

#### 检查网络连接

```bash
# 测试 GitHub API 连接
curl -I https://api.github.com

# 测试上传连接
curl -I https://uploads.github.com

# 如果需要代理
export HTTPS_PROXY=http://your-proxy:port
```

#### 检查文件大小限制

GitHub Release 单个文件限制为 2GB，如果构建产物过大：

```bash
# 检查构建产物大小
ls -lh dist/

# Windows 使用
dir dist\ | sort /+25

# 如果文件过大，考虑：
# 1. 分离调试符号
# 2. 压缩产物
# 3. 排除不必要的资源
```

## 最佳实践

### 1. 版本管理

#### 语义化版本号（Semantic Versioning）

遵循 `MAJOR.MINOR.PATCH` 格式：

- **MAJOR**: 不兼容的 API 修改（如：1.0.0 -> 2.0.0）
- **MINOR**: 向下兼容的功能新增（如：1.0.0 -> 1.1.0）
- **PATCH**: 向下兼容的问题修正（如：1.0.0 -> 1.0.1）

```bash
# 使用 npm version 自动更新
npm version patch   # 修复 bug
npm version minor   # 新增功能
npm version major   # 重大更新

# 预发布版本
npm version prerelease --preid=alpha  # 1.0.0 -> 1.0.1-alpha.0
npm version prerelease --preid=beta   # 1.0.0 -> 1.0.1-beta.0
npm version prerelease --preid=rc     # 1.0.0 -> 1.0.1-rc.0
```

#### Git 标签管理

```bash
# 创建带注释的标签
git tag -a v1.0.0 -m "Release version 1.0.0"

# 推送标签到远程
git push origin v1.0.0

# 推送所有标签
git push origin --tags

# 删除本地标签
git tag -d v1.0.0

# 删除远程标签
git push origin :refs/tags/v1.0.0
```

#### 发布说明模板

在 GitHub Release 中使用以下模板：

```markdown
## 🎉 Raven v1.0.0

### ✨ 新增功能
- 添加了卫星负载管理功能
- 支持自然语言控制指令
- 集成 MCP Server 接口

### 🐛 Bug 修复
- 修复了补丁上传失败的问题
- 解决了 Windows 平台下的路径问题

### 🔧 改进优化
- 优化了构建速度
- 改进了用户界面体验

### 📝 文档更新
- 完善了快速开始指南
- 更新了 API 文档

### ⚠️ 破坏性变更
- 移除了旧版本的 API 接口（如有）

### 📦 安装包
- Windows: `Raven-Setup-1.0.0.exe`
- macOS: `Raven-1.0.0-arm64.dmg` / `Raven-1.0.0-x64.dmg`
- Linux: `Raven-1.0.0.AppImage`

### 🙏 致谢
感谢所有贡献者的支持！
```

### 2. 测试流程

#### 发布前测试清单

```bash
# 1. 单元测试
yarn test

# 2. 代码检查
yarn lint

# 3. 类型检查
yarn typecheck

# 4. E2E 测试
yarn test:e2e

# 5. 本地构建测试
yarn build:unpack

# 6. 手动测试
# - 启动应用
# - 测试核心功能
# - 检查新增特性
# - 验证 bug 修复
```

#### 预发布测试

使用预发布版本进行内部测试：

```bash
# 1. 创建预发布版本
npm version prerelease --preid=beta

# 2. 构建并发布为草稿
yarn build:win:publish:no-check
# 在 GitHub Releases 中标记为 "Pre-release"

# 3. 分发给内部测试团队
# 收集反馈

# 4. 修复问题后发布正式版本
npm version patch
yarn build:win:publish:no-check
```

#### 自动化测试配置

在 CI/CD 中添加测试步骤：

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
        node-version: [20]

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
      
      - run: corepack enable
      - run: yarn install
      - run: yarn test
      - run: yarn lint
      - run: yarn typecheck
```

### 3. 安全考虑

#### 证书和密钥管理

```bash
# ❌ 错误：将证书提交到版本控制
git add certificate.p12  # 不要这样做！

# ✅ 正确：使用 .gitignore 排除敏感文件
echo "*.p12" >> .gitignore
echo ".env" >> .gitignore
echo "*.key" >> .gitignore

# ✅ 正确：使用环境变量或 CI Secrets
# GitHub: Settings > Secrets and variables > Actions
# 添加 CSC_LINK（base64 编码的证书）和 CSC_KEY_PASSWORD
```

#### GitHub Token 安全

```bash
# ❌ 错误：将 Token 硬编码
GH_TOKEN=ghp_xxxxxxxxxxxx  # 不要直接提交

# ✅ 正确：使用 .env 文件（加入 .gitignore）
echo "GH_TOKEN=your_token" > .env
echo ".env" >> .gitignore

# ✅ 正确：定期轮换 Token
# 每 90 天更换一次 GitHub Token
# GitHub: Settings > Developer settings > Personal access tokens

# ✅ 正确：使用最小权限原则
# 只授予必要的权限：repo 和 write:packages
```

#### HTTPS 和证书验证

```bash
# ✅ 确保使用 HTTPS 进行所有通信
# electron-builder 默认使用 HTTPS

# ✅ 验证下载的更新包
# electron-updater 会自动验证签名

# ❌ 不要禁用 SSL 验证
# NODE_TLS_REJECT_UNAUTHORIZED=0  # 生产环境禁止！
```

#### 代码签名最佳实践

```bash
# Windows: 使用 EV 证书避免 SmartScreen 警告
# macOS: 必须签名和公证才能在 macOS 10.15+ 上运行

# 验证签名
# Windows:
signtool verify /pa /v dist\Raven-Setup-1.0.0.exe

# macOS:
codesign -vvv --deep --strict dist/Raven-1.0.0.dmg
spctl -a -vvv -t install dist/Raven-1.0.0.dmg
```

### 4. 用户体验

#### 清晰的更新日志

```markdown
# ✅ 好的更新日志示例

## v1.2.0 (2024-01-15)

### 新功能
- **卫星控制**: 添加了自然语言控制接口，现在可以通过对话控制卫星负载
- **补丁管理**: 新增补丁自动备份功能，支持版本回滚

### 改进
- **性能**: 优化了大文件上传速度，提升 50%
- **界面**: 改进了暗色主题的对比度

### 修复
- 修复了 Windows 下文件路径包含空格时的上传失败问题
- 解决了 macOS 下窗口无法最小化的问题
```

```markdown
# ❌ 差的更新日志示例

## v1.2.0

- 修复了一些 bug
- 添加了新功能
- 性能改进
```

#### 增量更新优化

electron-builder 自动支持增量更新（NSIS 差分更新）：

```javascript
// electron-builder 配置示例
{
  "nsis": {
    "differentialPackage": true  // 启用差分更新
  }
}
```

#### 更新通知设计

```javascript
// 良好的更新通知示例
{
  title: 'Raven 有新版本可用',
  message: 'v1.2.0 已发布，包含重要功能更新和 bug 修复',
  buttons: [
    '立即更新',      // 默认按钮
    '稍后提醒',      // 延迟提醒
    '查看详情'       // 打开 Release Notes
  ]
}
```

#### 回滚机制

```bash
# 保留旧版本安装包
# 用户可以手动下载旧版本安装

# 在 GitHub Releases 中提供所有历史版本
# 不要删除旧版本的 Release

# 应用内提供"关于"页面显示当前版本
# 方便用户确认版本和回滚
```

### 5. 发布频率建议

#### 版本发布节奏

- **补丁版本**: 每 1-2 周（bug 修复）
- **次要版本**: 每 1-2 月（新功能）
- **主要版本**: 每 6-12 月（重大更新）

#### 紧急修复流程

```bash
# 1. 从最新发布版本创建分支
git checkout v1.0.0
git checkout -b hotfix/critical-bug

# 2. 修复 bug
# 编辑代码...

# 3. 创建补丁版本
npm version patch  # 1.0.0 -> 1.0.1

# 4. 快速发布
yarn build:win:publish:no-check

# 5. 合并回主分支
git checkout main
git merge hotfix/critical-bug
git push origin main
```

### 6. 多平台发布策略

#### 推荐策略：使用 CI/CD

```yaml
# 优点：
# - 自动化，减少人工错误
# - 并行构建，节省时间
# - 统一构建环境
# - 完整的构建日志

# 配置 GitHub Actions（见上文 CI/CD 配置）
```

#### 备选策略：本地构建

```bash
# 适用场景：
# - 无法使用 CI/CD
# - 需要特殊构建环境
# - 私有部署

# 在各平台分别构建
# Windows: yarn build:win:publish:no-check
# macOS:   yarn build:mac:publish:no-check
# Linux:   yarn build:linux:publish:no-check
```

### 7. 发布后检查清单

```markdown
- [ ] 所有平台的安装包已成功上传到 GitHub Releases
- [ ] Release Notes 已编辑完成，格式正确
- [ ] 版本号与 Git Tag 一致
- [ ] 在不同平台上测试下载和安装
- [ ] 验证自动更新功能正常工作
- [ ] 检查应用签名状态（Windows/macOS）
- [ ] 更新官方网站的下载链接（如有）
- [ ] 发布更新公告（社交媒体、邮件列表等）
- [ ] 在项目 README 中更新版本号和下载链接
- [ ] 备份 Release 构建产物到其他位置
```

## 总结

通过本指南，您已经掌握了：

### 核心能力

1. **环境配置**
   - ✅ GitHub Token 的创建和配置
   - ✅ 代码签名证书的准备（Windows/macOS）
   - ✅ 跨平台环境变量的设置

2. **构建和发布**
   - ✅ Windows 平台的构建和发布流程
   - ✅ macOS 平台的构建、签名和公证流程
   - ✅ Linux 平台的构建和发布流程
   - ✅ 多平台并行发布策略

3. **版本管理**
   - ✅ 语义化版本号的使用
   - ✅ Git 标签的创建和管理
   - ✅ 发布说明的编写

4. **自动化和 CI/CD**
   - ✅ GitHub Actions 配置
   - ✅ 自动化测试集成
   - ✅ 自动发布流程

5. **问题解决**
   - ✅ 平台特定问题的排查和解决
   - ✅ 网络和权限问题的处理
   - ✅ 构建失败的调试方法

### 快速参考

#### 常用命令速查表

| 任务 | Windows | macOS | Linux |
|------|---------|-------|-------|
| 快速发布 | `yarn build:win:x64:publish:no-check` | `yarn build:mac:publish:no-check` | `yarn build:linux:x64:publish:no-check` |
| 完整发布 | `yarn build:win:x64:publish` | `yarn build:mac:publish` | `yarn build:linux:x64:publish` |
| 仅构建 | `yarn build:win:x64` | `yarn build:mac` | `yarn build:linux:x64` |
| 更新版本 | `npm version patch` | `npm version patch` | `npm version patch` |

#### 环境变量速查表

| 变量名 | 必需 | 用途 | 平台 |
|--------|------|------|------|
| `GH_TOKEN` | ✅ | GitHub 发布权限 | 全部 |
| `CSC_LINK` | ⭕ | 代码签名证书路径 | Windows/macOS |
| `CSC_KEY_PASSWORD` | ⭕ | 证书密码 | Windows/macOS |
| `APPLE_ID` | ⭕ | Apple 公证账号 | macOS |
| `APPLE_ID_PASSWORD` | ⭕ | Apple 应用专用密码 | macOS |
| `APPLE_TEAM_ID` | ⭕ | Apple 团队 ID | macOS |

#### 发布流程速查表

```bash
# 标准发布流程（5 步）
1. npm version patch              # 更新版本
2. git push origin main           # 推送代码
3. git tag -a v1.0.1 -m "..."    # 创建标签
4. git push origin v1.0.1         # 推送标签
5. yarn build:xxx:publish         # 构建发布

# 紧急修复流程（3 步）
1. 修复代码并更新版本
2. 创建并推送标签
3. 构建发布
```

### 下一步

完成发布后，建议进行以下工作：

1. **监控和反馈**
   - 关注 GitHub Issues 中的用户反馈
   - 监控下载量和更新率
   - 收集用户体验数据

2. **文档更新**
   - 更新用户手册和 API 文档
   - 同步更新官方网站内容
   - 维护更新日志

3. **持续改进**
   - 优化构建流程
   - 改进自动化程度
   - 提升用户体验

### 相关资源

- **项目文档**
  - [快速开始指南](../QUICK_START.md)
  - [开发指南](dev.md)
  - [贡献指南](CONTRIBUTING.zh.md)
  - [自动更新机制](raven_features/AUTO_UPDATE_MECHANISM.md)

- **外部资源**
  - [electron-builder 文档](https://www.electron.build/)
  - [GitHub Releases 文档](https://docs.github.com/en/repositories/releasing-projects-on-github)
  - [语义化版本规范](https://semver.org/lang/zh-CN/)

- **社区支持**
  - [GitHub Issues](https://github.com/CherryHQ/cherry-studio/issues)
  - [Telegram 群组](https://t.me/CherryStudioAI)
  - [Discord 社区](https://discord.gg/wez8HtpxqQ)

### 常见场景快速指引

#### 场景 1: 首次发布

```bash
# 1. 配置环境（首次）
echo "GH_TOKEN=your_token" > .env

# 2. 更新到 1.0.0
npm version 1.0.0

# 3. 创建标签
git tag -a v1.0.0 -m "Initial release"
git push origin v1.0.0

# 4. 发布
yarn build:win:x64:publish:no-check
```

#### 场景 2: 修复 bug 后发布补丁

```bash
# 1. 修复代码后更新补丁版本
npm version patch  # 1.0.0 -> 1.0.1

# 2. 推送更改
git push origin main

# 3. 创建标签并发布
git tag -a v1.0.1 -m "Bug fixes"
git push origin v1.0.1
yarn build:win:x64:publish:no-check
```

#### 场景 3: 发布新功能

```bash
# 1. 完成功能开发后更新次要版本
npm version minor  # 1.0.1 -> 1.1.0

# 2. 推送更改
git push origin main

# 3. 创建标签并发布
git tag -a v1.1.0 -m "New features"
git push origin v1.1.0
yarn build:win:x64:publish:no-check
```

#### 场景 4: 发布预览版

```bash
# 1. 创建预览版本
npm version prerelease --preid=beta  # 1.1.0 -> 1.1.1-beta.0

# 2. 发布并标记为 Pre-release
yarn build:win:x64:publish:no-check
# 在 GitHub Releases 页面勾选 "This is a pre-release"
```

#### 场景 5: 回滚到旧版本

```bash
# 方法1: 用户手动下载旧版本
# 从 GitHub Releases 页面下载旧版本安装包

# 方法2: 开发者移除问题版本
# 1. 在 GitHub 删除有问题的 Release
# 2. 删除对应的 Git Tag
git tag -d v1.1.0
git push origin :refs/tags/v1.1.0

# 3. 重新发布修复后的版本
npm version 1.1.0
git tag -a v1.1.0 -m "Fixed version"
git push origin v1.1.0
yarn build:win:x64:publish:no-check
```

### 获取帮助

如果您在发布过程中遇到问题：

1. **查阅文档**: 先查看本指南和相关文档
2. **搜索 Issues**: 在 GitHub Issues 中搜索类似问题
3. **提交 Issue**: 如果问题未解决，创建新 Issue 并提供详细信息
4. **社区求助**: 在 Telegram/Discord 群组中寻求帮助

**提交 Issue 时请包含以下信息：**
- 操作系统和版本
- Node.js 和 Yarn 版本
- 完整的错误日志
- 重现步骤
- 已尝试的解决方法

---

记住：**在发布前充分测试，为用户提供清晰的更新说明和支持文档。**

祝您发布顺利！🚀
