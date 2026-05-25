## MODIFIED Requirements

### Requirement: Embedded Webview Container

`TerminalPage` SHALL 使用 Electron `<webview>` 标签作为 Chaterm 渲染层的容器，并 MUST 满足：

- `src` 指向 Raven 注册的本地协议 URL（如 `raven-chaterm://app/index.html`），不允许加载远程 URL
- `preload` 指向 Chaterm 专用 preload（独立于 Raven 主 preload）
- `nodeintegration` MUST 关闭；`contextIsolation` MUST 开启
- webview 进程 SHALL 与 Raven 主渲染进程隔离，崩溃不影响 Raven 主窗口
- 容器 SHALL 在标签首次打开时懒加载，并在用户切走标签时保持后台运行（不销毁），以保留 SSH 会话；只有显式关闭/路由禁用时才销毁
- 加载完成判定 MUST 基于 webview 的 `dom-ready` 与 `did-finish-load` 两个事件**首次触发胜出**（whichever-first）：嵌入态下 `did-finish-load` 受 lazy chunk / pending IPC 影响可能延迟数秒甚至不触发，而 `dom-ready` 在文档解析完即触发，是更可靠的"已可见"信号

#### Scenario: 首次打开 Terminal 标签

- **WHEN** 用户首次进入 `/terminal`
- **THEN** webview 被创建，`dom-ready` 或 `did-finish-load` 任一事件首次触发后加载遮罩 MUST 立即隐藏，Chaterm 主界面渲染完成

#### Scenario: 切走标签后再切回

- **WHEN** 用户在 `/terminal` 中已建立一个 SSH 会话，然后切到 `/`，再切回 `/terminal`
- **THEN** 已建立的 SSH 会话 MUST 仍然可用（不重连），webview 实例 MUST 是同一个

#### Scenario: webview 渲染进程崩溃

- **WHEN** Chaterm webview 渲染进程崩溃（`render-process-gone` 事件触发）
- **THEN** Raven 主窗口与其它标签 MUST 不受影响；TerminalPage MUST 显示"终端已崩溃"占位与"重新加载"按钮，点击按钮 SHALL 重建 webview

#### Scenario: 拒绝远程导航

- **WHEN** Chaterm 内任意代码尝试 `window.location = "https://example.com"` 或打开外部链接
- **THEN** webview MUST 阻止导航，外链 SHALL 通过 Raven 主进程交由系统默认浏览器打开

---

### Requirement: Lifecycle & Resource Cleanup

应用退出或用户禁用 Terminal 时，Chaterm 主进程模块 SHALL 释放所有 SSH/SFTP 连接、关闭 better-sqlite3 句柄、并取消注册所有 `chaterm:*` / `db:*` / `ssh:*` 等由 `mountChaterm` 注册的 IPC handler。

`ChatermProcessService.attachWebview()` MUST 遵循三步式握手：

1. **mount**：`await mount({ webContentsId, bridge, signals })` 触发 Chaterm `mountChaterm()`，在 `ipcMain` 上注册所有 Chaterm 内部 handler（含 sender 校验）；
2. **registerAllowedSender**：`bridge.registerAllowedSender(webContentsId)` 把 webview 加入 `raven:llm:*` allowlist；
3. **set-session**：`webContents.send(IpcChannel.Raven_UI_SetSession, payload)` 把当前账号身份（或 guest fallback）下发给 Chaterm 渲染层，触发 `initUserDatabase`。

`detachWebview()` MUST 反向执行：通知 session 失效（可选）→ `unregisterAllowedSender` → `unmountChaterm()` 撤销所有 disposer。任一步异常 MUST 被捕获并记录，不影响后续步骤的执行。

#### Scenario: 应用退出

- **WHEN** 用户退出 Raven
- **THEN** 在 `before-quit` 钩子内 Chaterm 模块 MUST 在 3 秒内完成清理；清理流程包括 `unmountChaterm()` 撤销所有 handler、关闭 SSH/SFTP 连接、关闭 sqlite 句柄；超时 SHALL 强制 teardown 并打印 `error`

#### Scenario: 运行期禁用 Terminal

- **WHEN** 用户在设置中关闭 `terminal.enabled`
- **THEN** 已建立的 SSH 会话 MUST 被断开，sqlite 句柄 MUST 被关闭，`chaterm:*` / `db:*` / `ssh:*` 等 channel handlers MUST 被从 `ipcMain` 卸载（后续若被调用 MUST 返回 `No handler registered`）

#### Scenario: 渲染进程崩溃后重新加载

- **WHEN** webview 渲染进程崩溃，用户点击"重新加载"按钮
- **THEN** Raven MUST 先调用 `detachWebview('render-process-gone')` 反向执行三步式握手，然后 webview 重新创建并触发新的 `attachWebview` 三步式握手；MUST NOT 因 handler 残留而抛 `Attempted to register a second handler`

#### Scenario: attachWebview 中途失败

- **WHEN** `mount` 成功但 `registerAllowedSender` 或 `set-session` 抛错
- **THEN** `ChatermProcessService` MUST 调用 `unmount` 撤销已注册的 handler，恢复到 `attachWebview` 前的状态；MUST NOT 留下半挂载状态
