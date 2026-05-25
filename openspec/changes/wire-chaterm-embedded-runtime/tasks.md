## 1. 准备 — Chaterm 子模块 IPC 注册重构（bootstrap.ts）

- [ ] 1.1 在 `third_party/ChatermForRaven` 上从 `raven-embed` 切出工作分支 `raven-embed/wire-main-runtime`，所有 Chaterm 改动落在该分支
- [ ] 1.2 通读 `src/main/index.ts` 的 `app.whenReady().then(...)` block（约 280-3130 行），按子系统标记每一段 `ipcMain.handle` / `ipcMain.on` / `setupXxx()` 调用归属（DB / 加密 / Agent / DB-AI / SSH / SFTP / PTY / KV / 文件 / 自动补全 / 快捷键 / TTS）
- [ ] 1.3 新建 `src/main/embedded/bootstrap.ts`，导出 `BootstrapOptions` / `BootstrapResult` / `bootstrapChatermMain(opts)` 签名（仅签名，body 暂返回 `{ disposers: [] }`）
- [ ] 1.4 在 `bootstrap.ts` 中实现 `registerIpcSafe(channel, handler, validateSender?)` 工具函数：内部先 `ipcMain.removeHandler(channel)` 再 `ipcMain.handle(channel, wrapped)`，wrapped 函数在 `validateSender` 提供时校验 `event.sender.id`；返回 disposer = `() => ipcMain.removeHandler(channel)`
- [ ] 1.5 将 §1.2 标记的每个子系统注册逻辑搬到 `bootstrap.ts` 下的 `registerXxx(opts): Disposer[]` 函数；不改变业务行为
- [ ] 1.6 修改 `src/main/index.ts`：原 `app.whenReady().then(async () => { ... })` body 改为 `await bootstrapChatermMain({ mode: 'standalone' })`；保留窗口创建、托盘、autoUpdater、单实例等独立模式专属逻辑
- [ ] 1.7 修改 `src/main/embedded.ts`：`mountChaterm` 调 `bootstrapChatermMain({ mode: 'embedded', validateSender: (ev) => ev.sender.id === options.webContentsId })`；保存返回的 `disposers` 到 `mountState`；`unmountChaterm` 反向执行 disposers
- [ ] 1.8 单测：`bootstrap.test.ts` 验证 (a) 标准模式下注册的 channel 全部命中；(b) 嵌入模式下注册的 channel 全部命中且 sender 校验生效；(c) 同一 channel 二次 `mount` 不抛错；(d) `unmount` 后 `ipcMain.listenerCount` 归零

## 2. 准备 — Chaterm 子模块构建产物

- [ ] 2.1 修改 Chaterm `electron.vite.config.ts`，main 输出按 chunk 拆分为 `out/main/index.js` + 若干 vendor chunk + sourcemap；确保 `out/main/index.js` 单文件可被外部 `require()` 入口
- [ ] 2.2 在 `package.json` 的 `build` 脚本中确认 main 产物在嵌入构建（`CHATERM_EMBEDDED=1`）和独立构建下都生成
- [ ] 2.3 在 `out/main/index.js` 入口确保 export `mountChaterm` / `unmountChaterm` / `isChatermEmbedded`（已存在导出，验证打包后仍可访问）

## 3. Raven 主进程接入 Chaterm 主 bundle

- [ ] 3.1 修改 `scripts/build-chaterm.js`：在拷贝 renderer 后新增"Copying main bundle"步骤，将 `out/main/**` 整体 `copyDir` 到 `resources/chaterm/main/`；产物缺失时 `console.error` 并 `process.exit(1)`
- [ ] 3.2 修改 `electron-builder.cn.yml` 与 `electron-builder.global.yml` 的 `extraResources`，把 `resources/chaterm/main/**` 加入；macOS notarize 脚本（如有）覆盖新 binary
- [ ] 3.3 修改 `src/main/index.ts`：新增 `loadChatermMain()` 函数（dev `path.join(getResourcePath(), 'chaterm', 'main', 'index.js')`；prod `path.join(process.resourcesPath, 'chaterm', 'main', 'index.js')`），动态 `require()` 加载并解构 `mountChaterm`/`unmountChaterm`；失败时 `loggerService.withContext('main').error('chaterm.main.load.failed', err)` 并返回 `null`
- [ ] 3.4 把 `loadChatermMain()` 调用接到 `ChatermProcessService` 构造：`new ChatermProcessService({ bridge, mount: chatermMain?.mountChaterm, unmount: chatermMain?.unmountChaterm })`
- [ ] 3.5 单测 `src/main/services/__tests__/ChatermProcessService.test.ts` 补充：mount 函数缺失时 `attachWebview` 仍走 noop 不抛错；mount 失败时回滚 sender allowlist 与 webContents 引用

## 4. attachWebview 三步式握手

- [ ] 4.1 修改 `ChatermProcessService.attachWebview()`：把现有 `mount → registerAllowedSender` 顺序调整为 `mount → registerAllowedSender → send(IpcChannel.Raven_UI_SetSession, payload)`；payload 由新增的 `buildSessionPayload()` 函数构造，当前实现固定返回 `{ uid: 999999999, token: 'guest_token', isGuest: true, name: 'Guest' }`（未来 Raven 接入账号体系后替换数据源）
- [ ] 4.2 修改 `ChatermProcessService.detachWebview()`：反向执行（unregisterAllowedSender → unmountChaterm）；用 `try/catch` 包裹每一步，单步抛错被 logger.warn 后继续后续步骤
- [ ] 4.3 在 `@shared/IpcChannel` 新增常量 `Raven_UI_SetSession = 'raven:ui:set-session'`
- [ ] 4.4 `attachWebview` 中途失败的回滚单测：mock `bridge.registerAllowedSender` 抛错 → 验证 `unmount` 被调用、`chatermWebContents` 被清空、`chatermWebviewId` 被清空

## 5. Chaterm 渲染层接收 Raven session

- [ ] 5.1 修改 `third_party/ChatermForRaven/src/preload/raven-embedded.ts`：在 `RavenUIApi` 加 `onSession(listener: (payload) => void): () => void`，监听 `IpcRenderer` 上的 `raven:ui:set-session` 事件
- [ ] 5.2 修改 `src/renderer/src/main.ts`：在 Vue mount 前订阅 `window.ravenUI.onSession`，收到 payload 后写入 localStorage（`login-skipped` / `ctm-token` / `userInfo`），并设置全局 `__ravenSessionReady = true`
- [ ] 5.3 修改 `src/renderer/src/router/guards.ts`：移除嵌入态硬编码 guest 短路；嵌入模式下 `beforeEach` 等待 `__ravenSessionReady`（轮询或 Promise.race(timeout=3000)）后再继续；超时 fallback 到 guest 模式（保持热修等价行为）并 `logger.error('raven.session.handoff.timeout')`
- [ ] 5.4 单测 `guards.test.ts`：(a) 收到 session 后正常进入 `/`；(b) 3 秒超时后 fallback 到 guest；(c) 非嵌入模式不受影响

## 6. 加载完成事件 spec 化（固化热修）

- [ ] 6.1 `src/renderer/src/components/app/ChatermWebviewHost.tsx`：把当前热修的 `dom-ready` + `did-finish-load` whichever-first 逻辑加单测（mock webview event emitter）
- [ ] 6.2 单测：dom-ready 先到 → markLoaded('dom-ready') 触发 + attachWebview 调用一次
- [ ] 6.3 单测：did-finish-load 先到 → markLoaded('did-finish-load') 触发 + attachWebview 调用一次
- [ ] 6.4 单测：两个事件都到 → attachWebview 仅调用一次（attached guard 生效）

## 7. 集成验证

- [ ] 7.1 本地 `yarn build:chaterm && yarn dev`：进 `/terminal` 主界面直接渲染（无登录页、无 loading 卡死）
- [ ] 7.2 在 Raven DevTools console 中跑 `document.querySelector('webview').openDevTools()`，验证 Chaterm 渲染层 console 无 `No handler registered for` 报错
- [ ] 7.3 在 Chaterm UI 中：(a) 新增一个 SSH 资产（localhost / sshd-test）；(b) 连接并执行 `echo hello`；(c) 关闭页签切回，会话保活
- [ ] 7.4 Playwright e2e（`src/tests/e2e/terminal.spec.ts`，若已存在则补 scenario，否则新增）：进 `/terminal` → 验证 webview 渲染完成 → 验证 ipc 桥 ready → 验证模拟 SSH echo 回环
- [ ] 7.5 崩溃恢复手动测试：在 webview devtools 中跑 `process.crash()`，观察 Raven 显示崩溃占位 → 点击 Reload → 重新加载成功，handler 注册无重复

## 8. 清理与发布

- [ ] 8.1 撤销 `third_party/ChatermForRaven/src/renderer/src/router/guards.ts` 顶部的硬编码 guest 短路（§5.3 已用 session handoff 替代）
- [ ] 8.2 `yarn typecheck && yarn lint && yarn test`：Raven 与 Chaterm 子模块各自的检查全部通过
- [ ] 8.3 Chaterm 子模块在 `raven-embed/wire-main-runtime` 提交，rebase 到 `raven-embed` 并合并；Raven 主仓更新子模块指针
- [ ] 8.4 在 PR 描述中链接 [openspec/changes/wire-chaterm-embedded-runtime/proposal.md](openspec/changes/wire-chaterm-embedded-runtime/proposal.md) 与 design.md；附"用户视角验收清单"截图（进 /terminal → 主界面 → 建立 SSH → echo）
- [ ] 8.5 PR 合并后运行 `openspec archive wire-chaterm-embedded-runtime`，把变更归档到 `openspec/changes/archive/`
