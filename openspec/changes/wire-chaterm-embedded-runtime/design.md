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
- 嵌入模式下进 `/terminal` 能直接看到 Chaterm 终端主界面（非登录页），不需要 guards.ts 硬编码 guest。
- Chaterm 渲染层调用的所有 `window.api.*` 在 Raven 主进程内有真实 handler 响应（DB / SSH / PTY / SFTP / KV / Agent / 加密 / 快捷键 / TTS / 自动补全）。
- `mountChaterm` / `unmountChaterm` 幂等：可被同一 webContentsId 多次调用；崩溃恢复或 `terminal.enabled` 切换不会留下"幽灵 handler"。
- 动态 import 失败（产物缺失、ABI 不匹配、子模块异常）时 Raven 启动**不被阻断**，Terminal 标签降级为"不可用"提示。
- Raven → Chaterm 身份下发：Raven 通过 `raven:ui:set-session` 把当前用户身份（uid + token 或 guest）传给 Chaterm 渲染层，由 Chaterm 走标准 `initUserDatabase` 流程。

**Non-Goals:**
- Chaterm 账号体系与 Raven 账号体系的整合（仍用 guest，或由后续 change 处理）。
- Chaterm 数据同步（云端备份）在嵌入模式下启用——本变更继续保持禁用。
- 多 webview 实例 / 多 Terminal 标签同时运行（仍是单实例，与 `embed-chaterm-ssh-tab` 一致）。
- Linux/Windows 单实例 / 协议处理 / 自动更新——这些是独立运行才需要，嵌入模式继续短路。
- Chaterm 主进程到 Raven 渲染层的直接 IPC（仍保持 Chaterm 主 → Chaterm 渲染 = `chaterm:*` 命名空间）。

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

### D2: `attachWebview` 的三步式握手 — `mount → registerAllowedSender → set-session`

**选择：** 在 `ChatermProcessService.attachWebview` 中按如下顺序：

1. `await this.mount({ webContentsId, bridge, signals })` — 调用 Chaterm `mountChaterm()`，完成 `bootstrap` 注册所有 `chaterm:*` / `db:*` / `ssh:*` 等 handler，注册的 handler 内部以 `webContentsId` 严格校验 `event.sender.id`；
2. `this.bridge.registerAllowedSender(webContentsId)` — 把 webview 加入 `raven:llm:*` 桥的 allowlist；
3. `webContents.send(IpcChannel.Raven_UI_SetSession, sessionPayload)` — 把 Raven 当前账号身份（或 guest fallback）下发给 Chaterm 渲染层，由 Chaterm 内部走标准 `initUserDatabase` 流程（不再用 guards.ts 短路）。

**理由：**
- 顺序 1 → 2：handler 在 sender allowlist 之前注册，但每个 handler 自己也 `validateSender(event)`，避免 TOCTOU（即便 attacker 拿到 webview ref，未进入 allowlist 的 sender 也被 handler 内层拒绝）。
- 顺序 2 → 3：必须先把 webview 加入 `raven:llm:*` allowlist，再让 Chaterm 渲染层接收身份并触发 DB init —— `initUserDatabase` 后续可能链式调用 `raven:llm:listAvailableModels` 来预热模型列表，先放行再下发可以避免一次失败。
- `unmount` 时严格逆序：先 `webContents.send` 通知 Chaterm "session 失效"（可选），再 `unregisterAllowedSender`，最后 `unmountChaterm` 撤销所有 disposer。

**替代方案：**
- 把 `mount` 与 `registerAllowedSender` 合并为单步（mount 内部自己注册）——拒绝，allowlist 是 Raven 的资产，Chaterm 不应反向操作 Raven 桥。

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

### D4: 撤销 guards.ts 的硬编码 guest，改由 Raven 下发 session

**选择：** 把 [third_party/ChatermForRaven/src/renderer/src/router/guards.ts:29-43](third_party/ChatermForRaven/src/renderer/src/router/guards.ts:29) 的"嵌入态强制 guest"短路改回 upstream 逻辑；新增 `raven:ui:set-session` IPC：

- Raven 主进程在 `attachWebview` 完成后调用 `webContents.send(IpcChannel.Raven_UI_SetSession, { uid, token, name, isGuest })`；
- Chaterm preload 把该事件挂到 `window.ravenUI.onSession(listener)` 并在 `main.ts` 早期订阅；
- Chaterm 收到后写入 localStorage（沿用 upstream 字段 `ctm-token` / `userInfo` / `login-skipped`），然后调用 `router.replace('/')` 触发标准 `initUserDatabase` 流程。

**理由：**
- 嵌入模式下"我是谁"必须由 Raven 拍板（未来如果 Raven 有真正的账号体系，这条通道是现成的）；
- 不在 Chaterm 渲染层硬编码身份，guards.ts 回归上游行为，降低 fork divergence；
- 仍兼容 guest——Raven 当前没有账号系统时下发 `{ isGuest: true, uid: 999999999 }`，行为等价。

**当前 hotfix 的兼容性：** 在本变更落地前，guards.ts 的临时短路保留，避免回退到登录页；落地时一并撤销。

### D5: 加载完成事件：`dom-ready` 优先，`did-finish-load` 兜底

**选择：** [ChatermWebviewHost.tsx](src/renderer/src/components/app/ChatermWebviewHost.tsx) 中两个事件任一触发即视为已加载（首次触发胜出），保持 `did-fail-load`（非 ERR_ABORTED）→ crashed 的现有处理。

**理由：**
- 当前热修已验证 `dom-ready` 在嵌入态下稳定触发，而 `did-finish-load` 因为某些异步资源（lazy chunk / pending IPC）一直 pending；
- 即使后续 D3/D4 让 IPC 都能回，仍保留 `dom-ready` 兜底是稳健做法——嵌入态 SPA 的 `window.onload` 时机本身就更难预测。

### D6: 构建产物布局与拷贝

**选择：** Chaterm `electron.vite.config.ts` 的 main 输出 chunked 到 `out/main/index.js`（含 sourcemap）；`scripts/build-chaterm.js` 新增步骤把 `out/main/**` 整体 `copyDir` 到 `resources/chaterm/main/`。`electron-builder.*.yml` 的 `extraResources` 增加 `resources/chaterm/main/**`。

**native 依赖：** `node-pty` / `better-sqlite3` / `ssh2` / `@xterm/headless` 等 Chaterm 主进程使用的 native 模块由 Chaterm 子模块 `npm install` 安装并 rebuild 到 Electron 41 ABI；产物在 `out/main/` 中以 commonjs require 它们。Raven 主 bundle 不直接 import 这些 native 模块，避免 ABI 冲突。

**Dev 路径：** dev 模式 `app.isPackaged === false`，从 `getResourcePath()/chaterm/main/index.js` 加载，与 prod 一致——避免 dev/prod 分叉。

## Risks / Trade-offs

- **[原生模块 ABI 漂移]** Chaterm 的 native 模块（better-sqlite3 / node-pty / ssh2）必须用 Raven 同版本的 Electron headers rebuild → **Mitigation:** `scripts/build-chaterm.js` 增加 `electron-rebuild` 步骤或在 CI 上强制 `npm rebuild` 校验；build 失败立即报错而不是产出运行期崩溃的产物。
- **[Chaterm 上游升级带来的 bootstrap.ts 跟随成本]** 上游每加一个新 ipcMain.handle，bootstrap.ts 都要 mirror → **Mitigation:** 把 bootstrap.ts 写成"模块注册器"模式，每个子系统（DB / SSH / Agent…）一个 `registerXxx(opts): Disposer[]`；新增功能只需追加一个 register 函数。配套写一个 lint/test：扫描 `src/main/index.ts` 中所有 `ipcMain.handle` 调用是否都通过 bootstrap 间接注册（避免遗漏）。
- **[IPC handler 注册 race]** 渲染层 SPA 一加载就触发 `initUserDatabase`，如果 `mount` 还没完成 handler 就被调用 → 返回 "No handler" → **Mitigation:** D2 顺序锁死："`mount` 完成才 attach webview 给渲染层"（在 webview 的 `did-attach-webview` 之后才 send `set-session`，渲染层在收到 session 前不调用任何 `window.api.*`，由 guards.ts 阻塞）。
- **[渲染进程崩溃后 handler 残留]** webview crash 后如果 `unmount` 失败，handler 留在 ipcMain 中后续 attach 注册 → 抛 `Attempted to register a second handler` → **Mitigation:** bootstrap.ts 内部所有 `ipcMain.handle` 用 `ipcMain.removeHandler(channel); ipcMain.handle(channel, ...)` 包一层，幂等可重入；unmount 反向 `removeHandler`。
- **[guards.ts 撤销时机]** 如果 `raven:ui:set-session` 未到达（Raven 主进程 bug 或 IPC 丢包），guards.ts 会一直把用户卡在 /login → **Mitigation:** guards.ts 在嵌入模式下加一个 3s 超时——超时仍未收到 session 时，fallback 到 guest 模式（保持现热修等价行为）并打 `error` 日志便于排查。

## Migration Plan

1. **阶段 0（已完成）：** [ChatermWebviewHost.tsx](src/renderer/src/components/app/ChatermWebviewHost.tsx) 的 `dom-ready` 兜底、[guards.ts:29-43](third_party/ChatermForRaven/src/renderer/src/router/guards.ts:29) 的临时 guest 短路均已合入并验证 Terminal 标签可见。
2. **阶段 1（本变更 §1-§3）：** Chaterm 子模块抽 bootstrap.ts；`embedded.ts` 接 bootstrap；保留 guards.ts 临时短路不动。Chaterm 单元测试覆盖 mount/unmount 幂等。
3. **阶段 2（本变更 §4-§5）：** Raven 主 dynamic-import Chaterm 主 bundle，`ChatermProcessService` 接入 mountChaterm；attachWebview 三步式握手。Raven 单元测试覆盖动态 import 失败降级。
4. **阶段 3（本变更 §6）：** 新增 `raven:ui:set-session` IPC 与 Chaterm 端订阅；guards.ts 撤销硬编码 guest 改为等 session 事件（带 3s 超时 fallback）。
5. **阶段 4（本变更 §7）：** 构建脚本与 electron-builder 拷贝 Chaterm 主 bundle；macOS notarize、Windows code sign 覆盖新增产物。
6. **阶段 5（本变更 §8）：** Playwright 集成测试覆盖"进 /terminal → 看到主界面 → 建立 localhost SSH → echo 回环 → 切走切回保活"。

**回滚：** 如果阶段 2/3 落地后出现严重回归，可单步回滚 [src/main/index.ts](src/main/index.ts) 的 dynamic-import 代码——`ChatermProcessService` fallback 到 `noopMount`，guards.ts 临时短路仍保留，Terminal 退化到"能开但 SSH 不可用"的当前状态，不影响 Raven 其它能力。

## Open Questions

- **Q1：** Chaterm `better-sqlite3` 持久化的数据库文件在嵌入模式下落在 `app.getPath('userData')/chaterm_db/`（同 Raven `userData`），是否需要按 Raven 账号分区？本变更暂不分区（沿用 Chaterm 的 `uid/` 子目录策略），但需要在 design 阶段对齐。
- **Q2：** `raven:ui:set-session` 的失败兜底——3s 超时回退到 guest 是否会被业务方接受？或应改为"显示错误页 + 重试按钮"？本变更默认前者，可在 review 中调整。
- **Q3：** Chaterm `app.on('before-quit')` 中的 SSH 连接清理（[src/main/index.ts:623](third_party/ChatermForRaven/src/main/index.ts:623)）在嵌入模式下也需要执行，但 Chaterm 的 `before-quit` 监听在嵌入模式下是否还会被注册（看 grep 输出该监听器**不在** `if (!isChatermEmbedded())` 块内，应该会被注册）？需要在 §1 抽 bootstrap 时一并核对，避免 SSH 残留。
