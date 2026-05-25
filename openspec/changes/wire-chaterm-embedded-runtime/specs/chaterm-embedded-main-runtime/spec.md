## ADDED Requirements

### Requirement: Chaterm Main IPC Bootstrap in Embedded Mode

在嵌入模式下，Chaterm 主进程必备的 IPC handler（含但不限于 DB / 加密 / Agent / DB-AI / SSH / SFTP / PTY / KV / 文件 / 自动补全 / 快捷键 / TTS）MUST 由 Raven 主进程调用 `mountChaterm()` 时统一注册；标准（非嵌入）模式下相同的注册逻辑 SHALL 由 Chaterm 自有的 `app.whenReady` 复用调用，二者共享同一个 `bootstrap*` 实现（避免分叉）。

注册过程 MUST 满足：

- 幂等：对同一个 webContentsId 多次调用 `mountChaterm()` MUST NOT 抛 `Attempted to register a second handler`；内部以 `ipcMain.removeHandler(channel)` + `ipcMain.handle(channel, ...)` 包裹。
- 全量可逆：`unmountChaterm()` MUST 撤销 `mountChaterm()` 注册过的所有 handler 与定时器/连接池；`mount` 后状态与 `mount` 前状态在 `ipcMain` 视角下相同。
- 不依赖 BrowserWindow / 单实例 lock / autoUpdater 等独立模式专属副作用；嵌入模式下 Chaterm 既无自有窗口也不参与 `second-instance` 分发。

#### Scenario: 用户首次进入 /terminal

- **WHEN** 用户首次进入 `/terminal`，Raven `ChatermProcessService.attachWebview()` 完成 `mountChaterm()` 调用
- **THEN** Chaterm 渲染层后续调用的 `window.api.initUserDatabase` / `window.api.kvGet` / `window.api.chaterm.*` 等 IPC MUST 收到真实响应（不再是 `Error: No handler registered for '<channel>'`）

#### Scenario: 渲染进程崩溃后重建

- **WHEN** Chaterm webview 渲染进程崩溃，用户点击"重新加载"按钮
- **THEN** Raven MUST 先调用 `unmountChaterm()` 撤销旧 handler，再调用 `mountChaterm()` 以新 webContentsId 重新注册；过程中 MUST NOT 因 handler 残留而抛错

#### Scenario: 用户在设置中关闭 terminal.enabled

- **WHEN** 用户在 Raven 设置中把 `terminal.enabled` 关闭
- **THEN** `ChatermProcessService.detachWebview()` 立即调用 `unmountChaterm()`，所有 `chaterm:*` / `db:*` / `ssh:*` 等 handler MUST 从 `ipcMain` 中移除；后续若其它代码尝试调用对应 channel MUST 收到 `No handler registered`（非沉默丢弃）

#### Scenario: 应用退出

- **WHEN** Raven 进入 `before-quit`，`ChatermProcessService.destroy()` 被调用
- **THEN** `unmountChaterm()` MUST 在 3 秒超时内完成清理；超时时打 `error` 日志并强制 teardown；任何 SSH 连接 / sqlite handle / pty 进程 MUST 被回收

---

### Requirement: Chaterm IPC Sender Validation

`mountChaterm()` 注册的所有 `chaterm:*` / `db:*` / `ssh:*` 等"Chaterm 内部"IPC handler MUST 在 invoke 入口校验 `event.sender.id` 等于当次 `mountChaterm` 持有的 webContentsId；不等时 MUST 立刻 reject 返回 `E_CHATERM_IPC_FORBIDDEN`，且不进入业务逻辑。

校验函数 SHALL 由 `bootstrapChatermMain({ validateSender })` 选项注入；嵌入模式下传入实际校验函数，独立模式下可传 `undefined`（放行所有 sender，行为与上游一致）。

#### Scenario: 合法 sender 调用

- **WHEN** Chaterm webview（其 `webContents.id` 与 `mountChaterm` 注册时一致）通过 `window.api.invokeChatermXxx` 调用 IPC
- **THEN** handler 正常执行业务逻辑并返回结果

#### Scenario: 非法 sender 试探

- **WHEN** Raven 主窗口 / 其它 webview / 通过 DevTools 注入的代码调用 `chaterm:*` channel
- **THEN** handler MUST 在进入业务逻辑前返回 `{ error: 'E_CHATERM_IPC_FORBIDDEN' }` 或 reject 同义错误；MUST NOT 触达 sqlite / ssh / pty 等真实资源

---

### Requirement: Raven → Chaterm Session Handoff

Raven SHALL 在 webview `mount` 成功后通过 `raven:ui:set-session` IPC 把当前用户身份下发给 Chaterm 渲染层；payload 至少包含 `{ uid: number, token: string, isGuest: boolean, name?: string }`。Chaterm 渲染层收到后 MUST 把字段写入 localStorage（沿用上游字段名 `ctm-token` / `userInfo` / `login-skipped`）并触发标准的 `initUserDatabase` 流程，**禁止**再依赖 `router/guards.ts` 中的硬编码 guest 短路。

Chaterm 渲染层在收到 session 前 MUST 阻塞所有需要用户身份的导航；超时 3 秒未收到 session 时 SHALL fallback 到 guest 模式（`isGuest: true, uid: 999999999`）并打 `error` 日志便于排查。

#### Scenario: 正常握手

- **WHEN** webview `did-attach-webview` 触发，`ChatermProcessService.attachWebview()` 完成 `mountChaterm()`
- **THEN** Raven MUST 在 500ms 内通过 `webContents.send(IpcChannel.Raven_UI_SetSession, payload)` 下发 session；Chaterm 渲染层收到后写入 localStorage 并 `router.replace('/')`，进入终端主界面

#### Scenario: 切换 Raven 账号

- **WHEN** Raven 主进程通知账号已切换（未来 Raven 接入账号体系后）
- **THEN** Raven MUST 通过 `raven:ui:set-session` 重新下发新 session；Chaterm 收到后 MUST 调用 `unmountChaterm` 等价的 reset（清 localStorage + 重新 `initUserDatabase`）

#### Scenario: 下发超时

- **WHEN** Chaterm 渲染层在挂载后 3 秒内未收到 `raven:ui:set-session`
- **THEN** guards.ts MUST fallback 到 guest 模式让用户进入主界面，同时 `console.error` 与 logger.error 记录 `raven.session.handoff.timeout`

---

### Requirement: Dynamic Loading & Graceful Degradation

Raven 主进程 MUST 通过动态 `require()` 加载 Chaterm 主 bundle（路径在 packaged 模式为 `process.resourcesPath/chaterm/main/index.js`，dev 模式为 `<projectRoot>/resources/chaterm/main/index.js`）；加载失败（文件缺失 / 抛错 / native 模块 ABI 不兼容）时 MUST：

- 打 `error` 级别日志 `chaterm.main.load.failed`，包含 `path` 与 `error.message`；
- 让 `ChatermProcessService` fallback 到 `noopMount/noopUnmount`，Raven 应用 MUST 继续正常启动；
- 渲染层 Terminal 标签 MUST 显示"Terminal 不可用"占位与"查看日志"链接。

#### Scenario: 包体完整启动

- **WHEN** `resources/chaterm/main/index.js` 存在且可正常 `require`
- **THEN** `ChatermProcessService` 使用真实 `mountChaterm` / `unmountChaterm`，Terminal 标签可正常打开

#### Scenario: 产物缺失启动

- **WHEN** `resources/chaterm/main/index.js` 不存在（用户跳过 `yarn build:chaterm`，或 packaged 产物损坏）
- **THEN** Raven 启动 MUST 不抛错；侧栏 Terminal 标签隐藏或显示"不可用"占位；日志中有 `chaterm.main.load.failed`

#### Scenario: 加载抛错

- **WHEN** `require(entry)` 抛 native 模块 ABI 不匹配错误
- **THEN** Raven 启动 MUST 不被阻断；fallback 到 noopMount；错误堆栈 MUST 完整记录到日志

---

### Requirement: Loading & Crash Overlay Semantics

`ChatermWebviewHost` 的加载完成判定 MUST 基于 `dom-ready` 与 `did-finish-load` 任一事件首次触发；遮罩 MUST 在该事件触发后立即隐藏。`did-fail-load` 事件（且 `errorCode !== -3`）MUST 触发 `crashed` 状态并显示"终端已崩溃 / 重新加载"按钮。

#### Scenario: dom-ready 先到

- **WHEN** webview 加载过程中 `dom-ready` 先于 `did-finish-load` 触发
- **THEN** 遮罩 MUST 立即隐藏；后续 `did-finish-load` 触发时 MUST NOT 重置 loadState 或重复 attach webview

#### Scenario: did-finish-load 先到

- **WHEN** webview 加载过程中 `did-finish-load` 先于 `dom-ready` 触发
- **THEN** 遮罩 MUST 立即隐藏；行为与"dom-ready 先到"等价

#### Scenario: 加载失败

- **WHEN** webview 触发 `did-fail-load`，`errorCode !== -3`（非 ERR_ABORTED）
- **THEN** loadState MUST 转为 `crashed`；Reload 按钮调用 `webview.reload()` 后 loadState MUST 回到 `loading`，事件循环重新计入
