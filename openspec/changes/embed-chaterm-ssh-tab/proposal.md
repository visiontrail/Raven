## Why

Raven 当前缺少远程主机管理与终端能力，用户做 DevOps/运维场景时必须切到外部 SSH 客户端。`third_party/ChatermForRaven` 是一个成熟的 AI 原生 SSH 终端（GPL-3.0），具备 ssh2/SFTP/堡垒机/K8s exec/skills 等完整能力，可以直接复用，避免从零造轮子。同时，Chaterm 自带的多 provider AI 配置与 Raven 已成熟的 `AiProvider` + middleware（缓存、流式、重试、统计）功能重叠，重复维护成本高、用户体验割裂——一次配置应当在两处都生效。

本次变更只做两件事：把 Chaterm 作为一个标签页嵌入 Raven（路径 A：webview 嵌入），并把 Chaterm 内部所有 LLM 调用桥接到 Raven 的 `AiProvider`。SSH 工具向 Raven Agent 暴露（目标 2）由后续变更承担。

## What Changes

- 在 Raven 主侧栏新增 **Terminal** 标签项，路由 `/terminal`，进入后以 `<webview>` 加载 Chaterm 独立打包产物。
- 将 Chaterm 从子模块构建产物输出到 Raven 的 `resources/chaterm/` 目录，由 Raven `electron-builder` 一并打包。
- Chaterm 的 Electron / `better-sqlite3` / `node-pty` ABI 强制对齐 Raven 主进程 Electron 37 版本（Chaterm 上游 41 → 降级到 37）。
- Chaterm 与 Raven 之间通过 `chaterm:*` 前缀的 IPC 命名空间通信，避免与 Raven 现有 `IpcChannel` 冲突。
- Raven 主进程新增 `RavenLLMBridge` IPC 服务（`raven:llm:*`），暴露 `createMessage` / `listAvailableModels` 等接口，内部转发到 Raven 的 `AiProvider.completions()`。
- Chaterm 主进程新增 `RavenBridgeHandler implements ApiHandler`，注册为新 provider key `raven-bridge`；流式协议适配 Raven 的 callback/iterator → Chaterm 的 `ApiStream` async generator。
- Chaterm 设置页的"模型/Provider 配置"区域在嵌入模式下隐藏或锁定为只读说明，默认 provider 固定为 `raven-bridge`。
- **BREAKING**（仅对 Chaterm 子模块的本地分支）：Chaterm `buildApiHandler()` 在嵌入模式下不再读取 Chaterm 自己的 provider 配置；Chaterm 用户登录与多 edition (cn/global) 在嵌入模式下禁用。

## Capabilities

### New Capabilities
- `chaterm-tab-embedding`: Raven 主窗口提供一个 Terminal 标签页，作为隔离的 webview 容器加载 Chaterm 渲染层，并负责生命周期、主题同步、IPC 桥接、打包/分发。
- `raven-llm-bridge`: Raven 主进程对内部子系统（首位消费者：嵌入式 Chaterm）暴露统一的 LLM 调用通道，让任意子系统能复用 Raven 已配置的 provider/模型，而无需自行管理 API key 与流式协议。

### Modified Capabilities
<!-- 无 -->

## Impact

- **代码**：
  - Raven：`src/renderer/src/pages/terminal/`（新）、`src/renderer/src/components/app/Sidebar.tsx`（注册新路由）、`src/renderer/src/Router.tsx`（新路由）、`src/main/services/`（新增 `RavenLLMBridgeService`、`ChatermProcessService`）、`src/preload/index.ts`（新增 `chaterm` / `ravenLLM` 命名空间）、`packages/shared/IpcChannel.ts`（新增 channel 常量）。
  - Chaterm 子模块（本地分支）：`src/main/agent/api/raven-bridge.ts`（新）、`src/main/agent/api/index.ts`（注册 provider）、`src/renderer/src/views/settings/*`（隐藏 provider 配置）、`electron.vite.config.ts`（输出路径与 Electron ABI 对齐）。
- **依赖**：
  - Raven 新增 `node-pty`、`ssh2`、`better-sqlite3`（由 Chaterm 主进程模块带入；Raven 自身不直接 import，但需要在 `electron-builder` `asarUnpack` / `extraResources` 中处理原生模块）。
  - Chaterm 的 Electron 41 降级到 37：需要回归测试 `@xterm/*`、`better-sqlite3@12`、`node-pty@1`、`@kubernetes/client-node` 在 Electron 37 ABI 上的行为。
- **构建/分发**：`electron-builder.yml` 需要新增 `extraResources` 把 Chaterm 构建产物（含独立 preload）打入主包；macOS notarize 脚本要覆盖 Chaterm 的二进制。
- **数据**：Chaterm 的 sqlite 文件落在 `app.getPath('userData')/chaterm_db/`，与 Raven 现有 libsql 数据互不影响，但需要在 Raven "清除数据" / 卸载流程中考虑。
- **法律**：Chaterm 为 GPL-3.0。本变更**不在本规范范围内**解决许可证兼容问题——前置依赖是 Chaterm 双重授权或法务结论，未解决前本变更不应进入实施阶段。
- **不在本次范围内**：把 Chaterm 的 SSH 工具暴露给 Raven Agent + Claude Agent SDK（目标 2，留待后续 change）；把 Chaterm UI 移植到 React（路径 B）；Chaterm 用户体系与 Raven 账号体系的整合。
