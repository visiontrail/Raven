## 1. 前置与脚手架

- [x] 1.1 确认 Chaterm 双重授权 / 法务结论（外部）并在 PR 描述中链接，否则后续任务暂不启动
- [x] 1.2 在 `third_party/ChatermForRaven` 创建本地分支 `raven-embed`，作为所有 Chaterm 改造的目标分支
- [x] 1.3 在 Raven `packages/shared/IpcChannel.ts` 新增常量命名空间 `Raven_LLM_*` 与 `Raven_UI_*`，预留 `Chaterm_*` 前缀但不直接枚举每个 channel
- [x] 1.4 在 Raven `src/main/services/` 下新建空骨架：`RavenLLMBridgeService.ts`、`ChatermProcessService.ts`，仅导出类与构造签名
- [x] 1.5 在 Raven `src/renderer/src/pages/terminal/` 下新建 `TerminalPage.tsx` 骨架（显示"Coming soon"）并接入 Router 与 Sidebar，验证导航可达

## 2. Chaterm 子模块改造（runtime 对齐）

- [x] 2.1 把 Raven `package.json` 的 `electron` 升级到与 Chaterm 同版本（41.3.0），同步升级 `electron-vite` 到 5.0.0、`electron-builder` 26.8.1、`electron-updater` 6.8.3
- [x] 2.2 native 原生依赖对齐：Raven 自身不直接依赖 `better-sqlite3`/`node-pty`/`@xterm/*`，这些只存在于 Chaterm；Chaterm 已锁定在 Electron 41 ABI，无需 rebuild。完成 `yarn install`，Raven 1377 个单测全部通过
- [x] 2.3 Raven 升级到 Electron 41 后的兼容性修复清单：
  - 无 TypeScript API 破坏 (typecheck:node + typecheck:web 双双通过)
  - 仅 3 个快照测试因 jsdom/React 渲染格式变化（CSS `flex: 1` → `flex: 1 1 0%`、`style.color=unset` 现在被序列化）需要重生成；源码未改动，行为等价
  - 文档同步：[CLAUDE.md:76](CLAUDE.md:76)、[AGENTS.md:76](AGENTS.md:76) 中的 electron-vite 版本与 Electron 锁定说明已更新
- [x] 2.4 在 Chaterm 主进程入口加 `CHATERM_EMBEDDED` 检测开关，导出 `mountChaterm({ webContentsId, bridge, signals })` 与 `unmountChaterm()` 函数
- [x] 2.5 Chaterm 自有的"更新检查器"、"账号登录"、"edition 切换" 在嵌入模式下短路返回（保留代码，不执行）
- [x] 2.6 Chaterm 渲染层入口检测 `CHATERM_EMBEDDED`，禁用 Pinia 对主题/语言/Provider 的本地持久化写入

## 3. Chaterm 内 LLM 桥接 (Provider 注册)

- [x] 3.1 在 `src/main/agent/api/raven-bridge.ts` 实现 `RavenBridgeHandler implements ApiHandler`，构造函数接收 preload 暴露的 `window.ravenLLM` 句柄（或主进程内的 `bridge` 引用）
- [x] 3.2 实现 `createMessage(systemPrompt, messages)` → `ApiStream`：内部生成 `requestId`，调用 `raven:llm:createMessage`，订阅 `raven:llm:stream:<requestId>` 把事件协议翻译为 `ApiStream` 的 `yield` 项
- [x] 3.3 实现 abort 支持：消费者中断时调用 `raven:llm:abort`
- [x] 3.4 在 `src/main/agent/api/index.ts` 的 `buildApiHandler()` 添加 `raven-bridge` 分支；嵌入模式下默认 provider 强制为 `raven-bridge`，忽略 Chaterm 本地 provider 配置
- [x] 3.5 单元测试：mock 桥接事件流，验证 `text` / `tool_use_*` / `usage` / `end` 全部正确映射；中止时 `ApiStream` 立即结束并不抛
- [ ] 3.6 在 Chaterm 设置页隐藏/锁定 Provider 选择、API Key、Base URL、登录入口，并加只读说明文案与"前往 Raven 设置"按钮（按钮通过 `raven:ui:navigate('/settings/providers')` IPC 触发）

## 4. Raven 主进程 — LLM 桥接服务

- [x] 4.1 实现 `RavenLLMBridgeService`：维护 `requestId → { abortController, sender }` 表；构造时接收 Raven 的 `AiProviderFactory`
- [x] 4.2 注册 `raven:llm:listAvailableModels` handler：调用 Raven providers store，返回 `{providerId, modelId, displayName, capabilities}[]`，过滤掉无 API key 与禁用项
- [x] 4.3 注册 `raven:llm:createMessage` handler：sender allowlist 校验；忽略入参中的凭证字段；`modelId` 未指定时取 Raven 默认对话模型；不在 `listAvailableModels` 集合中则返回 `E_MODEL_NOT_AVAILABLE`
- [x] 4.4 实现 streaming 适配器：把 `AiProvider.completions()` 的回调/iterator 拆成事件协议（`start | text | tool_use_start | tool_use_delta | tool_use_end | usage | end`），按 `raven:llm:stream:<requestId>` 推送
- [x] 4.5 注册 `raven:llm:abort` handler：根据 `requestId` 找到 abortController 调用 abort；之后到达的 provider 事件全部丢弃；1 秒内补发 `end(finishReason=abort)`
- [x] 4.6 sender allowlist：注册函数 `bridge.registerAllowedSender(webContentsId)`，在 Chaterm webview 创建后由 `ChatermProcessService` 调用
- [x] 4.7 token 统计接入：`usage` 事件触发时调用 Raven 现有 token 统计 store，写入 `source = 'chaterm'`（提供 `onUsage` 回调注入点；统计 store 的具体接线由渲染层任务完成）
- [x] 4.8 日志规范：`info` 级别记录 `requestId/modelId/source/finishReason/durationMs/promptTokenCount`，**不**记录消息正文
- [ ] 4.9 为 Anthropic / OpenAI provider 各写一组流式协议单测（含工具调用、并发、abort）
  - 桥接层协议单测已完成（sender allowlist、credential 剥离、modelId 校验、text/usage/end 转发、abort 时序、事件丢弃）：[RavenLLMBridgeService.test.ts](src/main/services/__tests__/RavenLLMBridgeService.test.ts)
  - 渲染层适配器已实现：`ChatermBridgeService` 直接调用 Anthropic/OpenAI SDK 流式接口，事件映射到 `BridgeStreamEvent` 后经 `INTERNAL_CHANNELS.Event` 推回主进程（[ChatermBridgeService.ts](src/renderer/src/services/ChatermBridgeService.ts)）
  - **待补：** 针对 `ChatermBridgeService.streamAnthropic` / `streamOpenAI` 的单测（需在 Vitest 环境中 mock Anthropic/OpenAI SDK 流式响应）
- [x] 4.10 Gemini / Bedrock / 其它 provider 标记为 v1 灰度（在 `listAvailableModels` 中暂用 `capabilities.tools=false` 或不返回），后续 change 解锁
  - 在 `ChatermBridgeService.buildAvailableModels()` 中实现：`gemini/vertexai/aws-bedrock/qwenlm` → `capabilities.tools=false`；`anthropic/openai/*` → 由 `isFunctionCallingModel()` 决定（[ChatermBridgeService.ts](src/renderer/src/services/ChatermBridgeService.ts:92)）

## 5. Raven 主进程 — Chaterm 进程服务与资源加载

- [x] 5.1 实现 `ChatermProcessService.start()`：检查 `resources/chaterm/index.html` 与 `preload.js` 是否存在；缺失打 `warn` 并标记 `enabled=false`（[ChatermProcessService.ts:73-92](src/main/services/ChatermProcessService.ts:73)）
- [x] 5.2 注册自定义协议 `raven-chaterm://`，把请求映射到 `resources/chaterm/*`（使用现代 `protocol.handle()`；含 path-traversal / 编码遍历 / 空字节防护，[chaterm/protocol.ts](src/main/services/chaterm/protocol.ts)）
- [x] 5.3 在 `attachWebview(webContents)` 中取得 `webContents.id`，调用 `bridge.registerAllowedSender(id)` 与 `mount({ webContentsId, bridge, signals })`（[ChatermProcessService.ts:122-167](src/main/services/ChatermProcessService.ts:122)）
  - 注意：未采用全局 `app.on('web-contents-created')` 监听 `did-attach-webview`；改为由 `TerminalPage` 在 `<webview>` 拿到 `webContents` 后显式调用 `chatermProcessService.attachWebview()`，更利于按需懒挂载（§6.4）和测试
- [x] 5.4 `registerChatermHandler(channel, provider, handler)` 工具函数：校验 `event.sender.id === chatermWebviewId`，否则返回 `E_CHATERM_IPC_FORBIDDEN`；强制要求 `chaterm:` 前缀；返回 disposer ([chaterm/registerChatermHandler.ts](src/main/services/chaterm/registerChatermHandler.ts))
- [x] 5.5 `render-process-gone` / webview `destroyed` 监听：调用 `detachWebview()`，依次 dispose 所有跟踪的 `chaterm:*` handler、`bridge.unregisterAllowedSender()`、`unmount()`；提供 `onCrashed` 回调让渲染层显示崩溃占位（[ChatermProcessService.ts:138-194](src/main/services/ChatermProcessService.ts:138)）
- [x] 5.6 `will-quit` 钩子里调用 `chatermProcessService.destroy()`，内部 `Promise.race` 3 秒超时；超时打 `error` 并强制清理 ([index.ts:209-216](src/main/index.ts:209)，[ChatermProcessService.ts:222-238](src/main/services/ChatermProcessService.ts:222))
- [x] 5.7 `setUserEnabled(false)` 立即调用 `detachWebview()`；webview 元素本身的销毁由渲染层（§6）依据 `isEnabled()` 决定 ([ChatermProcessService.ts:198-207](src/main/services/ChatermProcessService.ts:198))

## 6. Raven 渲染层 — Terminal 标签

- [x] 6.1 `Sidebar.tsx` 注册 `terminal` 图标与 `/terminal` 路由项；读取设置项 `terminal.enabled` 与 Chaterm 资源状态决定是否显示
  - Sidebar 已有 `terminal` in iconMap/pathMap；`App.tsx` 新增 `/terminal` 路由；`TerminalPage` 在 hasAssets=false 时显示不可用提示
- [x] 6.2 `Router.tsx` 新增 `<Route path="/terminal" element={<TerminalPage />} />`；加路由守卫，禁用时重定向到 `/`
  - 改在 `App.tsx`（真实入口）添加路由；`TerminalPage` 作为路由守卫：hasAssets=false 时渲染不可用提示（[TerminalPage.tsx](src/renderer/src/pages/terminal/TerminalPage.tsx)）
- [x] 6.3 `TerminalPage` 渲染 `<webview src="raven-chaterm://app/index.html" preload="..." nodeintegration={false} webpreferences="contextIsolation=yes">`
  - webview 在 `ChatermWebviewHost` 中渲染（位于路由树之外以实现保活），而非在路由组件内（[ChatermWebviewHost.tsx](src/renderer/src/components/app/ChatermWebviewHost.tsx:42)）
- [x] 6.4 lazy 首挂：用户首次进入 `/terminal` 才创建 webview；后续切走标签时用 `display:none` 而非卸载，保留 SSH 会话
  - `everMountedRef` 记录首次挂载，`Host` 组件 `display:none` 保活（[ChatermWebviewHost.tsx:43-47](src/renderer/src/components/app/ChatermWebviewHost.tsx:43)）
- [x] 6.5 加载占位：webview `did-start-loading` 时显示 spinner + 文案，`did-finish-load` 后隐藏
  - `LoadState: 'idle' | 'loading' | 'loaded' | 'crashed'`；Overlay 在 idle/loading 时渲染（[ChatermWebviewHost.tsx:117](src/renderer/src/components/app/ChatermWebviewHost.tsx:117)）
- [x] 6.6 崩溃占位：监听 `render-process-gone`，显示"终端已崩溃 - 重新加载"按钮，点击重建 webview
  - 主进程转发 crash 事件；`onWebviewCrashed` 更新状态；Reload 按钮调用 `webviewRef.current.reload()`（[ChatermWebviewHost.tsx:68](src/renderer/src/components/app/ChatermWebviewHost.tsx:68)）
- [x] 6.7 阻止远程导航：监听 `will-navigate`，非 `raven-chaterm://` 的 URL 一律 prevent 并交由系统浏览器
  - `onWillNavigate` 事件处理（[ChatermWebviewHost.tsx:103](src/renderer/src/components/app/ChatermWebviewHost.tsx:103)）
- [x] 6.8 主题/语言广播：订阅 Raven 主题与 i18n store，变化时 `webview.send('raven:ui:theme-changed', payload)` / `raven:ui:locale-changed`
  - `useTheme().theme` + `useSettings().language` 变化时 `webviewRef.current.send()`（[ChatermWebviewHost.tsx:75-83](src/renderer/src/components/app/ChatermWebviewHost.tsx:75)）
- [x] 6.9 监听 `raven:ui:navigate` 反向 IPC（Chaterm 调过来），切换 Raven 主路由
  - 双路监听：`window.api.chaterm.onNavigate`（主进程转发）+ webview `ipc-message` 事件（[ChatermWebviewHost.tsx:57-72](src/renderer/src/components/app/ChatermWebviewHost.tsx:57)）

## 7. Chaterm 专用 preload

- [ ] 7.1 在 Chaterm 子模块新建 `src/preload/raven-embedded.ts`：仅暴露 `window.ravenLLM`（`listAvailableModels`、`createMessage`、`abort`、`onStream`）与 `window.ravenUI`（`onThemeChanged`、`onLocaleChanged`、`navigate`）
- [ ] 7.2 把 Chaterm 原有 preload 中与"账号"、"更新"相关的 API 在嵌入模式下空实现
- [ ] 7.3 构建后输出到 `out/preload/raven-embedded.js`，并被 Raven `electron-builder` 拷贝到 `resources/chaterm/preload.js`

## 8. 构建与打包

- [ ] 8.1 Chaterm 子模块的 `electron.vite.config.ts` 添加嵌入模式 build target，渲染产物输出到 `out/renderer/`，preload 输出到 `out/preload/raven-embedded.js`
- [ ] 8.2 在 Raven 根目录新增脚本 `scripts/build-chaterm.js`：调用子模块构建并把产物 copy 到 `resources/chaterm/`
- [ ] 8.3 Raven `package.json` 在 `build` 与 `build:mac/win/linux` 之前 `yarn workspace ... run build:embedded` 或直接调用 `scripts/build-chaterm.js`
- [ ] 8.4 `electron-builder.yml` 增加 `extraResources` 把 `resources/chaterm/**` 投放到打包路径；`asarUnpack` 包含 `**/*.node`
- [ ] 8.5 构建期版本一致性校验：`scripts/check-electron-version.js` 比对 Raven 与 Chaterm 子模块 `electron` 版本，不一致时 fail-fast (`E_ELECTRON_VERSION_MISMATCH`)
- [ ] 8.6 扩展 macOS notarize 脚本，递归扫描 `resources/chaterm/**/*.node` 与 `node-pty` helper 二进制，确保都已签名
- [ ] 8.7 新增 `scripts/verify-notarization.js`，CI 中在发布前运行；任意未签名二进制 → fail

## 9. 端到端验证

- [ ] 9.1 Playwright：从 Raven 启动到点击 Terminal 标签，断言 webview 加载到 Chaterm 主界面
- [ ] 9.2 Playwright：在 Chaterm 内创建一次 SSH 连接（mock SSH server），断言连接成功并能 exec 命令
- [ ] 9.3 Playwright：在 Chaterm 内发起一次 AI 对话，断言 token 统计页出现 `source=chaterm` 记录，且模型与 Raven 默认模型一致
- [ ] 9.4 Playwright：切到 `/`，再切回 `/terminal`，断言 SSH 会话仍存活
- [ ] 9.5 Playwright：在 Raven 设置切换深色模式，断言 Chaterm webview 内主题在 1 秒内变更
- [ ] 9.6 Playwright：在设置中关闭 `terminal.enabled`，断言侧栏 Terminal 项消失、`/terminal` 重定向、Chaterm 主进程模块卸载（通过日志断言）
- [ ] 9.7 Playwright：模拟 Chaterm webview 崩溃（`webview.crash()`），断言 Raven 主窗口不受影响，崩溃占位出现，点击重新加载后恢复
- [x] 9.8 单元：sender 校验 — 用 mock event 模拟非 Chaterm sender 调用 `raven:llm:createMessage` 与 `chaterm:ssh:connect`，断言均返回 forbidden 错误
  - `raven:llm:createMessage` 覆盖于 [RavenLLMBridgeService.test.ts](src/main/services/__tests__/RavenLLMBridgeService.test.ts) "rejects createMessage from unauthorized sender"；`chaterm:ssh:connect` 覆盖于 [ChatermProcessService.test.ts](src/main/services/__tests__/ChatermProcessService.test.ts) "rejects calls from non-chaterm senders"
- [x] 9.9 单元：abort 时序 — 发起请求后立即 abort，断言 `end(finishReason=abort)` 推送且后续 provider 事件被丢弃
  - 覆盖于 [RavenLLMBridgeService.test.ts](src/main/services/__tests__/RavenLLMBridgeService.test.ts) "abort emits end(finishReason=abort) within grace period and drops later events"

## 10. 文档与发布

- [x] 10.1 在 `docs/` 新增 `terminal-tab.md`：用户视角的功能介绍、设置项、已知限制（如某些模型不支持工具调用）
- [x] 10.2 在 `CLAUDE.md` / `AGENTS.md` 的 "Architecture Overview" 章节补充 Chaterm 嵌入与 LLM 桥的简介与目录指引
- [x] 10.3 在仓库根的 `NOTICE` / `LICENSES/` 目录加入 Chaterm 的 GPL-3.0 与 Cline Apache-2.0 文本与归属
- [x] 10.4 Release notes：列出 Terminal 标签、AI 模型复用、设置项 `terminal.enabled` 的新增说明
