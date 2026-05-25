## Why

`embed-chaterm-ssh-tab` 落地了"Terminal 标签 + webview 容器 + LLM 桥接"骨架，但 Chaterm 主进程的 IPC 注册层从未真正接进 Raven 主进程：

- [src/main/index.ts:111](src/main/index.ts:111) 实例化 `ChatermProcessService` 时未传 `mount` / `unmount` 回调，运行期落到 `noopMount` 兜底，日志一直是 `Chaterm mount() called with no-op stub — Chaterm submodule not wired in this build`。
- Chaterm 子模块自身把所有 IPC 处理器（`init-user-database`、`asset-route-local-*`、`ssh:*`、`chaterm:*`、`db:kv:*`、Agent / DB-AI / 加密 / 快捷键…）注册在 `app.whenReady().then(...)` 里，而该块整段被 `if (!isChatermEmbedded())` 包住——嵌入模式下一个 handler 都不会注册。
- 结果：Chaterm 渲染层一进 `/terminal` 就会调用未注册的 `window.api.initUserDatabase`，路由守卫被卡住 → 登录页根本进不去；即便我们用 [guards.ts:29-43](third_party/ChatermForRaven/src/renderer/src/router/guards.ts:29) 临时短路绕过登录，进了首页后 SSH 连接、终端 PTY、聊天历史、设置持久化等所有依赖主进程 IPC 的能力依旧全部失效。

本次变更补齐这条"Chaterm 主进程在嵌入模式下被托管运行"的缺失链路，使 Terminal 标签不仅"能打开"，而且具备完整 SSH / PTY / 持久化 / Agent 能力。

## What Changes

- 在 Chaterm 子模块新增 `bootstrapChatermEmbeddedMain()` 入口，把 `app.whenReady` 中**与窗口无关、与 IPC 注册有关**的逻辑（数据库初始化、IPC handler 注册、token / 加密 / Agent / SSH / SFTP / PTY / 文件 / KV 等）抽成可重入函数；嵌入模式下由 `mountChaterm()` 在 `webview` 挂载时调用，标准模式下仍由 `app.whenReady` 调用，二者共用同一实现。
- 在 Chaterm `embedded.ts` 的 `mountChaterm()` / `unmountChaterm()` 流程里加入：①幂等的 IPC handler 注册；②按 webview `webContents.id` 作 `event.sender` 校验；③unmount 时 `ipcMain.removeHandler` 全量回收，渲染进程崩溃 / 标签禁用时不留垃圾 handler。
- Raven 主进程 [src/main/index.ts](src/main/index.ts) 在 `app.whenReady` 内动态 `import()` 子模块的 `mountChaterm` / `unmountChaterm`，并通过 `ChatermProcessService` 构造参数注入；导入失败时降级到 `noopMount` 并打 `error`，不阻断 Raven 启动。
- Raven `scripts/build-chaterm.js` 与 `electron-vite.config.ts` 增加 Chaterm 主进程 bundle 的产出与解析路径：dev 直接从 `third_party/ChatermForRaven/out/main/index.js` 引用；prod 把该产物随 `resources/chaterm/main.js` 一并 `extraResources` 打包，并由 Raven 主 bundle 在运行时定位。
- `ChatermWebviewHost` 首次创建 webview 时先加载 `about:blank`，拿到 guest `webContentsId` 后调用 `attachWebview()`；只有 `mountChaterm()` 与 `bridge.registerAllowedSender()` 成功后才把 webview 导航到 `raven-chaterm://app/index.html`，避免 Chaterm SPA 在 IPC handler 未注册前调用 `initUserDatabase`。
- 嵌入模式不引入 Raven → Chaterm 账号 session handoff。Chaterm 渲染层固定写入本地 guest 身份（`uid=999999999` / `guest_token`），跳过登录页，但仍走上游 guest 的 `initUserDatabase` 流程；也就是说不再用 [guards.ts:29-43](third_party/ChatermForRaven/src/renderer/src/router/guards.ts:29) 的"嵌入态直接 `next()`"短路。
- Raven `RavenLLMBridgeService` 与 `ChatermProcessService` 在 `attachWebview` 中按 `mount → registerAllowedSender` 执行；`mountChaterm()` 只注册 Chaterm 自己的 IPC handler，不反向操作 Raven 的 LLM allowlist。
- 保留并固化 [src/renderer/src/components/app/ChatermWebviewHost.tsx](src/renderer/src/components/app/ChatermWebviewHost.tsx) 的 `dom-ready` 兜底（当前热修），但它只用于隐藏视觉遮罩，不再承担 attach/mount 时机。
- 明确验收目标：Chaterm Agent 必须通过 Raven LLM 桥拿到工具调用，并经 Chaterm 既有 `execute_command` / remote-terminal / SSH 通道在已连接的远程主机上执行命令（例如 `echo raven-ai-control`），而不是只验证"AI 能聊天"或"SSH 能手动 echo"。
- **不在本次范围**：把 Chaterm 账号 / 数据同步 / 设备指纹与 Raven 账号体系整合；Chaterm 自有的更新检查、edition 切换（已由 `registerEmbeddedIpcStubs` 短路返回）；Linux/Windows 第二实例分发逻辑（嵌入模式不需要）。

## Capabilities

### New Capabilities

- `chaterm-embedded-main-runtime`: 在嵌入模式下，由 Raven 主进程托管启动 Chaterm 主进程必备的 IPC 处理器、数据库句柄与生命周期，使 Chaterm 渲染层依赖的所有 `window.api.*` 调用在 Raven 进程内得到真实响应；覆盖：bootstrap、IPC 注册/撤销、sender 校验、崩溃清理、退出时序、本地 guest workspace 初始化。

### Modified Capabilities

- `chaterm-tab-embedding`: 把已有的"加载占位 = `did-finish-load`"放宽为"`dom-ready` 优先、`did-finish-load` 兜底"；把"webview 直接加载 Chaterm URL 后再 attach"改为"先 blank attach/mount，再导航到 Chaterm URL"，并描述 unmount/崩溃/退出时的反向时序。

## Impact

- **代码 — Chaterm 子模块（本地 `raven-embed` 分支）**：
  - 新增 `src/main/embedded/bootstrap.ts`：抽取 `app.whenReady` 中所有 IPC handler 注册，按"DB / 加密 / Agent / SSH / SFTP / PTY / KV / 文件 / 自动补全 / 快捷键 / TTS"模块化拆分，统一返回 disposer 数组。
  - 修改 `src/main/index.ts`：原 `app.whenReady` block 改为调用 `bootstrapChatermStandaloneMain()`，内部复用 `bootstrap.ts`。
  - 修改 `src/main/embedded.ts`：`mountChaterm` 调 `bootstrapChatermEmbeddedMain()`，记录 disposer；`unmountChaterm` 反向 dispose。
  - 修改 `src/renderer/src/router/guards.ts`：移除嵌入态直接 `next()` 短路；嵌入模式自动写入 guest 身份后继续走上游 guest 的 `initUserDatabase` 流程。
- **代码 — Raven 主仓**：
  - [src/main/index.ts](src/main/index.ts)：动态加载 Chaterm 主 bundle 并把 `mountChaterm` / `unmountChaterm` 注入 `ChatermProcessService`。
  - [src/main/services/ChatermProcessService.ts](src/main/services/ChatermProcessService.ts)：`attachWebview` 中按 `mount` → `registerAllowedSender` 执行；`detachWebview` 反序回收；中途失败必须 `unmount` 回滚。
  - [src/renderer/src/components/app/ChatermWebviewHost.tsx](src/renderer/src/components/app/ChatermWebviewHost.tsx)：首次创建时先 `about:blank` attach，attach 成功后再导航到 Chaterm URL；保留 dom-ready 兜底作为纯视觉加载判定。
  - [scripts/build-chaterm.js](scripts/build-chaterm.js)：增加 `out/main/*` 到 `resources/chaterm/main/` 的拷贝；校验产物存在。
- **构建/分发**：`electron-builder.*.yml` 的 `extraResources` 增加 `resources/chaterm/main/**`；Chaterm 的 `node-pty`、`ssh2`、`better-sqlite3` 等原生模块需保证与 Raven 主进程同一 ABI（Electron 41.3.0，已对齐）。
- **测试**：
  - 单元：`mountChaterm` 幂等性、`unmountChaterm` 全量回收、sender 校验阻断非授权 webContentsId、Raven 动态 import 失败时降级路径。
  - 集成（Playwright）：用户进 `/terminal` → 看到 Chaterm 首页（非登录页）→ 创建本地 SSH 测试连接（用 `ssh-server-mock` 或 localhost loopback）→ Chaterm Agent 通过 `execute_command` 在远端执行 `echo raven-ai-control` → 切走再切回，会话保持。
- **回滚策略**：本变更增加的能力均通过 `import('chaterm/main')` 的动态加载实现；若动态 import 失败或 `mountChaterm` 抛错，Raven 自动降级到 `noopMount` + 渲染层提示"Terminal 不可用"，不影响 Raven 其它功能。
