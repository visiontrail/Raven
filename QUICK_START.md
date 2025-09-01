# 🍒 Cherry Studio - 快速开始指南

## 📋 系统要求

### 基础要求

- **操作系统**: Windows 10/11, macOS 10.15+, Linux (Ubuntu 18.04+)
- **内存**: 至少 4GB RAM (推荐 8GB+)
- **存储**: 至少 2GB 可用空间
- **网络**: 稳定的互联网连接

### 开发环境要求

- **Node.js**: v20.x.x 或更高版本
- **Yarn**: v4.6.0 或更高版本
- **Git**: 最新版本

## 🚀 快速开始

### 1. 环境准备

#### 安装 Node.js

1. 访问 [Node.js 官网](https://nodejs.org/en/download)
2. 下载并安装 Node.js v20.x.x 版本
3. 验证安装：
   ```bash
   node --version
   npm --version
   ```

#### 安装 Yarn

**方法 1: 使用 corepack (推荐)**

```bash
# 启用 corepack (Node.js 16.10+ 内置)
corepack enable

# 准备并激活 Yarn
corepack prepare yarn@4.6.0 --activate

# 验证安装
yarn --version
```

**方法 2: 直接安装 Yarn (Windows 权限问题解决方案)**
如果遇到 `EPERM: operation not permitted` 错误，请使用以下方法：

```bash
# 直接通过 npm 安装 Yarn
npm install -g yarn

# 验证安装
yarn --version
```

> ⚠️ **注意**: 在 Windows 系统中，如果遇到权限问题，建议使用方法 2 直接安装 Yarn。

#### 克隆项目

```bash
# 克隆项目到本地
git clone https://github.com/CherryHQ/cherry-studio.git

# 进入项目目录
cd cherry-studio
```

### 2. 安装依赖

```bash
# 安装项目依赖
yarn install
```

> ⚠️ **注意**: 首次安装可能需要较长时间，请耐心等待。项目使用了大量的依赖包，包括 Electron、React、TypeScript 等。

### 3. 开发模式

#### 启动开发服务器

```bash
# 启动开发模式
yarn dev
```

这将启动 Electron 应用，并开启热重载功能。任何代码修改都会自动重新加载。

#### 调试模式

```bash
# 启动调试模式
yarn debug
```

然后在浏览器中打开 `chrome://inspect` 进行调试。

### 4. 测试

```bash
# 运行所有测试
yarn test

# 运行主进程测试
yarn test:main

# 运行渲染进程测试
yarn test:renderer

# 运行 UI 测试
yarn test:ui

# 运行 E2E 测试
yarn test:e2e
```

### 5. 代码质量检查

```bash
# 代码格式化
yarn format

# 代码检查
yarn lint

# 类型检查
yarn typecheck
```

## 🏗️ 构建应用

### 开发构建

```bash
# 构建应用 (不打包)
yarn build:unpack
```

### 生产构建

#### Windows

```bash
# 构建 Windows x64 版本
yarn build:win:x64

# 构建 Windows ARM64 版本
yarn build:win:arm64

# 构建 Windows 通用版本 (x64 + ARM64)
yarn build:win
```

#### macOS

```bash
# 构建 macOS ARM64 版本
yarn build:mac:arm64

# 构建 macOS x64 版本
yarn build:mac:x64

# 构建 macOS 通用版本 (ARM64 + x64)
yarn build:mac
```

#### Linux

```bash
# 构建 Linux ARM64 版本
yarn build:linux:arm64

# 构建 Linux x64 版本
yarn build:linux:x64

# 构建 Linux 通用版本 (ARM64 + x64)
yarn build:linux
```

## 📦 构建输出

构建完成后，应用文件将位于 `dist` 目录中：

- **Windows**: `.exe` 安装文件和便携版
- **macOS**: `.dmg` 安装文件和 `.zip` 压缩包
- **Linux**: `.AppImage` 文件和 `.deb` 包

## 🔧 常用命令

| 命令             | 描述         |
| ---------------- | ------------ |
| `yarn dev`       | 启动开发模式 |
| `yarn debug`     | 启动调试模式 |
| `yarn build`     | 构建应用     |
| `yarn test`      | 运行测试     |
| `yarn lint`      | 代码检查     |
| `yarn format`    | 代码格式化   |
| `yarn typecheck` | 类型检查     |

## 🐛 故障排除

### 常见问题

#### 1. 依赖安装失败

```bash
# 清除缓存并重新安装
yarn cache clean
yarn install
```

#### 2. 构建失败

```bash
# 清理构建缓存
rm -rf dist out node_modules/.cache
yarn install
yarn build
```

#### 3. 开发模式启动失败

- 检查 Node.js 版本是否为 v20.x.x
- 检查 Yarn 版本是否为 v4.6.0+
- 确保所有依赖已正确安装

#### 4. Windows 权限问题

如果遇到 `EPERM: operation not permitted` 错误：

```bash
# 方法 1: 以管理员身份运行 PowerShell
# 右键点击 PowerShell，选择"以管理员身份运行"，然后执行：
corepack enable

# 方法 2: 直接安装 Yarn
npm install -g yarn
```

#### 5. 权限问题 (Linux/macOS)

```bash
# 给予执行权限
chmod +x dist/*.AppImage
```

### 获取帮助

- 📖 [项目文档](https://docs.cherry-ai.com/cherry-studio-wen-dang/en-us)
- 🐛 [问题反馈](https://github.com/CherryHQ/cherry-studio/issues)
- 💬 [Telegram 群组](https://t.me/CherryStudioAI)
- 💬 [Discord 社区](https://discord.gg/wez8HtpxqQ)

## 📚 相关链接

- 🌐 [官方网站](https://cherry-ai.com)
- 📖 [开发文档](https://docs.cherry-ai.com/cherry-studio-wen-dang/en-us)
- 🎨 [主题画廊](https://cherrycss.com)
- 🤝 [贡献指南](CONTRIBUTING.md)
- 📋 [分支策略](docs/branching-strategy-en.md)

---

**Happy Coding! 🍒**
