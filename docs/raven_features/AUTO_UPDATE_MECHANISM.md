# Raven 自动更新机制详解

## 概述

Raven 项目采用基于 `electron-updater` 的自动更新机制，支持增量更新而非完整安装包重新安装。该机制具有智能服务器选择、自定义更新服务器支持等特性。

## 更新机制类型

### 增量更新 vs 完整安装

- **更新方式**: 使用 `electron-updater` 进行增量更新
- **下载内容**: 仅下载变更的文件，而非完整的 exe/dmg 安装包
- **安装过程**: 应用程序自动替换更新的文件，无需用户手动重新安装
- **重启机制**: 更新完成后通过 `autoUpdater.quitAndInstall()` 自动重启应用

## 核心组件

### 1. AppUpdater.ts (主进程)

**位置**: `src/main/services/AppUpdater.ts`

**主要功能**:
- 初始化 `electron-updater`
- 管理更新服务器地址选择
- 处理更新事件监听
- 控制自动下载和安装行为

**关键配置**:
```typescript
// 根据配置设置自动更新行为
const { autoDownload, autoInstallOnAppQuit } = configManager.getAutoUpdate()
autoUpdater.autoDownload = autoDownload
autoUpdater.autoInstallOnAppQuit = autoInstallOnAppQuit
```

### 2. 更新服务器选择逻辑

**配置文件**: `packages/shared/config/constant.ts`

**服务器地址枚举**:
```typescript
export enum FeedUrl {
  PRODUCTION = 'https://releases.yinhe.ht',
  GITHUB_LATEST = 'https://github.com/visiontrail/Raven/releases/latest/download',
  PRERELEASE_LOWEST = 'https://github.com/visiontrail/Raven/releases/download/v0.0.1',
  CUSTOM_SERVER = 'http://localhost:3000'
}
```

**优先级机制** (按优先级从高到低):

1. **自定义服务器** (最高优先级)
   - 当用户启用"自定义服务器升级选项"时
   - 使用用户指定的服务器地址
   - 主要用于企业内网部署或特殊网络环境

2. **测试计划模式**
   - 当启用测试计划时
   - 根据测试渠道选择相应的服务器
   - 支持预发布版本测试

3. **生产模式** (默认)
   - 根据用户IP地理位置智能选择:
     - **中国用户**: `https://releases.cherry-ai.com`
     - **海外用户**: `https://github.com/CherryHQ/cherry-studio/releases/latest/download`

### 3. 用户界面控制

**设置界面**: `src/renderer/src/pages/settings/AboutSettings.tsx`

**可配置选项**:
- ✅ 自动检查更新 (实际控制自动下载)
- ✅ 自定义服务器升级选项
- 🔘 手动检查更新按钮

**注意**: "自动检查更新"开关实际控制的是自动下载行为，应用启动时不会自动检查更新。

## 更新流程

### 1. 触发更新检查

**手动触发**:
- 用户点击"检查更新"按钮
- 调用 `window.api.checkForUpdate()`
- 通过 IPC 通信触发主进程的 `autoUpdater.checkForUpdates()`

**自动触发**:
- 当前版本不支持应用启动时自动检查
- 仅在用户手动操作时触发

### 2. 更新检测与下载

```mermaid
flowchart TD
    A[用户点击检查更新] --> B[AppUpdater.checkForUpdates]
    B --> C{有可用更新?}
    C -->|是| D{autoDownload开启?}
    C -->|否| E[显示"已是最新版本"]
    D -->|是| F[自动下载更新]
    D -->|否| G[显示更新对话框]
    G --> H{用户选择安装?}
    H -->|是| I[手动下载更新]
    H -->|否| J[取消更新]
    F --> K[下载完成]
    I --> K
    K --> L{autoInstallOnAppQuit开启?}
    L -->|是| M[应用退出时自动安装]
    L -->|否| N[显示安装对话框]
    N --> O[用户确认后quitAndInstall]
```

### 3. 安装与重启

**安装方式**:
- `autoUpdater.quitAndInstall()`: 立即退出并安装
- `autoInstallOnAppQuit`: 应用正常退出时自动安装

**文件替换**:
- `electron-updater` 自动处理文件替换
- 无需用户手动操作
- 保持用户数据和配置不变

## 构建与发布配置

### electron-builder 配置

**配置文件**: `electron-builder.yml`

**发布配置**:
```yaml
publish:
  provider: github
  owner: visiontrail
  repo: Raven
```

**构建产物**:
- **Windows**: NSIS 安装包 + Portable 版本
- **macOS**: DMG 镜像 + ZIP 压缩包
- **Linux**: AppImage + DEB 包

### 更新文件结构

更新服务器需要提供以下文件:
- `latest.yml` (Windows)
- `latest-mac.yml` (macOS)
- `latest-linux.yml` (Linux)
- 对应的更新文件 (`.nupkg`, `.zip`, `.AppImage` 等)

## 自定义更新服务器

### 服务器要求

**API 端点**:
- `GET /api/version/latest` - 获取最新版本信息
- `GET /api/version/check` - 检查更新
- `POST /api/version/upload` - 上传新版本 (管理员)
- `GET /download/*` - 下载更新文件

**兼容性**:
- 必须与 `electron-updater` 兼容
- 支持标准的更新清单格式
- 提供正确的文件签名验证

### 部署指南

参考文档:
- `docs/custom-update-server.md` - 详细设计文档
- `update-server/README.md` - 快速部署指南

## 安全特性

### 代码签名验证

**Windows**:
- 使用自定义签名脚本: `scripts/win-sign.js`
- 配置 `verifyUpdateCodeSignature: false` (开发环境)

**macOS**:
- 支持公证 (notarize)
- 配置应用权限: `build/entitlements.mac.plist`

### 网络安全

- 所有更新服务器均使用 HTTPS
- 支持自定义 CA 证书验证
- 防止中间人攻击

## 用户体验优化

### 进度反馈

- 下载进度实时显示
- 错误信息友好提示
- 支持取消下载操作

### 网络适配

- 智能选择最优服务器
- 支持代理环境
- 断点续传支持

### 企业部署友好

- 支持内网更新服务器
- 可配置更新策略
- 批量部署支持

## 建议改进

### 当前限制

1. **自动检查更新**: 应用启动时不会自动检查更新
2. **命名混淆**: "自动检查更新"实际控制的是自动下载
3. **用户感知**: 需要手动点击才能发现更新

### 改进建议

1. **实现真正的自动检查**: 应用启动时在后台检查更新
2. **优化设置命名**: 将"自动检查更新"改为"自动下载更新"
3. **增加检查频率设置**: 允许用户配置检查更新的时间间隔
4. **静默更新选项**: 提供完全静默的更新模式

## 总结

Raven 的自动更新机制采用现代化的增量更新方案，避免了传统完整安装包的下载和安装复杂性。通过智能服务器选择和自定义服务器支持，很好地平衡了国内外用户体验和企业部署需求。虽然在自动化程度上还有改进空间，但整体架构设计合理，扩展性良好。