## ADDED Requirements

### Requirement: Terminal Tab Registration

Raven 主侧栏 SHALL 提供一个 `Terminal` 入口，对应路由 `/terminal`，并 SHALL 与现有 Chat / Agents / Knowledge / Files / Settings 等顶级标签保持一致的视觉与导航行为（图标尺寸、激活态、键盘可达性、徽标位置）。

该标签项 SHALL 支持通过用户设置项 `terminal.enabled` 隐藏（默认 `true`）；当 Chaterm 资源缺失（未打包/资源损坏）时 MUST 自动降级为隐藏并在日志中打 `warn`。

#### Scenario: 用户从侧栏打开 Terminal

- **WHEN** 用户点击侧栏的 Terminal 图标
- **THEN** 路由切换到 `/terminal`，渲染 `TerminalPage`，并在 800ms 内出现 Chaterm 加载占位界面（spinner + "正在启动终端…"）

#### Scenario: Chaterm 资源缺失时的降级

- **WHEN** 应用启动期检查 `resources/chaterm/` 主资源（`index.html` 与 `preload.js`）任一缺失
- **THEN** 侧栏 MUST 不显示 Terminal 项，且 `RavenLLMBridge` 不注册 Chaterm 相关 IPC，并在日志中打印 `warn` 级别 `chaterm.assets.missing`

#### Scenario: 用户在设置中禁用 Terminal

- **WHEN** 用户在设置中把 `terminal.enabled` 关闭
- **THEN** 侧栏 Terminal 项立即隐藏，已打开的 `/terminal` 路由 MUST 被路由守卫重定向到 `/`，并销毁内部 webview

---

### Requirement: Embedded Webview Container

`TerminalPage` SHALL 使用 Electron `<webview>` 标签作为 Chaterm 渲染层的容器，并 MUST 满足：

- `src` 指向 Raven 注册的本地协议 URL（如 `raven-chaterm://app/index.html`），不允许加载远程 URL
- `preload` 指向 Chaterm 专用 preload（独立于 Raven 主 preload）
- `nodeintegration` MUST 关闭；`contextIsolation` MUST 开启
- webview 进程 SHALL 与 Raven 主渲染进程隔离，崩溃不影响 Raven 主窗口
- 容器 SHALL 在标签首次打开时懒加载，并在用户切走标签时保持后台运行（不销毁），以保留 SSH 会话；只有显式关闭/路由禁用时才销毁

#### Scenario: 首次打开 Terminal 标签

- **WHEN** 用户首次进入 `/terminal`
- **THEN** webview 被创建，`did-finish-load` 事件触发后 Chaterm 主界面渲染完成

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

### Requirement: IPC Namespace Isolation

Chaterm 嵌入后所有 IPC channel 名称 MUST 统一以 `chaterm:` 作为前缀（例如 `chaterm:ssh:connect`、`chaterm:db:query`、`chaterm:agent:post-message`），并 MUST 不与 Raven 现有 `IpcChannel` 枚举中的任何常量重名。Raven 暴露给 Chaterm 的 IPC channel MUST 统一以 `raven:` 作为前缀。

`chaterm:*` channel SHALL 仅在 Chaterm webview 的 `webContents.id` 上注册和监听；Raven 主渲染进程 MUST 不能调用 `chaterm:*` channel。

#### Scenario: Chaterm 调用 SSH 连接

- **WHEN** Chaterm 渲染层调用 `chaterm:ssh:connect`
- **THEN** Raven 主进程的 Chaterm 子模块接收并处理；调用 `event.sender` 的 webContents id MUST 等于 Chaterm webview 的 id，否则 MUST 拒绝并返回错误 `E_CHATERM_IPC_FORBIDDEN`

#### Scenario: Raven 主渲染误调 Chaterm channel

- **WHEN** Raven 主渲染进程尝试调用 `ipcRenderer.invoke('chaterm:ssh:connect', ...)`
- **THEN** 主进程 MUST 校验 sender 并返回错误 `E_CHATERM_IPC_FORBIDDEN`

---

### Requirement: Theme & Locale Synchronization

Chaterm 嵌入时 MUST 跟随 Raven 的主题（light/dark）和语言设置：

- Raven 切换主题时 SHALL 通过 `raven:ui:theme-changed` 广播到 webview，Chaterm 收到后切换到对应主题
- Raven 切换语言时 SHALL 广播 `raven:ui:locale-changed`；Chaterm i18n 应切换到匹配语言，匹配失败时回退到 `en`

#### Scenario: 用户切换深色模式

- **WHEN** 用户在 Raven 设置中切换到深色模式
- **THEN** Chaterm webview 内主题在 500ms 内切换为深色，Chaterm 不再显示自身的主题切换按钮

#### Scenario: 用户切换语言到中文

- **WHEN** Raven 当前语言为 `en-US`，用户切换为 `zh-CN`
- **THEN** Chaterm webview 内文案切换为中文；若 Chaterm 不支持某语言 MUST 回退到 `en` 而不是报错

---

### Requirement: Packaging & Distribution

Chaterm 渲染层与 Chaterm 专用 preload SHALL 由 Raven `electron-builder` 配置以 `extraResources` 方式打入主应用包 `resources/chaterm/` 目录；Chaterm 主进程代码 SHALL 以普通 npm 依赖方式 require 进 Raven 主进程，并复用 Raven 的 Electron runtime。

Raven 与 Chaterm SHALL 使用同一 Electron 版本（以 Raven 的 `package.json` 中 `electron` 字段为准），Chaterm 引入的原生模块（`better-sqlite3`、`node-pty`、`ssh2` 等）MUST 以匹配该 Electron ABI 的版本编译或重新编译。

macOS 签名/公证流程 MUST 覆盖 Chaterm 引入的所有本机二进制（`.node` 文件、`node-pty` helper）。

#### Scenario: 构建 macOS 包

- **WHEN** 在 macOS 上执行 `yarn build:mac`
- **THEN** 产物 `Raven.app/Contents/Resources/chaterm/` 下 MUST 存在 `index.html` 与 `preload.js`，所有 `.node` 二进制 MUST 已被 codesign 与 notarize

#### Scenario: Electron 版本不一致

- **WHEN** Chaterm 子模块声明 `electron` 与 Raven 主项目不一致
- **THEN** 构建脚本 MUST 在打包前 fail-fast，输出错误 `E_ELECTRON_VERSION_MISMATCH` 并提示需要对齐版本

---

### Requirement: Lifecycle & Resource Cleanup

应用退出或用户禁用 Terminal 时，Chaterm 主进程模块 SHALL 释放所有 SSH/SFTP 连接、关闭 better-sqlite3 句柄、并取消注册所有 `chaterm:*` IPC handler。

#### Scenario: 应用退出

- **WHEN** 用户退出 Raven
- **THEN** 在 `before-quit` 钩子内 Chaterm 模块 MUST 在 3 秒内完成清理；超时 SHALL 强制断开连接并打印 `error`

#### Scenario: 运行期禁用 Terminal

- **WHEN** 用户在设置中关闭 `terminal.enabled`
- **THEN** 已建立的 SSH 会话 MUST 被断开，sqlite 句柄 MUST 被关闭，`chaterm:*` channel handlers MUST 被卸载
