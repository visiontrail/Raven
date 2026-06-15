# 全局设备日志自动监控功能

## 功能概述

全局设备日志自动监控功能是一个独立于页面生命周期的后台服务，在应用启动时自动运行，持续监控 FTP 服务器的 `/logs` 目录，并自动上传新文件到日志服务器。

## 核心特性

### 🌐 全局运行
- **应用启动自动运行**：软件启动3秒后自动初始化监控服务
- **不受页面切换影响**：即使离开设备日志页面，监控仍在后台运行
- **持久化配置**：所有配置保存在 localStorage，重启应用后自动恢复

### ⚙️ 灵活配置
- **监控开关**：可随时启用/禁用监控功能
- **自动上传开关**：可选择只监控不上传
- **检查间隔**：5-300秒可调，默认30秒
- **实时生效**：所有配置更改立即保存并应用

### 🔄 智能监控
- **新文件检测**：基于文件路径+大小+修改时间的唯一标识
- **自动日志类型识别**：protocol/oam_antenna/full
- **串行上传**：避免资源竞争
- **错误恢复**：单个文件失败不影响其他文件

## 使用方法

### 默认行为

应用启动后，如果满足以下条件，监控服务会自动启动：
1. **监控开关**：启用（默认）
2. **自动上传**：启用（默认）

### 配置管理

在设备日志页面的监控控制面板中：

```
┌─────────────────────────────────────────────────────────┐
│  ⚙ 全局自动监控  [禁用监控] [后台监控中]                 │
│                                                           │
│  检查间隔(秒): [30]      自动上传: [✓]                   │
│                                                           │
│  💡 提示：监控服务在后台全局运行，不受页面切换影响...    │
└─────────────────────────────────────────────────────────┘
```

#### 1. 启用/禁用监控
- 点击"启用监控"或"禁用监控"按钮
- 配置立即保存，下次启动应用时生效

#### 2. 调整检查间隔
- 修改"检查间隔(秒)"输入框的值
- 更改会立即生效，监控服务自动重启以应用新间隔

#### 3. 控制自动上传
- 切换"自动上传"开关
- 关闭后：只监控不上传，新文件出现时会在控制台输出日志
- 开启后：检测到新文件自动上传到日志服务器

### 配置存储

所有配置保存在浏览器 localStorage 中，键名为：
```typescript
'device_log_monitor_config'
```

配置结构：
```typescript
{
  enabled: boolean,        // 是否启用监控
  interval: number,        // 检查间隔（秒）
  autoUpload: boolean,     // 是否自动上传
  logServerUrl: string     // 日志服务器地址
}
```

## 工作流程

### 应用启动流程

```
1. 应用启动
   ↓
2. 加载 init.ts
   ↓
3. 延迟 3 秒
   ↓
4. 初始化 DeviceLogMonitorService
   ↓
5. 从 localStorage 加载配置
   ↓
6. 如果 enabled=true && autoUpload=true
   ↓
7. 启动后台监控服务
   ↓
8. 用户可以在任何时候打开设备日志页面调整配置
```

### 监控循环流程

```
[定时器触发]
   ↓
1. 获取 FTP 文件列表
   ↓
2. 与上次记录对比
   ↓
3. 找出新增文件
   ↓
4. 如果有新文件 && autoUpload=true
   ↓
5. 逐个下载并上传到日志服务器
   ↓
6. 更新文件记录
   ↓
7. 等待下一个周期
```

## 技术实现

### 核心服务

**文件路径**：`src/renderer/src/services/DeviceLogMonitorService.ts`

**主要类**：`DeviceLogMonitorService` (单例模式)

**关键方法**：
- `initialize()` - 应用启动时初始化
- `start()` - 启动监控
- `stop()` - 停止监控
- `updateConfig()` - 更新配置
- `getConfig()` - 获取当前配置
- `isRunning()` - 获取运行状态

### 应用集成

**初始化位置**：`src/renderer/src/init.ts`

```typescript
function initDeviceLogMonitor() {
  setTimeout(() => {
    deviceLogMonitorService.initialize().catch((error) => {
      loggerService.error('Failed to initialize device log monitor service:', error)
    })
  }, 3000)
}
```

### UI 集成

**页面组件**：`src/renderer/src/pages/files/DeviceLogListView.tsx`

**状态同步**：
- 每秒检查一次服务运行状态
- 实时更新UI显示
- 配置更改立即同步到服务

## 配置参数说明

### 1. enabled (监控开关)
- **类型**：boolean
- **默认值**：true
- **说明**：控制监控服务是否启用
- **注意**：禁用后，即使 autoUpload=true 也不会监控

### 2. interval (检查间隔)
- **类型**：number
- **默认值**：30
- **范围**：5-300 秒
- **说明**：定时器的触发间隔
- **建议**：
  - 测试环境：10-15秒
  - 生产环境：30-60秒
  - 低频场景：120-300秒

### 3. autoUpload (自动上传)
- **类型**：boolean
- **默认值**：true
- **说明**：是否自动上传新文件
- **注意**：
  - false时：只监控不上传，在控制台输出日志
  - true时：自动下载并上传到日志服务器

### 4. logServerUrl (日志服务器地址)
- **类型**：string
- **默认值**：`http://10.60.11.3:8085/api/v1/logs/upload`
- **说明**：日志文件上传的API地址
- **注意**：修改需要在代码中更改，暂不支持UI配置

## 监控日志

### 服务日志前缀

所有监控服务的日志都带有 `[DeviceLogMonitorService]` 前缀：

```
[DeviceLogMonitorService] 初始化服务，配置: {...}
[DeviceLogMonitorService] 启动监控，间隔: 30 秒
[DeviceLogMonitorService] 初始化文件列表，共 5 个文件
[DeviceLogMonitorService] 执行定时检查...
[DeviceLogMonitorService] 发现 2 个新文件: ["file1.tgz", "file2.tgz"]
[DeviceLogMonitorService] 开始上传: file1.tgz
[DeviceLogMonitorService] 上传进度: file1.tgz - 50%
[DeviceLogMonitorService] 上传成功: file1.tgz
```

### 调试方法

打开浏览器控制台 (F12)，查看日志输出：

1. **检查服务是否启动**
   ```
   [DeviceLogMonitorService] 应用启动初始化
   [DeviceLogMonitorService] 启动监控，间隔: 30 秒
   ```

2. **查看配置信息**
   ```
   [DeviceLogMonitorService] 配置已更新: {enabled: true, interval: 30, ...}
   ```

3. **监控文件检测**
   ```
   [DeviceLogMonitorService] 执行定时检查...
   [DeviceLogMonitorService] 发现 1 个新文件: ["device_log.tgz"]
   ```

4. **追踪上传过程**
   ```
   [DeviceLogMonitorService] 从FTP下载: device_log.tgz
   [DeviceLogMonitorService] 上传进度: device_log.tgz - 75%
   [DeviceLogMonitorService] 文件处理完成: device_log.tgz
   ```

## 故障排查

### 问题1：监控服务未启动

**症状**：应用启动后，控制台没有监控相关日志

**可能原因**：
1. 配置中 `enabled=false`
2. 配置中 `autoUpload=false`
3. 初始化错误

**解决方法**：
1. 打开设备日志页面，检查监控面板状态
2. 如果"禁用监控"按钮显示，点击改为"启用监控"
3. 确保"自动上传"开关打开
4. 查看控制台是否有错误信息

### 问题2：离开页面后监控停止

**症状**：离开设备日志页面后，不再上传新文件

**可能原因**：旧版本代码未更新

**解决方法**：
1. 确认使用的是全局监控版本
2. 检查 `src/renderer/src/init.ts` 是否包含 `initDeviceLogMonitor()`
3. 重新编译和运行应用

### 问题3：配置更改不生效

**症状**：修改间隔或开关，但监控行为未改变

**可能原因**：
1. localStorage 存储失败
2. 服务未正确重启

**解决方法**：
1. 打开浏览器控制台，执行：
   ```javascript
   localStorage.getItem('device_log_monitor_config')
   ```
2. 检查返回值是否包含最新配置
3. 如果不对，手动清除：
   ```javascript
   localStorage.removeItem('device_log_monitor_config')
   ```
4. 重新启动应用

### 问题4：上传失败

**症状**：检测到新文件，但上传失败

**可能原因**：
1. 日志服务器不可达
2. 文件格式不支持
3. 网络问题

**解决方法**：
1. 检查日志服务器地址：`http://10.60.11.3:8085/api/v1/logs/upload`
2. 确认文件格式：仅支持 `.tgz` 和 `.tar.gz`
3. 确认文件大小：不超过 1GB
4. 查看控制台详细错误信息

## 与页面监控的区别

### 旧版页面监控（已废弃）

```
❌ 仅在设备日志页面生效
❌ 离开页面后停止监控
❌ 需要手动点击"启动监控"
❌ 不保存配置
```

### 新版全局监控（当前版本）

```
✅ 应用启动自动运行
✅ 不受页面切换影响
✅ 默认开启自动上传
✅ 配置持久化保存
✅ 支持后台运行
```

## 最佳实践

### 1. 生产环境配置建议

```typescript
{
  enabled: true,         // 始终启用
  interval: 60,          // 1分钟检查一次，平衡性能和响应
  autoUpload: true,      // 自动上传，无需人工干预
  logServerUrl: '...'    // 配置稳定的服务器地址
}
```

### 2. 开发测试配置建议

```typescript
{
  enabled: true,
  interval: 10,          // 快速响应，便于测试
  autoUpload: true,
  logServerUrl: '...'
}
```

### 3. 演示/展示配置建议

```typescript
{
  enabled: true,
  interval: 30,
  autoUpload: false,     // 不自动上传，便于演示
  logServerUrl: '...'
}
```

## 性能考虑

### 资源占用

- **CPU**：轮询时几乎不占用，上传时会有一定占用
- **内存**：< 10MB（主要是文件记录）
- **网络**：
  - 检查文件列表：每次 < 10KB
  - 上传文件：取决于文件大小

### 优化建议

1. **合理设置检查间隔**：过短会增加 FTP 服务器负载
2. **网络稳定性**：确保 FTP 和日志服务器网络稳定
3. **文件大小限制**：建议单个文件不超过 500MB

## 安全考虑

### 1. 配置存储安全
- localStorage 仅存储配置，不存储敏感数据
- FTP 密码硬编码在代码中（anonymous）

### 2. 网络安全
- FTP 使用匿名访问
- HTTP上传（非HTTPS），建议在内网环境使用

### 3. 权限控制
- 服务仅在 renderer 进程运行
- 不涉及系统级权限

## 未来改进

1. **配置界面增强**：允许修改日志服务器地址
2. **WebSocket 推送**：替代轮询，实现真正的实时监控
3. **并行上传**：支持多文件并行处理
4. **断点续传**：支持大文件的断点续传
5. **上传队列**：显示上传队列和历史记录
6. **错误重试**：自动重试失败的上传

## 相关文档

- [FTP 自动监控功能指南](./ftp-auto-monitor-guide.md)
- [FTP 监控使用示例](./ftp-monitor-usage-example.md)
- [设备日志管理](./device-log-management.md)

---

**版本**：v2.0 (全局监控版本)
**最后更新**：2025-10-10
**负责人**：开发团队

