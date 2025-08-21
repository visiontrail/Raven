# 🪟 Windows 开发环境设置指南

## 🚨 Yarn 问题解决方案

### 方案一：修复 Yarn 安装 (推荐)

**1. 以管理员身份运行 PowerShell**

```powershell
# 步骤1：清理现有yarn
npm uninstall -g yarn
Remove-Item -Recurse -Force $env:APPDATA\yarn -ErrorAction SilentlyContinue

# 步骤2：启用corepack并安装yarn
corepack enable
corepack prepare yarn@4.9.1 --activate

# 步骤3：验证安装
yarn --version
```

**2. 如果仍有权限问题**

```powershell
# 设置执行策略
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# 或直接通过npm安装
npm install -g yarn@4.9.1
```

### 方案二：完全使用 NPM 替代

如果 Yarn 问题无法解决，可以完全使用 npm 替代：

```bash
# 安装依赖
npm install

# 开发调试
npm run dev
npm run debug

# 构建应用
npm run build:win:x64      # Windows x64版本
npm run build:win:arm64    # Windows ARM64版本
npm run build:unpack      # 开发构建（不打包）

# 测试
npm run test
npm run test:main
npm run test:renderer

# 代码质量
npm run format
npm run lint
npm run typecheck
```

## 🛠️ 便捷开发脚本

项目已为您准备了两个便捷脚本：

### 1. 批处理脚本 (`dev-windows.bat`)

**适用于传统 Windows 环境**

```batch
# 双击运行或在命令提示符中执行
dev-windows.bat
```

### 2. PowerShell 脚本 (`dev-windows.ps1`)

**适用于现代 PowerShell 环境**

```powershell
# 交互式菜单
.\dev-windows.ps1

# 直接命令模式
.\dev-windows.ps1 dev          # 启动开发模式
.\dev-windows.ps1 install      # 安装依赖
.\dev-windows.ps1 build-x64    # 构建Windows x64版本
.\dev-windows.ps1 test         # 运行测试
```

**PowerShell 脚本支持的命令：**

- `install` - 安装依赖
- `dev` - 开发模式
- `debug` - 调试模式
- `build-x64` - 构建Windows x64版本
- `build-arm64` - 构建Windows ARM64版本
- `build-unpack` - 构建（不打包）
- `test` - 运行测试
- `format` - 格式化代码
- `typecheck` - 类型检查

## 📋 完整命令对照表

| Yarn 命令              | NPM 替代命令              | 说明              |
| ---------------------- | ------------------------- | ----------------- |
| `yarn install`         | `npm install`             | 安装依赖          |
| `yarn dev`             | `npm run dev`             | 开发模式          |
| `yarn debug`           | `npm run debug`           | 调试模式          |
| `yarn build:win:x64`   | `npm run build:win:x64`   | 构建Windows x64   |
| `yarn build:win:arm64` | `npm run build:win:arm64` | 构建Windows ARM64 |
| `yarn build:unpack`    | `npm run build:unpack`    | 开发构建          |
| `yarn test`            | `npm run test`            | 运行测试          |
| `yarn lint`            | `npm run lint`            | 代码检查          |
| `yarn format`          | `npm run format`          | 代码格式化        |
| `yarn typecheck`       | `npm run typecheck`       | 类型检查          |

## 🔧 Windows 特定问题解决

### PowerShell 执行策略问题

```powershell
# 如果无法运行PowerShell脚本，执行：
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 长路径问题

```bash
# Windows可能遇到路径过长问题，启用长路径支持：
git config --global core.longpaths true
```

### 环境变量设置

确保以下环境变量正确设置：

- `NODE_OPTIONS=--max-old-space-size=8192` (已在脚本中设置)
- 确保 Node.js 和 npm 在 PATH 中

## 🚀 快速开始

1. **首次设置**

   ```bash
   # 使用npm
   npm install

   # 或使用修复后的yarn
   yarn install
   ```

2. **开始开发**

   ```bash
   # 使用脚本（推荐）
   .\dev-windows.ps1 dev

   # 或直接使用npm
   npm run dev
   ```

3. **构建应用**
   ```bash
   # 构建Windows版本
   npm run build:win:x64
   ```

## 📞 获取帮助

如果遇到问题：

1. 检查 Node.js 版本 (`node --version`) 是否为 v20.x.x
2. 清理缓存：`npm cache clean --force`
3. 删除 node_modules 重新安装：`rm -rf node_modules && npm install`
4. 查看项目的 [QUICK_START.md](QUICK_START.md) 获取更多信息

---

**祝您开发愉快！ 🍒**
