# 自建版本更新服务器设计文档

## 概述

本文档描述了如何为 Raven 项目实现自建版本检查和升级功能，包括服务器端 API 设计和客户端修改方案。

## 架构设计

### 服务器端

#### 1. 版本信息存储结构

```json
{
  "latestVersion": "1.0.0",
  "versions": {
    "1.0.0": {
      "version": "1.0.0",
      "publishedAt": "2024-01-01T00:00:00Z",
      "changelog": "版本更新说明",
      "files": [
        {
          "name": "Raven-1.0.0-x64-setup.exe",
          "url": "https://your-server.com/releases/Raven-1.0.0-x64-setup.exe",
          "size": 123456789,
          "platform": "win32",
          "arch": "x64"
        }
      ],
      "required": false,
      "minVersion": "0.9.0"
    }
  }
}
```

#### 2. API 端点设计

- `GET /api/version/latest` - 获取最新版本信息
- `GET /api/version/check?current=1.0.0&platform=win32&arch=x64` - 检查更新
- `POST /api/version/upload` - 上传新版本（管理员）
- `GET /api/releases/:version/download/:filename` - 下载文件

### 客户端修改

#### 1. 配置文件修改

修改 `packages/shared/config/constant.ts` 中的 `FeedUrl` 枚举，添加自定义服务器地址。

#### 2. AppUpdater 服务修改

扩展 `src/main/services/AppUpdater.ts`，支持自定义更新服务器。

## 实现步骤

### 第一阶段：服务器端实现

1. 创建 Express.js 服务器
2. 实现版本管理 API
3. 实现文件上传和下载功能
4. 添加管理界面

### 第二阶段：客户端集成

1. 修改更新配置
2. 扩展 AppUpdater 服务
3. 添加自定义服务器配置选项
4. 测试更新流程

### 第三阶段：部署和维护

1. 服务器部署
2. SSL 证书配置
3. 监控和日志
4. 备份策略

## 安全考虑

1. 文件完整性校验（SHA256）
2. HTTPS 传输
3. 访问控制和认证
4. 版本回滚机制

## 兼容性

确保与现有的 electron-updater 机制兼容，支持渐进式迁移。
