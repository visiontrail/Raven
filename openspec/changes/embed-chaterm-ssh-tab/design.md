## Context

Raven 是一个 React 19 + Electron 37 + Redux Toolkit 的多窗口桌面客户端（fork 自 Cherry Studio），拥有成熟的 `AiProvider` 多模型抽象、middleware pipeline 与 token 统计。Chaterm（`third_party/ChatermForRaven`）是一个 Vue 3.5 + Electron 41 的 AI 原生 SSH 终端，包含完整的 ssh2 连接池、SFTP、堡垒机、K8s exec、xterm 终端、Dockview 多面板、better-sqlite3 持久化与自带的 Agent loop / multi-provider 配置。

两者技术栈差异很大但都基于 electron-vite，并且 Chaterm 的 LLM 调用层 (`ApiHandler` 接口) 设计干净，天然支持外部桥接。本变更只覆盖：① 把 Chaterm 作为标签页嵌入 Raven；② 让 Chaterm 内部所有 LLM 调用复用 Raven 的 provider 配置。SSH 工具向 Raven Agent 暴露（目标 2）不在本设计内。

**关键约束：**
- Electron 应用只能有一个 runtime — Chaterm 必须降级到 Raven 的 Electron 37。
- Raven 已开启 `webviewTag: true`，可直接用 `<webview>` 嵌入。
- Chaterm 是 GPL-3.0；本设计不解决许可证兼容问题，依赖外部法务结论。
- Raven 主渲染进程是 React，Chaterm 是 Vue — 不在同一 document 内挂载两套框架。

## Goals / Non-Goals

**Goals:**
- Raven 主窗口新增 Terminal 标签，进入后以 webview 形式加载 Chaterm，体验上看起来是 Raven 的内置功能。
- Chaterm 内 AI 对话/Agent 全部走 Raven 的 `AiProvider`，用户只需在 Raven 设置中配置一次模型。
- Chaterm 渲染进程崩溃不波及 Raven 主窗口。
- Chaterm 与 Raven IPC 命名空间隔离，互不污染。
- 主题与语言跟随 Raven。
- 一次 `yarn build` 即可产出包含 Chaterm 的完整应用，原生模块正确签名/公证。

**Non-Goals:**
- 把 Chaterm UI 重写为 React（路径 B）。
- 把 Chaterm 的 SSH/SFTP/K8s 工具暴露给 Raven Agent 与 Claude Agent SDK（独立 change 处理）。
- 整合 Chaterm 账号体系到 Raven 账号 / 数据同步。
- 跨进程共享 Chaterm 的 sqlite 数据库到 Raven。
- 让 Raven 的 Chat 页使用 Chaterm 的 Agent loop。
- 支持 Chaterm 多 edition（cn/global）切换 — 嵌入模式下锁定单一 edition。

## Decisions

### D1: 集成路径 — webview 嵌入而非源码移植

**选择：** `<webview>` 加载本地协议下的 Chaterm SPA。
**理由：**
- Vue 与 React 不在同一 document 共存，避免 Antd Vue / Antd React 主题、Pinia / Redux、i18n 冲突。
- webview 是独立渲染进程，崩溃隔离。
- 上游 Chaterm 升级时只需重新构建子模块产物，不需要重写 UI。
- electron-builder 已支持 `extraResources` 投放静态资源。

**替代方案：**
- iframe：无法用独立 preload，IPC 桥接受限。
- BrowserView/WebContentsView：API 更底层，需要自己管理布局/层级；将来支持窗口拖拽分屏再考虑。
- 单独 BrowserWindow：体验割裂，违反"作为标签页"的目标。
- 源码移植到 React：工作量大于一个数量级，且每次 Chaterm 上游更新都要重做。

### D2: 进程模型 — Chaterm 主进程模块以 npm 依赖方式 require 进 Raven 主进程

**选择：** Chaterm 的 `src/main/` 编译产物作为本地 workspace 包，由 Raven 主进程 import 一个入口函数 `mountChaterm({ window, sender, bridge })`；Chaterm 渲染层通过 `extraResources` 单独打包成静态资源。
**理由：**
- 单一 Electron runtime 是硬约束（D1 之外的所有架构都被它压制）。
- Chaterm 主进程的所有 IPC handler 在 `mountChaterm()` 中注册，可以由 Raven 控制启用/卸载。
- 不需要进程间 socket / HTTP — 性能更好，类型友好。

**替代方案：**
- 用 child_process 起一个 Chaterm 独立进程，IPC 改成 socket：避免 GPL 链接性传染（可能）；但要重做整个 IPC 协议，且 ssh2 与 node-pty 在父子进程间难以共享。本设计不采用，留作 license 法务路径备选。

### D3: IPC 桥设计 — 三层 channel 前缀

**选择：**
- `chaterm:*` — Chaterm 内部 channel（renderer ↔ Chaterm 主进程模块）。
- `raven:*` — Raven 暴露给 webview 的 channel（含 `raven:llm:*`、`raven:ui:*`）。
- 现有的 Raven `IpcChannel` 常量保持不变，仍只服务于主渲染进程。

校验：所有 `chaterm:*` handler 在收到 IPC 时 MUST 校验 `event.sender.id === chatermWebviewId`，否则返回 `E_CHATERM_IPC_FORBIDDEN`；`raven:*` handler 用 sender allowlist 校验。

**理由：** 防止主渲染进程意外调用 Chaterm 的 SSH/DB；防止 Chaterm webview 调用 Raven 不打算外露的 channel；为后续允许更多 webContents 调用桥接（目标 2 的 Agent runtime）留扩展位。

### D4: LLM 桥接事件流协议

**选择：** Raven 主进程对 webview 推送结构化事件 `start | text | tool_use_start | tool_use_delta | tool_use_end | usage | end`，通过 `raven:llm:stream:<requestId>` 通道。Chaterm 侧的 `RavenBridgeHandler` 把事件流封装成 Chaterm 已有的 `ApiStream` async generator（`yield { type: 'text' | 'usage' | 'tool_use', ... }`）。
**理由：**
- Chaterm 内 Agent loop / 消息解析全部基于 `ApiStream`，桥接层做协议适配即可，**不需要改 Chaterm 业务代码**。
- 事件协议明确分段（`tool_use_start/delta/end`）能映射任何主流 provider（Anthropic / OpenAI / Gemini）的流式格式。
- `requestId` 作为流标识，便于 `abort` 与并发调用。

**替代方案：**
- 在 Raven 侧直接调用 Chaterm 的 callback：Raven 需要知道 Chaterm 内部消费者结构，紧耦合。
- 用 `ReadableStream` 跨进程：electron IPC 不原生支持 transferable streams，要自己实现拆包仍然回到事件协议。

### D5: 嵌入模式开关

**选择：** Raven 在创建 Chaterm webview 时通过 `webContents.session.setPreloads([chatermPreload])` 注入；并通过 `additionalArguments: ['--chaterm-embedded=1']` 让 Chaterm 主进程模块（同进程）与 preload 都能识别。环境变量 `CHATERM_EMBEDDED=1` 由 Raven 主进程在 `app.on('ready')` 之前设置。
**理由：** 单一信号源；Chaterm 独立打包/开发模式下不会误用。
**副作用：** Chaterm 用户体系、edition 切换、模型设置 UI 在嵌入模式下隐藏；Chaterm 自有的更新检查器关闭（由 Raven 的 `update-server` 统一管理）。

### D6: Token 统计与日志

**选择：** `RavenLLMBridge` 在 `usage` 事件触发时同步写入 Raven 的 token 统计 store（`source: 'chaterm'`），并发出 Redux 事件供用量页消费。日志只记录元信息（`requestId`、`modelId`、`source`、`finishReason`、`durationMs`、`promptTokenCount`），**不**记录消息正文。
**理由：** 用户感知一致；隐私合规；故障排查时 `requestId` 可串联前后端日志。

### D7: 主题与语言同步

**选择：** Raven 设置变化时主进程广播 `raven:ui:theme-changed` / `raven:ui:locale-changed` 到 Chaterm webview；Chaterm 渲染层订阅这两个事件并切换。Chaterm 自带的主题/语言切换 UI 在嵌入模式下隐藏。
**理由：** 用户感知"单一应用"。

### D8: 生命周期 — 标签后台保留

**选择：** Terminal 标签首次打开后创建 webview；切走标签 SHALL 保持 webview 存活（隐藏即可），只有用户在设置中关闭 `terminal.enabled` 或退出应用时才销毁。
**理由：** SSH 会话不应因为切标签而断开；React Router 切走时用 CSS `display:none` 而不是 unmount。

### D9: 资源缺失降级

**选择：** 应用启动期主进程检查 `resources/chaterm/index.html` 与 `preload.js` 是否存在；缺失时不注册 Terminal 路由也不注册 `raven:llm:*` 桥接，只打 `warn` 日志。
**理由：** Raven 自身可独立运行；防止打包错误把整个应用炸掉。

### D10: 构建拓扑

**选择：**
1. 在 Raven `package.json` 中以 workspace 方式引用 Chaterm 子模块（`third_party/ChatermForRaven`），把它的 `electron`/`@xterm`/`better-sqlite3`/`node-pty` 锁到 Raven 兼容版本。
2. Chaterm 主进程通过 `electron-vite` 构建后输出到 `third_party/ChatermForRaven/out/main/`；Raven 主进程构建时把这个目录作为 external 或 `viteResolve` alias 直接 import。
3. Chaterm 渲染产物输出到 `third_party/ChatermForRaven/out/renderer/`；Raven `electron-builder.yml` 的 `extraResources` 将其复制到 `resources/chaterm/`。
4. 注册自定义协议 `raven-chaterm://` 指向 `resources/chaterm/`。
5. macOS 签名/公证脚本扩展，覆盖 `resources/chaterm/**/*.node` 与 `node-pty` helper。

**理由：** 不破坏 Raven 现有 vite 配置；Chaterm 上游同步只需要重跑子模块构建。

### D11: Agent 命令执行复用可见 xterm 会话

**选择：** 嵌入模式下，Agent 的 `execute_command` 不再调用主进程 `RemoteTerminalManager.runCommand()` 创建后台执行流，而是通过一个不参与聊天渲染的 `command_execution` ask 消息通知 Chaterm renderer。renderer 将命令写入当前活动且主机匹配的 xterm；现有 command marker 负责采集远端回显，并以带 `suppressChatMessage` 标志的结构化 tool result 回传 Agent loop。

**理由：** 复用真实终端输入、回显、shell prompt 与人工操作完全相同的链路，用户能观察并随时介入；结构化结果仍可进入 Agent 上下文。审批消息继续使用现有 `command` ask，隐藏执行消息不进入右侧聊天历史。若活动终端不匹配目标主机，则显式失败，避免在错误服务器执行或形成“看似可见、实际后台执行”的分叉状态。

## Risks / Trade-offs

- **[GPL-3.0 链接性传染]** Chaterm 主进程模块以 `require()` 形式被 Raven 主进程链接，Electron 同包发布通常被认定为衍生作品 → Raven 整体可能被要求按 GPL-3.0 发布。**Mitigation:** 本设计的实施前置条件是 Chaterm 团队提供商业/双重授权或法务结论；若无法解决，备选方案是 D2 中提到的 child_process 进程隔离（仍有争议但风险降低），最坏情况下回退到自研 SSH 模块。
- **[Electron 41 → 37 降级]** Chaterm 上游用了 Electron 41 的新 API 可能在 37 不存在。**Mitigation:** 先在 PoC 阶段跑通 Chaterm 全量 e2e 测试；锁定 `better-sqlite3@12.x`、`node-pty@1.x`、`@xterm/*` 在 Electron 37 ABI 下编译。
- **[webview 性能/内存]** webview 是一个独立渲染进程，常驻会占额外内存（约 60–120MB）。**Mitigation:** 仅在用户首次打开 Terminal 后创建；提供"未使用时关闭终端"开关供低配机器用户。
- **[IPC 体积放大]** Chaterm 136+ channel 全部带 `chaterm:` 前缀，主进程需要 sender 校验。**Mitigation:** 抽公共校验中间件 `registerChatermHandler(channel, handler)`，统一处理。
- **[流式协议适配 BUG]** Raven `AiProvider` 各 provider 的流式格式差异（Anthropic 的 `input_json_delta` / OpenAI 的 `tool_calls[].function.arguments` 分片 / Gemini 的整段 JSON）映射到 D4 的事件协议时容易丢字段。**Mitigation:** 为每个 provider 写单元测试；先白名单：仅 Anthropic + OpenAI 兼容 provider 在 v1 启用，其它 provider 灰度。
- **[Chaterm 自有设置写回]** 嵌入模式下 Chaterm 用户在设置页改的某些项（语言、主题）会回写其 Pinia 持久化，造成与 Raven 不一致。**Mitigation:** 把 Chaterm 设置页相应控件设为 disabled + 只读提示；i18n / 主题完全受 Raven 广播驱动，Chaterm 内部 store 不再被持久化覆盖。
- **[原生模块签名/公证失败]** `node-pty` 在 macOS 上会带 helper 二进制，notarize 容易遗漏。**Mitigation:** CI 中新增 `verify-notarization.js` 脚本，递归扫描 `resources/chaterm` 下的 `.node` 与可执行文件并校验签名。
- **[模型不支持工具调用]** 用户在 Raven 配置的 provider 可能是无 tool_use 能力的模型，Chaterm Agent loop 强依赖 tool_use。**Mitigation:** `listAvailableModels` 返回 `capabilities.tools`；Chaterm 嵌入模式下若当前默认模型 `capabilities.tools === false`，UI 显示提示"当前模型不支持工具调用，Agent 功能不可用"。
- **[请求并发与 abort 时序]** 同一 Chaterm 会话快速发起多次 `createMessage` + `abort`，事件流交错可能导致 `end` 与 `text` 顺序错乱。**Mitigation:** 每个 `requestId` 独立的事件队列；`abort` 后到达的 provider 回调一律丢弃。

## Migration Plan

本变更是新增能力，无现存能力被替换，不涉及数据迁移。**部署顺序：**

1. **Phase 0 — 前置（不在本 change 任务清单内，但必须先完成）：** 法务/许可证结论；Chaterm 子模块创建本地分支用于嵌入式改造。
2. **Phase 1 — 子模块改造：** Chaterm 升降级到 Electron 37，重新编译原生模块；加 `CHATERM_EMBEDDED` 检测；写 `RavenBridgeHandler`；嵌入模式下隐藏 Provider/账号 UI。
3. **Phase 2 — Raven 主进程接入：** 实现 `RavenLLMBridgeService`、`ChatermProcessService`、自定义协议注册、IPC sender 校验。
4. **Phase 3 — Raven 渲染层接入：** 新增 `/terminal` 路由、Sidebar 项、`<webview>` 容器组件、主题/语言广播。
5. **Phase 4 — 构建/发布：** `electron-builder` 配置、签名/公证脚本、CI 验证脚本。
6. **Phase 5 — E2E：** 关键路径（创建 SSH 会话、调用 AI、切换主题、崩溃恢复、退出清理）的 Playwright 用例。

**Rollback：** 通过设置项 `terminal.enabled=false` 一键禁用 Terminal 标签与 LLM 桥；不需要回滚版本即可让用户绕过问题。资源层面 `resources/chaterm/` 可以从打包中移除以发布 hotfix。

## Open Questions

1. **OQ1：** Chaterm 内的 MCP（Model Context Protocol）配置是否也应该复用 Raven 的 MCP 设置？本设计先假设 Chaterm MCP 保持独立（仅在 Chaterm 内部生效），但用户体验上可能希望统一。建议作为后续 change。
2. **OQ2：** Chaterm 的 skills / 经验库数据保存在 Chaterm 自己的 sqlite。是否需要在 Raven 的 KnowledgeService 中提供联合查询？默认不实现，留作未来增强。
3. **OQ3：** webview 内的"复制/粘贴/右键菜单"是否需要 Raven 主进程接管以保证一致的快捷键？短期决定先走 webview 默认行为，待用户反馈后再统一。
4. **OQ4：** 当用户在 Raven 设置中切换默认模型，是否中断 Chaterm 进行中的 Agent loop？倾向于"不中断，下一个 `createMessage` 自动用新模型"；需产品确认。
5. **OQ5：** Chaterm 的 token 计入 Raven 用量后，是否要在 Raven 用量页支持按 `source` 过滤？若用量页本身没有 source 维度需要先扩展。
