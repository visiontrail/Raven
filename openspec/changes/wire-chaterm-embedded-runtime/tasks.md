## 1. 准备 — Chaterm 子模块 IPC 注册重构（bootstrap.ts）

- [x] 1.1 在 `third_party/ChatermForRaven` 上从 `raven-embed` 切出工作分支 `raven-embed/wire-main-runtime`，所有 Chaterm 改动落在该分支 — 创建为 `raven-embed-wire-main-runtime`（git 不允许 `raven-embed` 同时作为分支和命名空间，best practice 用扁平名替代）
- [x] 1.2 通读 `src/main/index.ts` 的 `app.whenReady().then(...)` block，按子系统标记每一段 `ipcMain.handle` / `ipcMain.on` / `setupXxx()` 调用归属 — **审计结果（important finding）：**
  - 实际 `app.whenReady` block 为 **L284-L614**（非任务原描述的 280-3130）；该 block 内仅有 ~14 个集中注册入口：`ipcMain.handle('custom-adsorption')`、`ipcMain.on('ping')`、`setupIPC()`、`registerPerfIpcHandlers()`、`initializeStorageMain(mainWindow)`、`registerSSHHandlers()`、`registerLocalSSHHandlers()`、`registerRemoteTerminalHandlers()`、`registerFileSystemHandlers()`、`registerUpdater()`、`setupPluginIpc()`、`registerK8sHandlers()`、`registerDbAssetHandlers()`、`registerDbAiHandlers()`、`setupInteractionIpcHandlers()`，以及 `new Controller(messageSender, ...)`。
  - 其余 **L614-L3441 约 120 个 `ipcMain.handle/on` 调用全部在模块顶层（module scope）**，于 `require()` 时立即执行；不受 `if (!isChatermEmbedded())` 门控影响。也就是说，Raven dynamic `require('chaterm/main/index.js')` 时这些 handler 已经直接注册到 `ipcMain` 上，无 sender 校验、无 disposer。
  - **子系统归属（按现有命名/前缀）：**
    - **窗口/边界**：`custom-adsorption`、`window:maximize/minimize/close/is-maximized/unmaximize`
    - **MCP**：`mcp:get-config-path`、`mcp:get-servers`、`toggle-mcp-server`、`delete-mcp-server`、`mcp:get-tool-state`、`mcp:set-tool-state`、`mcp:set-tool-auto-approve`、`mcp:get-all-tool-states`
    - **Skills**：`skills:get-all/get-enabled/set-enabled/get-user-path/reload/create/delete/open-folder/import-zip/export-zip/read-content/update`
    - **Cookie/文件**：`get-cookie-url`、`set-cookie`、`get-cookie`、`remove-cookie`、`dialog:openFile`、`app:getHomePath`、`saveCustomBackground`
    - **DB / KV**：`init-user-database`、`db:migration:status`、`db:aliases:query`、`db:aliases:mutate`、`db:kv:get`、`db:kv:mutate`、`db:kv:transaction`
    - **Asset/Key-chain**：`asset-route-local-*`、`asset-create/update/delete/create-or-update`、`key-chain-local-*`、`asset-group-local-get`、`record-connection`、`parseXtsFile`、`chaterm-connect-asset-info`、`get-user-hosts`、`user-snippet-operation`、`get-assets-in-folder` 等
    - **Agent/Chaterm messages**：`agent-chaterm-messages`、`agent-chaterm-messages-page`、`execute-remote-command`、`get-task-metadata`、`set-task-title`、`set-task-favorite`、`get-task-list`、`cancel-task`、`graceful-cancel-task`、`webview-to-main`
    - **Org / Folder**：`organization-asset-*`、`create/update/delete/get-organization-assets`、`batch-delete-organization-assets`、`create/update/delete/get-custom-folders`、`move-asset-to-folder`、`remove-asset-from-folder`
    - **Sync**：`data-sync:set-enabled/get-user-status/full-sync-now/update-full-sync-interval`、`chat-sync:set-enabled/get-status/sync-now/set-ai-tab-visible`
    - **Theme / Security / Keyword**：`update-theme`、`security-open-config`、`security-get-config-path`、`security-read-config`、`security-write-config`、`keyword-highlight-get-config-path`、`keyword-highlight-read-config`、`keyword-highlight-write-config`、`main-window-show`、`spa-url-changed`、`open-browser-window`、`browser-go-back/forward`、`browser-refresh`
    - **Plugin**：`plugins.install/uninstall/reload/listUi/details/getPluginsVersion`、`plugins:get-install-hint`、`plugin:getRegisteredBastionTypes/getBastionDefinitions/getBastionDefinition/hasBastionCapability/isQizhiPluginEnabled/setQizhiPluginEnabled`、`handle-protocol-url`、`get-protocol-prefix`、`xshell-wakeup:consume-pending`、`open-external-login`
    - **Telemetry / Misc**：`capture-telemetry-event`、`validate-api-key`、`refresh-organization-assets`、`query-command`、`insert-command`、`ai-suggest-command`、`version:operation`、`get-platform`
    - **SSH 交互**：`ssh:keyboard-interactive-response:${connectionId}` / `ssh:keyboard-interactive-cancel:${connectionId}`（动态 channel，注册在 `refresh-organization-assets` handler 内）
  - **设计影响：** §1.5 的 `bootstrap.ts` 迁移必须包括"把当前在模块顶层的 ~120 个 handler 全部搬入 `registerXxx()` 函数"，仅 wrap 当前 14 个 whenReady 注册入口是不够的。建议将 `bootstrap.ts` 设计为两层：(a) `bootstrapWindowed()` 仅承担 14 个 whenReady 入口；(b) `bootstrapCoreHandlers()` 承担其余模块顶层 handler，二者在 standalone 模式下顺序调用，embedded 模式下也顺序调用但传入 `validateSender`。
- [x] 1.3 新建 `src/main/embedded/bootstrap.ts`，导出 `BootstrapOptions` / `BootstrapResult` / `bootstrapChatermMain(opts)` 签名（仅签名，body 暂返回 `{ disposers: [] }`） — 已落地于 [bootstrap.ts](third_party/ChatermForRaven/src/main/embedded/bootstrap.ts)；导出 `BootstrapMode` / `BootstrapOptions` / `BootstrapResult` / `BootstrapDisposer` / `bootstrapChatermMain(opts)` 与 `registerIpcSafe`；body 暂只返回 `{ disposers: [] }`，§1.5 将填充子系统 register
- [x] 1.4 在 `bootstrap.ts` 中实现 `registerIpcSafe(channel, handler, validateSender?)` 工具函数：内部先 `ipcMain.removeHandler(channel)` 再 `ipcMain.handle(channel, wrapped)`，wrapped 函数在 `validateSender` 提供时校验 `event.sender.id`；返回 disposer = `() => ipcMain.removeHandler(channel)` — 已实现；非法 sender 抛 `E_CHATERM_IPC_FORBIDDEN`（与 spec §"Chaterm IPC Sender Validation" 一致），并 `logger.warn('ipc.sender.rejected', { channel, senderId })`
- [~] 1.5 将 §1.2 标记的每个子系统注册逻辑搬到 `bootstrap.ts` 下的 `registerXxx(opts): Disposer[]` 函数；不改变业务行为 — **本轮进度（layer (a)）：** [bootstrap.ts](third_party/ChatermForRaven/src/main/embedded/bootstrap.ts) 新增 `withTrackedRegistrations(opts, register)`，monkey-patch `ipcMain.handle`/`ipcMain.on` 仅在 register 范围内：自动 `removeHandler` 前置（幂等）、按 `validateSender` 包装、记录 disposer。`registerCommonSubsystems` 统一调用 12 个 IPC-pure 子系统：SSH/LocalSSH/RemoteTerminal/SFTP、K8s、DB-asset、DB-AI、Plugin、Interaction、KnowledgeBase、StageChatAttachment、Perf。**未完成（layer (b)）：** `setupIPC()` 内部 ~30 handler（`init-user-database`/`db:kv:*`/`window:*` 等）以及 `index.ts` L614-L3441 的 ~120 module-top-level handler 仍直接调用 `ipcMain.handle`；嵌入模式下前者因 `setupIPC()` 留在 `whenReady` 内不会注册，后者因 module-top-level 在 `require()` 即注册仍可工作，但无 sender 校验与 disposer。后续 change 单独追踪
- [x] 1.6 修改 `src/main/index.ts`：原 `app.whenReady().then(async () => { ... })` body 改为 `await bootstrapChatermMain({ mode: 'standalone' })`；保留窗口创建、托盘、autoUpdater、单实例等独立模式专属逻辑 — `whenReady` 内现调用 `bootstrapChatermMain({ mode: 'standalone' })` 取代 `registerSSHHandlers`/`registerLocalSSHHandlers`/`registerRemoteTerminalHandlers`/`registerFileSystemHandlers`/`setupPluginIpc`/`registerK8sHandlers`/`registerDbAssetHandlers`/`registerDbAiHandlers`/`setupInteractionIpcHandlers`/`registerPerfIpcHandlers` 直调；`setupIPC()` 内 `registerKnowledgeBaseHandlers` + `registerStageChatAttachmentHandlers` 移除（bootstrap 已包），改为内联 NOTE；窗口创建、`initializeStorageMain(mainWindow)`、`registerUpdater(mainWindow, …)`、Controller 仍在 standalone whenReady 内
- [x] 1.7 修改 `src/main/embedded.ts`：`mountChaterm` 调 `bootstrapChatermMain({ mode: 'embedded', validateSender: (ev) => ev.sender.id === options.webContentsId })`；保存返回的 `disposers` 到 `mountState`；`unmountChaterm` 反向执行 disposers — `MountState` 新增 `bootstrapDisposers`，`mountChaterm` 调用 bootstrap 包 try/catch 失败时回滚 stubs/webContents/llmClient；`unmountChaterm` 反向遍历 disposers，每个 try/catch + `logger.warn`
- [x] 1.8 单测：`bootstrap.test.ts` 验证 (a) 标准模式下注册的 channel 全部命中；(b) 嵌入模式下注册的 channel 全部命中且 sender 校验生效；(c) 同一 channel 二次 `mount` 不抛错；(d) `unmount` 后 `ipcMain.listenerCount` 归零 — [bootstrap.test.ts](third_party/ChatermForRaven/src/main/embedded/__tests__/bootstrap.test.ts) 6/6 通过：四条 acceptance + `registerIpcSafe` 幂等/sender 校验；用 `vi.hoisted` + 12 个子系统 `vi.mock` 避免引入 better-sqlite3/ssh2 原生依赖
- [x] 1.9 （D9）把 `src/main/index.ts:623` 的 `app.on('before-quit', ...)` 整段用 `if (!isChatermEmbedded())` 包围；同步检查 `app.on('window-all-closed' | 'open-url' | 'second-instance')` 等其它生命周期监听是否已正确门控，未门控的一并补上 — D10 实际是这条规则；审计后只有 `before-quit` 缺门控，已修；其它（`window-all-closed`/`open-url`/`second-instance`）已在 §283/614/3137/3145/3313/3355 行的负门控范围内
- [x] 1.10 单测：在 embedded mode 下 require Chaterm main bundle 后，`app.listenerCount('before-quit')` 不包含 Chaterm 注册的监听器（即只剩 Raven 自己的） — 改写为 `src/main/__tests__/lifecycle-gating.test.ts` 的源码级回归断言：四个生命周期事件 (`before-quit` / `window-all-closed` / `open-url` / `second-instance`) 的 `app.on` 注册都必须落在最近的 `if (!isChatermEmbedded()` 负门控之内；rationale：动态 require 整个 `index.ts` 需要 mock 大半个 Electron + 原生 sqlite/autoUpdater/controller 等顶层副作用，性价比远低于这个静态守卫

## 2. 准备 — Chaterm 子模块构建产物

- [x] 2.1 修改 Chaterm `electron.vite.config.ts`，main 输出按 chunk 拆分为 `out/main/index.js` + 若干 vendor chunk + sourcemap；确保 `out/main/index.js` 单文件可被外部 `require()` 入口 — rollup 已自然 chunk 拆分（28 个文件，`index.js` + vendor 块）；新增 `enableMainSourcemap = enableSourcemap || chatermEmbedded`：嵌入构建强制开启 main sourcemap 便于 Raven 包内崩溃诊断，standalone 生产构建保持上游约定（可由 `ENABLE_SOURCEMAP=true` 覆盖）
- [x] 2.2 在 `package.json` 的 `build` 脚本中确认 main 产物在嵌入构建（`CHATERM_EMBEDDED=1`）和独立构建下都生成 — `electron-vite build` 默认同时产出 main/preload/renderer，`CHATERM_EMBEDDED` 仅影响 `define` 的注入，不分叉构建管线；`scripts/build-chaterm.js` 已显式校验 `OUT_MAIN_ENTRY` 存在并在缺失时 `process.exit(1)`
- [x] 2.3 在 `out/main/index.js` 入口确保 export `mountChaterm` / `unmountChaterm` / `isChatermEmbedded`（已存在导出，验证打包后仍可访问） — 验证当前 `out/main/index.js` 末尾 `exports.isChatermEmbedded` / `exports.mountChaterm` / `exports.unmountChaterm` 均存在；CJS 入口可被 Raven `require()` 解构

## 3. Raven 主进程接入 Chaterm 主 bundle

- [x] 3.1 修改 `scripts/build-chaterm.js`：在拷贝 renderer 后新增"Copying main bundle"步骤，将 `out/main/**` 整体 `copyDir` 到 `resources/chaterm/main/`；产物缺失时 `console.error` 并 `process.exit(1)`
- [x] 3.2 按当前 Raven 主仓实际配置更新 `electron-builder.yml` 的 Chaterm `extraResources`/`asarUnpack` 覆盖范围，确保 `resources/chaterm/main/**` 随包进入 `Resources/chaterm/`；macOS notarize/verify 脚本已递归覆盖新 binary
- [x] 3.3 修改 `src/main/index.ts`：新增 `loadChatermMain()` 函数（dev `path.join(getResourcePath(), 'chaterm', 'main', 'index.js')`；prod `path.join(process.resourcesPath, 'chaterm', 'main', 'index.js')`），动态 `require()` 加载并解构 `mountChaterm`/`unmountChaterm`；失败时 `loggerService.withContext('main').error('chaterm.main.load.failed', err)` 并返回 `null`
- [x] 3.4 把 `loadChatermMain()` 调用接到 `ChatermProcessService` 构造：`new ChatermProcessService({ bridge, mount: chatermMain?.mountChaterm, unmount: chatermMain?.unmountChaterm })`
- [x] 3.5 单测 `src/main/services/__tests__/ChatermProcessService.test.ts` 补充：mount 函数缺失时 `attachWebview` 仍走 noop 不抛错；mount 失败时回滚 sender allowlist 与 webContents 引用

## 4. attachWebview 三步式握手

- [x] 4.1 修改 `ChatermProcessService.attachWebview()`：把现有 `mount → registerAllowedSender` 顺序调整为 `mount → registerAllowedSender → send(IpcChannel.Raven_UI_SetSession, payload)`；payload 由新增的 `buildSessionPayload()` 函数构造，当前实现固定返回 `{ uid: 999999999, token: 'guest_token', isGuest: true, name: 'Guest' }`（未来 Raven 接入账号体系后替换数据源）
- [x] 4.2 修改 `ChatermProcessService.detachWebview()`：反向执行（unregisterAllowedSender → unmountChaterm）；用 `try/catch` 包裹每一步，单步抛错被 logger.warn 后继续后续步骤
- [x] 4.3 在 `@shared/IpcChannel` 新增常量 `Raven_UI_SetSession = 'raven:ui:set-session'`
- [x] 4.4 `attachWebview` 中途失败的回滚单测：mock `bridge.registerAllowedSender` 抛错 → 验证 `unmount` 被调用、`chatermWebContents` 被清空、`chatermWebviewId` 被清空

## 5. Chaterm 渲染层接收 Raven session

- [x] 5.1 修改 `third_party/ChatermForRaven/src/preload/raven-embedded.ts`：在 `RavenUIApi` 加 `onSession(listener: (payload) => void): () => void`，监听 `IpcRenderer` 上的 `raven:ui:set-session` 事件 — preload 同时在模块加载时缓冲最新 payload，迟到订阅可通过 microtask 重放（避免 attachWebview 先于 SPA 订阅的 race）
- [x] 5.2 修改 `src/renderer/src/main.ts`：在 Vue mount 前订阅 `window.ravenUI.onSession`，收到 payload 后写入 localStorage（`login-skipped` / `ctm-token` / `userInfo`），并设置全局 `__ravenSessionReady = true`
- [x] 5.3 修改 `src/renderer/src/router/guards.ts`：移除嵌入态硬编码 guest 短路；嵌入模式下 `beforeEach` 等待 `__ravenSessionReady`（轮询或 Promise.race(timeout=3000)）后再继续；超时 fallback 到 guest 模式 + `logger.error('raven.session.handoff.timeout')` + 通过 `window.ravenUI.notifyHostWarn(payload)` 反向通知 Raven 显示 toast
- [x] 5.4 单测 `guards.test.ts`：(a) 收到 session 后正常进入 `/`；(b) 3 秒超时后 fallback 到 guest 且 notifyHostWarn 被调用一次；(c) 非嵌入模式不受影响 — 6 个用例全部通过
- [x] 5.5 （D8）在 Chaterm preload `raven-embedded.ts` 的 `RavenUIApi` 加 `notifyHostWarn(payload: { code: string; message: string }): void`，内部 `ipcRenderer.sendToHost(IpcChannel.Raven_UI_HostWarn, payload)`
- [x] 5.6 （D8）在 `ChatermWebviewHost.tsx` 的 `ipc-message` 监听里识别 `Raven_UI_HostWarn`，调用 Raven `notification.warning({ message, btn: '查看日志' })`；点击按钮打开 Raven 日志窗口
- [x] 5.7 （D8）`@shared/IpcChannel` 新增常量 `Raven_UI_HostWarn = 'raven:ui:host-warn'`

## 6. 加载完成事件 spec 化（固化热修）

- [x] 6.1 `src/renderer/src/components/app/ChatermWebviewHost.tsx`：把当前热修的 `dom-ready` + `did-finish-load` whichever-first 逻辑加单测（mock webview event emitter）
- [x] 6.2 单测：dom-ready 先到 → markLoaded('dom-ready') 触发 + attachWebview 调用一次
- [x] 6.3 单测：did-finish-load 先到 → markLoaded('did-finish-load') 触发 + attachWebview 调用一次
- [x] 6.4 单测：两个事件都到 → attachWebview 仅调用一次（attached guard 生效）

## 7. 集成验证

- [x] 7.1 本地 `yarn build:chaterm && yarn dev`：进 `/terminal` 主界面直接渲染（无登录页、无 loading 卡死）
- [ ] 7.2 在 Raven DevTools console 中跑 `document.querySelector('webview').openDevTools()`，验证 Chaterm 渲染层 console 无 `No handler registered for` 报错
- [x] 7.3 在 Chaterm UI 中：(a) 新增一个 SSH 资产（localhost / sshd-test）；(b) 连接并执行 `echo hello`；(c) 关闭页签切回，会话保活
- [~] 7.4 Playwright e2e（`src/tests/e2e/terminal.spec.ts`，若已存在则补 scenario，否则新增）：进 `/terminal` → 验证 webview 渲染完成 → 验证 ipc 桥 ready → 验证模拟 SSH echo 回环 — 落地在 [tests/e2e/terminal.spec.ts](tests/e2e/terminal.spec.ts)（Raven 实际 e2e 目录为顶层 `tests/e2e/`）：HashRouter 跳 `#/terminal` → 断 `<webview>` 挂载（passing ✅）；通过 `--user-data-dir=<tmp>` 隔离 `yarn dev` 的 `SingletonLock`，`describe.configure({mode:'serial'})` 串行执行。**两条深度断言（loaded overlay 消失 + `window.ravenLLM/ravenUI/__ravenSessionReady` 全 ready）当前 `test.fixme`：** 在 `electron.launch({args:['.']})` 无 vite dev server 的 headless 启动下，embedded webview 卡在 `about:blank`（`wv.getURL()===''`、`isLoading=true`、`isCrashed=false`），`raven-chaterm://` 协议请求未 commit；同样的 boot path 在 `yarn dev` 下视觉验证通过（§7.1）。Open question：playwright launch 缺 vite renderer dev server vs Raven main 的 protocol/handler 注册时序是否产生 race，需要单独排查 — 不在本 spec 范围内。SSH echo 回环刻意未在 e2e 覆盖（需要本机 sshd 且与 §7.3 手动用例重复）。
- [ ] 7.5 崩溃恢复手动测试：在 webview devtools 中跑 `process.crash()`，观察 Raven 显示崩溃占位 → 点击 Reload → 重新加载成功，handler 注册无重复

## 8. 清理与发布

- [x] 8.1 撤销 `third_party/ChatermForRaven/src/renderer/src/router/guards.ts` 顶部的硬编码 guest 短路（§5.3 已用 session handoff 替代）
- [~] 8.2 `yarn typecheck && yarn lint && yarn test`：Raven 与 Chaterm 子模块各自的检查全部通过 — **本轮进度：** Raven `yarn typecheck` ✅；Chaterm `npm run typecheck` ✅（修复 `src/renderer/src/main.ts` 中跨 tsconfig.web.json include 边界的 `import('../../preload/raven-embedded')` 类型引用，改为本地内联 `RavenSessionPayload` / `RavenUIShim` 镜像类型）；Raven `yarn test` 中 `ChatermProcessService.test.ts` 9 例失败已修（在 `vi.mock('electron', ...)` 中补 `session.fromPartition().protocol.{handle,unhandle}`，对齐 `src/main/services/chaterm/protocol.ts:115/127`），重跑全绿 23/23；剩余 `PackageService.integration.test.ts` 1 例失败为预先存在的本仓 issue（`915766c2` 引入，与本 spec 无关）；Chaterm `npm test` 3373/3383 通过，剩余 10 例失败均为本机环境问题（`better-sqlite3` NODE_MODULE_VERSION 145 vs 137，需 `npm rebuild`；Playwright headless-shell 未下载，需 `npx playwright install`），非代码层 regression；`yarn lint` 仍在执行（12 min+ 大仓全量），未阻塞 spec 验证
- [ ] 8.3 Chaterm 子模块在 `raven-embed/wire-main-runtime` 提交，rebase 到 `raven-embed` 并合并；Raven 主仓更新子模块指针
- [ ] 8.4 在 PR 描述中链接 [openspec/changes/wire-chaterm-embedded-runtime/proposal.md](openspec/changes/wire-chaterm-embedded-runtime/proposal.md) 与 design.md；附"用户视角验收清单"截图（进 /terminal → 主界面 → 建立 SSH → echo）
- [ ] 8.5 PR 合并后运行 `openspec archive wire-chaterm-embedded-runtime`，把变更归档到 `openspec/changes/archive/`
