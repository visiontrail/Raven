## Context

`embed-chaterm-ssh-tab`（已归档）落地了 Terminal 标签骨架——侧栏入口、`<webview>` 容器、`raven-chaterm://` 协议、`RavenLLMBridgeService`、`ChatermProcessService`、`<chaterm>` preload —— 在"渲染层桥接 + LLM 调用复用"层面已经能跑通。但运行时检查暴露了一处大缺口：

- [src/main/index.ts:111](src/main/index.ts:111) 创建 `ChatermProcessService` 没有提供 `mount`/`unmount`，构造时 fallback 到 `noopMount`；
- Chaterm 子模块的所有主进程 IPC handler 注册（`init-user-database`、`asset-route-local-*`、`ssh:*`、`chaterm:*`、`db:kv:*`、Agent / DB-AI / 加密 / 自动补全 / TTS / 快捷键 / SFTP / PTY …）全部写在 `src/main/index.ts` 的 `app.whenReady().then(...)` 内，而该 block 整段被 `if (!isChatermEmbedded())` 包围 —— 嵌入模式下一个 handler 都不会注册。

结果就是：嵌入态 Chaterm 渲染层一旦调到 `window.api.*`，全部回 `Error: No handler registered for '<channel>'`：
- 路由守卫 `initUserDatabase` 失败 → 上次不得不在 [guards.ts:29](third_party/ChatermForRaven/src/renderer/src/router/guards.ts:29) 加临时短路绕过登录；
- `window.onload` 因为某些 pending IPC 永远不返回而不派发 → 不得不在 [ChatermWebviewHost.tsx](src/renderer/src/components/app/ChatermWebviewHost.tsx) 加 `dom-ready` 兜底；
- 进首页后 SSH 连接、PTY、聊天历史、`kvGet/kvSet`、Agent loop 一律不工作。

本设计的目标：让 Chaterm 主进程的 IPC 注册层在嵌入模式下"被托管运行"，使得 Chaterm 渲染层在 Raven 进程内的行为与独立运行时**功能等价**——但生命周期、窗口、单实例等"主进程级别状态"仍由 Raven 拥有。

**关键约束：**
- Raven 与 Chaterm 必须共享一个 Electron 主进程（已对齐到 Electron 41.3.0）；Chaterm 主进程代码以**库**的形式被 Raven `import()`，而不是另开 Electron 实例。
- Chaterm 子模块上游会持续迭代，本变更对 Chaterm 的改动 SHOULD 保持"上游兼容"——抽取的 `bootstrap.ts` 在独立和嵌入模式下复用，避免 fork divergence。
- 生命周期：webview 可能多次 mount/unmount（用户在设置中切换 `terminal.enabled`、渲染进程崩溃后重建），所有 IPC handler 注册 MUST 幂等可逆。
- 安全：Chaterm 主进程 IPC handler 必须只接受来自 Chaterm webview 的 `event.sender.id`，不能被 Raven 主窗口或其它 webview 调用。

## Goals / Non-Goals

**Goals:**
- 嵌入模式下进 `/terminal` 能直接看到 Chaterm 终端主界面（非登录页），使用本地 guest workspace，不要求 Chaterm 登录。
- Chaterm 渲染层调用的所有 `window.api.*` 在 Raven 主进程内有真实 handler 响应（DB / SSH / PTY / SFTP / KV / Agent / 加密 / 快捷键 / TTS / 自动补全）。
- Chaterm Agent 通过 Raven LLM 桥复用 Raven 模型配置，并能通过 Chaterm 既有 `execute_command` / remote-terminal / SSH 通道控制远程主机 terminal。
- `mountChaterm` / `unmountChaterm` 幂等：可被同一 webContentsId 多次调用；崩溃恢复或 `terminal.enabled` 切换不会留下"幽灵 handler"。
- 动态 import 失败（产物缺失、ABI 不匹配、子模块异常）时 Raven 启动**不被阻断**，Terminal 标签降级为"不可用"提示。
- Chaterm webview 在主进程 `mount` 完成后才导航到真实 Chaterm URL，避免 `initUserDatabase` / SSH / Agent IPC 早于 handler 注册。

**Non-Goals:**
- Chaterm 账号体系与 Raven 账号体系的整合；嵌入模式固定 guest/local workspace。
- Chaterm 数据同步（云端备份）在嵌入模式下启用——本变更继续保持禁用。
- 多 webview 实例 / 多 Terminal 标签同时运行（仍是单实例，与 `embed-chaterm-ssh-tab` 一致）。
- Linux/Windows 单实例 / 协议处理 / 自动更新——这些是独立运行才需要，嵌入模式继续短路。
- Chaterm 主进程到 Raven 渲染层的直接 IPC（仍保持 Chaterm 主 → Chaterm 渲染 = `chaterm:*` 命名空间）。
- 把 Chaterm 的 SSH 工具暴露给 Raven Chat 页或 Raven Agent；本次目标是 Chaterm 自己的 Agent 控制 Chaterm 内的 SSH terminal。

## Decisions

### D1: 抽出 `bootstrap.ts`，让独立模式与嵌入模式共用同一段 IPC 注册逻辑

**选择：** 在 Chaterm 子模块新建 `src/main/embedded/bootstrap.ts`，把现 `src/main/index.ts:app.whenReady` 内**与 BrowserWindow / 单实例 / autoUpdater 无关**的代码（IPC handler 注册、DB 单例初始化、`envelopeEncryptionService.setAuthInfo` 入口、Agent / DB-AI 桥接初始化等）按模块拆成形如：

```ts
export interface BootstrapDisposer { (): Promise<void> | void }

export interface BootstrapResult {
  disposers: BootstrapDisposer[]
  // 进一步细分：senderValidatedDisposers 仅嵌入模式生效
}

export async function bootstrapChatermMain(opts: {
  mode: 'standalone' | 'embedded'
  validateSender?: (event: Electron.IpcMainInvokeEvent) => boolean
}): Promise<BootstrapResult>
```

`src/main/index.ts` 的 `app.whenReady` 改为：
```ts
if (!isChatermEmbedded()) {
  app.whenReady().then(async () => {
    /* 仅独立模式需要：窗口创建、托盘、autoUpdater、单实例… */
    await bootstrapChatermMain({ mode: 'standalone' })
  })
}
```

`embedded.ts` 的 `mountChaterm` 改为：
```ts
mountState.bootstrapResult = await bootstrapChatermMain({
  mode: 'embedded',
  validateSender: (ev) => ev.sender.id === options.webContentsId
})
```

**理由：**
- 单一事实源——上游 Chaterm 迭代时新增的 IPC handler 自动惠及嵌入模式；
- `validateSender` 注入点统一在 `bootstrap.ts` 包一层 `ipcMain.handle` 实现 sender 校验，独立模式传 `undefined` 表示放行；
- 拆函数的成本可控（IPC 注册是纯顺序代码，没有窗口耦合）。

**替代方案：**
- (A) 在 `embedded.ts` 里复制粘贴一份 IPC 注册——拒绝，divergence 风险高，上游升级噩梦。
- (B) 整体 `require('./index')` 让 Chaterm 主进程模块自加载，再做猴补丁——拒绝，副作用不可控（会触发 `app.whenReady` 链式注册，破坏单实例 lock 假设）。

### D2: blank-first attach — `about:blank → mount → registerAllowedSender → navigate`

**选择：** `ChatermWebviewHost` 首次进入 `/terminal` 时先创建 `src="about:blank"` 的 webview，拿到 guest `webContentsId` 后立刻调用 `window.api.chaterm.attachWebview(id)`；`attachWebview()` 成功后，Host 再把同一个 webview 导航到 `raven-chaterm://app/index.html`。

`ChatermProcessService.attachWebview` 内部顺序固定为：

1. `await this.mount({ webContentsId, llmClient, signals })` — 调用 Chaterm `mountChaterm()`，完成 `bootstrap` 注册所有 `chaterm:*` / `db:*` / `ssh:*` 等 handler，注册的 handler 内部以 `webContentsId` 严格校验 `event.sender.id`；
2. `this.bridge.registerAllowedSender(webContentsId)` — 把 webview 加入 `raven:llm:*` 桥的 allowlist；
3. 返回给 Host；Host 才导航到 Chaterm URL。

**理由：**
- 当前实现等 `dom-ready` 后再 attach，太晚了：`dom-ready` 只说明文档已解析，Chaterm preload / router guard / store 初始化可能已经调用过 `window.api.*` 并卡在 `No handler registered`。
- blank-first 让 Chaterm 的真实 SPA 在 handler 与 allowlist 都就绪后才开始执行；这比在 Chaterm 侧给每个 `window.api` 调用做队列更小、更可控。
- 顺序 1 → 2：handler 在 sender allowlist 之前注册，但每个 handler 自己也 `validateSender(event)`，避免 TOCTOU（即便 attacker 拿到 webview ref，未进入 allowlist 的 sender 也被 handler 内层拒绝）。
- `unmount` 时严格逆序：先 `unregisterAllowedSender`，最后 `unmountChaterm` 撤销所有 disposer。

**替代方案：**
- 把 `mount` 与 `registerAllowedSender` 合并为单步（mount 内部自己注册）——拒绝，allowlist 是 Raven 的资产，Chaterm 不应反向操作 Raven 桥。
- 继续在 `dom-ready` / `did-finish-load` 后 attach——拒绝，它只能解决 Raven 的视觉遮罩，不能保证 Chaterm 内部 IPC 已经可用。

### D3: Raven 主进程动态 import Chaterm 主 bundle

**选择：** 在 [src/main/index.ts](src/main/index.ts) 的 `app.whenReady` 里：

```ts
async function loadChatermMain(): Promise<{
  mountChaterm: ChatermMountFn
  unmountChaterm: ChatermUnmountFn
} | null> {
  try {
    const entry = app.isPackaged
      ? path.join(process.resourcesPath, 'chaterm', 'main', 'index.js')
      : path.join(getResourcePath(), 'chaterm', 'main', 'index.js')
    if (!existsSync(entry)) return null
    // CJS dynamic require to avoid esm/cjs interop issues in main bundle
    const mod = require(/* webpackIgnore: true */ entry)
    return { mountChaterm: mod.mountChaterm, unmountChaterm: mod.unmountChaterm }
  } catch (err) {
    logger.error('Failed to load Chaterm main bundle', err as Error)
    return null
  }
}

const chatermMain = await loadChatermMain()
const chatermProcessService = new ChatermProcessService({
  bridge: ravenLLMBridgeService,
  mount: chatermMain?.mountChaterm,
  unmount: chatermMain?.unmountChaterm
})
```

**理由：**
- 动态 `require` 避开 electron-vite 的 main bundle 把 Chaterm 主代码静态吸进来——Chaterm 主有 6k+ 行 + 一票 native 依赖，静态打包既慢又破坏 ABI 隔离；
- 失败时返回 `null` 让 `ChatermProcessService` fallback 到 `noopMount`，Raven 启动不被阻塞；
- `existsSync` 守门避开 packaged build 缺资源的硬崩。

**替代方案：**
- 静态 `import { mountChaterm } from '../../third_party/ChatermForRaven/src/main/embedded'`——拒绝，会拉入 6k+ 行 dev-only TS，破坏 production bundle 大小与启动时间；且 prod 路径无法解析子模块源码。

### D4: 嵌入模式固定 guest/local workspace，不做 Raven session handoff

**选择：** 保留"嵌入模式无需登录"的产品方向，但撤销 [third_party/ChatermForRaven/src/renderer/src/router/guards.ts:29-43](third_party/ChatermForRaven/src/renderer/src/router/guards.ts:29) 的"嵌入态直接 `next()`"短路。新的 guard 行为是：

- 若 `isChatermEmbedded()` 为 true，先确保 localStorage 中有 upstream guest 字段：`login-skipped=true`、`ctm-token=guest_token`、`userInfo.uid=999999999`；
- 不显示 `/login`，访问 `/login` 时重定向到 `/`；
- 继续走 upstream guest 分支，调用 `window.api.initUserDatabase({ uid: 999999999 })`，让 sqlite / KV / chat history / asset store 真正初始化；
- 如果 `initUserDatabase` 失败，显示 Terminal 不可用/初始化失败占位并写 `error` 日志，而不是静默进入一个没有 DB/SSH handler 的空壳界面。

**理由：**
- 用户目标是"AI 控制 SSH 远程 terminal"，登录/账号同步不是必要路径；
- guest 是 Chaterm 上游已经支持的本地使用模式，最少改动且能保留 DB 初始化；
- Raven 目前没有要下发给 Chaterm 的稳定账号体系，过早引入 `raven:ui:set-session` 会增加 handshake、超时、账号切换等复杂度，但对当前目标没有收益。

**未来扩展：** 如果 Raven 后续有明确账号体系，再单独做 "Raven → Chaterm session handoff" change，把 guest uid 替换为 Raven 下发 uid；当前变更不预留阻塞式 session 事件。

### D5: 加载完成事件：`dom-ready` 优先，`did-finish-load` 兜底

**选择：** [ChatermWebviewHost.tsx](src/renderer/src/components/app/ChatermWebviewHost.tsx) 中两个事件任一触发即视为已加载（首次触发胜出），保持 `did-fail-load`（非 ERR_ABORTED）→ crashed 的现有处理。该判定只控制 overlay，不再触发 `attachWebview()`；attach/mount 已在 D2 的 blank-first 阶段完成。

**理由：**
- 当前热修已验证 `dom-ready` 在嵌入态下稳定触发，而 `did-finish-load` 因为某些异步资源（lazy chunk / pending IPC）一直 pending；
- 即使后续 D2/D4 让 IPC 都能回，仍保留 `dom-ready` 兜底是稳健做法——嵌入态 SPA 的 `window.onload` 时机本身就更难预测。

### D6: Agent 控制 SSH 的验收边界

**选择：** 本变更的"AI 控制 terminal"只使用 Chaterm 自己已经存在的 Agent runtime 与 terminal/SSH 工具链：

```
Raven AiProvider
  → raven:llm:* bridge
  → Chaterm RavenBridgeHandler
  → Chaterm Agent tool_use XML
  → execute_command
  → remote-terminal / ssh agentHandle
  → remote SSH shell
```

不新增 Raven Chat 页到 Chaterm SSH 的工具入口，也不把 Chaterm SSH 能力注册成 Raven MCP tool。

**验收：** 连接 mock/localhost SSH 后，让 Chaterm Agent 收到一个会产生 `execute_command` 工具调用的任务，断言远端终端执行了 `echo raven-ai-control` 并把输出回传给 Agent。

**理由：**
- 这正好满足当前产品目标：在 Terminal 标签内，AI 能控制远程 SSH terminal；
- 避免把作用域扩展到 Raven Agent / MCP / Chat 页工具授权，后者需要单独的安全与权限设计。

### D7: 构建产物布局与拷贝

**选择：** Chaterm `electron.vite.config.ts` 的 main 输出 chunked 到 `out/main/index.js`（含 sourcemap）；`scripts/build-chaterm.js` 新增步骤把 `out/main/**` 整体 `copyDir` 到 `resources/chaterm/main/`。`electron-builder.*.yml` 的 `extraResources` 增加 `resources/chaterm/main/**`。

**native 依赖：** `node-pty` / `better-sqlite3` / `ssh2` / `@xterm/headless` 等 Chaterm 主进程使用的 native 模块由 Chaterm 子模块 `npm install` 安装并 rebuild 到 Electron 41 ABI；产物在 `out/main/` 中以 commonjs require 它们。Raven 主 bundle 不直接 import 这些 native 模块，避免 ABI 冲突。

**Dev 路径：** dev 模式 `app.isPackaged === false`，从 `getResourcePath()/chaterm/main/index.js` 加载，与 prod 一致——避免 dev/prod 分叉。

## Risks / Trade-offs

- **[原生模块 ABI 漂移]** Chaterm 的 native 模块（better-sqlite3 / node-pty / ssh2）必须用 Raven 同版本的 Electron headers rebuild → **Mitigation:** `scripts/build-chaterm.js` 增加 `electron-rebuild` 步骤或在 CI 上强制 `npm rebuild` 校验；build 失败立即报错而不是产出运行期崩溃的产物。
- **[Chaterm 上游升级带来的 bootstrap.ts 跟随成本]** 上游每加一个新 ipcMain.handle，bootstrap.ts 都要 mirror → **Mitigation:** 把 bootstrap.ts 写成"模块注册器"模式，每个子系统（DB / SSH / Agent…）一个 `registerXxx(opts): Disposer[]`；新增功能只需追加一个 register 函数。配套写一个 lint/test：扫描 `src/main/index.ts` 中所有 `ipcMain.handle` 调用是否都通过 bootstrap 间接注册（避免遗漏）。
- **[IPC handler 注册 race]** 渲染层 SPA 一加载就触发 `initUserDatabase`，如果 `mount` 还没完成 handler 就被调用 → 返回 "No handler" → **Mitigation:** D2 blank-first：先创建 `about:blank` webview、完成 `attachWebview()` / `mountChaterm()` / `registerAllowedSender()`，成功后才导航到 `raven-chaterm://app/index.html`。
- **[渲染进程崩溃后 handler 残留]** webview crash 后如果 `unmount` 失败，handler 留在 ipcMain 中后续 attach 注册 → 抛 `Attempted to register a second handler` → **Mitigation:** bootstrap.ts 内部所有 `ipcMain.handle` 用 `ipcMain.removeHandler(channel); ipcMain.handle(channel, ...)` 包一层，幂等可重入；unmount 反向 `removeHandler`。
- **[guest DB 初始化失败]** 如果 bootstrap 遗漏 `init-user-database` 或 sqlite native 模块异常，guard 会回到登录页或空界面 → **Mitigation:** 嵌入模式把 `/login` 固定重定向为初始化失败占位；写 `chaterm.guest.init.failed` 日志，提示查看日志，而不是让用户误以为需要登录。

## Migration Plan

1. **阶段 0（已完成）：** [ChatermWebviewHost.tsx](src/renderer/src/components/app/ChatermWebviewHost.tsx) 的 `dom-ready` 兜底、[guards.ts:29-43](third_party/ChatermForRaven/src/renderer/src/router/guards.ts:29) 的临时 guest 短路均已合入并验证 Terminal 标签可见。
2. **阶段 1（本变更 §1-§3）：** Chaterm 子模块抽 bootstrap.ts；`embedded.ts` 接 bootstrap；保留 guards.ts 临时短路不动。Chaterm 单元测试覆盖 mount/unmount 幂等。
3. **阶段 2（本变更 §4）：** Raven 主 dynamic-import Chaterm 主 bundle，`ChatermProcessService` 接入 mountChaterm；`attachWebview` 改为 `mount → registerAllowedSender`，并确保 Chaterm `mountChaterm()` 不反向操作 Raven allowlist。
4. **阶段 3（本变更 §5）：** `ChatermWebviewHost` 改为 blank-first attach：`about:blank` webview attach 成功后才导航到 Chaterm URL；`dom-ready` 仅隐藏 overlay。
5. **阶段 4（本变更 §6）：** guards.ts 撤销嵌入态直接 `next()`，改为自动 guest localStorage + 正常调用 `initUserDatabase`；失败显示初始化失败占位。
6. **阶段 5（本变更 §7）：** 构建脚本与 electron-builder 拷贝 Chaterm 主 bundle；macOS notarize、Windows code sign 覆盖新增产物。
7. **阶段 6（本变更 §8）：** Playwright 集成测试覆盖"进 /terminal → 主界面 → 建立 localhost SSH → Chaterm Agent 执行 `echo raven-ai-control` → 切走切回保活"。

**回滚：** 如果阶段 2/3 落地后出现严重回归，可单步回滚 [src/main/index.ts](src/main/index.ts) 的 dynamic-import 代码——`ChatermProcessService` fallback 到 `noopMount`，guards.ts 临时短路仍保留，Terminal 退化到"能开但 SSH 不可用"的当前状态，不影响 Raven 其它能力。

### D8: sqlite 数据不按 Raven 账号分区

**选择：** Chaterm `better-sqlite3` 数据库文件继续落在 `app.getPath('userData')/chaterm_db/<uid>/`，`<uid>` 当前固定为 guest `999999999`；未来 Raven 有账号体系时再通过单独 change 替换为 Raven 下发 uid。

**理由：**
- 复用 Chaterm 上游已有的目录约定，不引入"Raven uid → Chaterm uid"映射表；
- 当前 Raven 没有账号体系，多账号场景不存在，分区是过度设计；
- 即使未来 Raven 接入账号，Chaterm 仍按其内部 uid 分区即可，跨 Raven 用户的隔离由 `userData` 这一层（操作系统用户级别）自然完成。

### D9: 嵌入模式下 guest 初始化失败要可见

**选择：** 嵌入模式自动 guest 初始化失败时（例如 `initUserDatabase` 抛错、sqlite native 模块加载失败、bootstrap 遗漏 handler）：
1. Chaterm guard MUST 停在一个初始化失败状态，不跳转到登录页；
2. Chaterm 渲染层通过 `raven:ui:host-warn` 通知 Raven 主窗口显示 warning toast（"Terminal 初始化失败 — 查看日志"）；
3. Raven 主进程与 Chaterm 渲染层双侧都打 `error` 日志（`chaterm.guest.init.failed` / `raven.chaterm.host_warn`）。

**理由（best practice rationale）：**
- 登录页会误导用户，以为需要 Chaterm 账号；初始化失败占位能直接指出是嵌入运行时问题。
- toast 提示比错误页更轻量；用户能继续使用 Raven 其它功能，开发能从日志定位问题。
- 这保留了"登录不需要"的产品判断，同时避免 silent degradation 掩盖 handler/ABI 问题。

### D10: 嵌入模式下禁用 Chaterm 自有的 `before-quit` 监听

**选择：** 把 [third_party/ChatermForRaven/src/main/index.ts:623](third_party/ChatermForRaven/src/main/index.ts:623) 的 `app.on('before-quit', ...)` 整段用 `if (!isChatermEmbedded())` 包围；嵌入模式下退出清理 100% 由 Raven 的 `ChatermProcessService.destroy()` → `unmountChaterm()` 驱动。

**理由（best practice rationale）：**
- 单一职责：在嵌入模式下，Raven 是 Electron 主进程的真正持有者，应用生命周期事件（`before-quit` / `window-all-closed` / `will-quit`）只能由它接管；Chaterm 作为被托管的"库"不应监听这些事件，否则会出现：
  - **双重清理 race**：Raven 的 `unmountChaterm()` 已经在拆 SSH/sqlite，同一时刻 Chaterm 自己的 `before-quit` 又开始清理 → 同一资源 double-close。
  - **顺序错乱**：Chaterm `before-quit` 与 Raven `before-quit` 的注册顺序决定执行顺序，但 Raven 主仓与子模块独立演化，顺序不稳定。
  - **未注册副作用泄漏**：Chaterm `before-quit` 内部可能调用了未在嵌入模式下挂载的服务（如 autoUpdater 的 shutdown hook）。
- 类似 grep 命中的 `window-all-closed`（line 615 已正确包在 `if (!isChatermEmbedded())` 内）、`open-url`（line 3350 同样）、`second-instance`（line 3150 / 3315 同样）——`before-quit` 是 Chaterm 上游引入嵌入支持时的遗漏，本变更顺手修掉。
- 实现成本几乎为零：单行 `if` 包裹。
