## Context

Raven Client 现在的 `/agents` 页面是普通 Assistant 模板列表。页面读取本地/远程 Agent JSON 与用户自建 Agent，点击卡片后调用 `createAssistantFromAgent()` 创建普通 Assistant；这条链路不具备专业 Agent 的 run 生命周期、项目上下文、日志附件、trace 或取消语义。

RavenAIService 已经提供可复用的专业 Agent 能力：

- `POST /api/v1/ai-chat/log-analysis/stream`：日志分析 Agent，multipart form，支持 `message`、`session_id`、`history`、`remember`、`project_repo_id`、`file`。
- `POST /api/v1/ai-chat/project-expert/stream`：项目专家 Agent，multipart form，支持 `message`、`session_id`、`history`、`remember`、`project_repo_id`。
- `POST /api/v1/ai-chat/log-analysis/cancel`、`POST /api/v1/ai-chat/project-expert/cancel`：按 session 取消。
- `GET /api/v1/ai-chat/log-analysis/result`、`GET /api/v1/ai-chat/project-expert/result`：按 session 查询兜底结果。
- `GET /api/v1/ai-chat/chat/runs/{run_id}/stream|cancel`：后端返回 `run_id` 后的统一订阅与取消。
- `GET /api/v1/project-repos`：普通用户可读取的已启用项目仓库选项。

测试阶段要求 Client 连接本地局域网 IP 上运行的 RavenAIService，而不是生产或云端服务。Raven Client 主进程已有 `ConfigManager.getRavenAIServiceHost()` / `getRavenAIServicePort()`，未配置时当前回落为 `10.60.11.3:8085`；Device Link 也复用该配置。Agents 工作台应复用这组 host/port，并新增必要的 renderer 访问方式与可选鉴权 token。

## Goals / Non-Goals

**Goals:**

- 将 `/agents` 改造成可直接运行 AIService Agent 的工作台。
- 首批支持两个 AIService Agent：日志分析、项目专家。
- 测试阶段默认连接本地 IP RavenAIService，基准地址来自 `ConfigManager`，禁止硬编码生产域名。
- 支持项目仓库选择；项目专家新会话必须选择项目仓库，日志分析可选项目仓库。
- 支持日志文件上传、SSE 流式解析、Agent trace 展示、回答增量渲染、运行状态、取消与失败恢复。
- 保留现有普通 Agent 模板数据，不破坏已保存的用户 Agent；但模板入口降级为次级体验。
- 代码结构允许后续增加 PackageSearchAgent 或本地 Claude TypeScript SDK runtime，但本次不实现。

**Non-Goals:**

- 不在 Raven Client 内实现 Claude Agent SDK TypeScript agent loop。
- 不迁移 AIService 的后端 Agent 实现、prompt、skills 或项目仓库管理逻辑。
- 不把 AIService 前端 `AIChat.vue` 整体嵌入 Client；只移植必要的 API 契约与状态机思路。
- 不在本变更中实现完整 Raven 账号体系与 AIService 账号统一登录；测试阶段采用可配置的 AIService token。
- 不改变 Device Link WebSocket 语义。

## Decisions

### D1: `/agents` 成为 Agent 工作台，模板助手成为次级入口

**选择：** 保留 `/agents` 路由，但首屏展示 AIService Agent 工作台。页面左侧列出 Agent 类型（日志分析、项目专家、后续扩展位），中间为运行面板，右侧或折叠区域展示 trace / context / run 状态。现有“添加、导入、模板卡片”能力移动到“模板助手”分区或管理入口。

**理由：**
- 用户点击 Agents 预期进入真实 Agent 能力，而不是复制提示词。
- 复用当前路由能避免侧栏、Launchpad 与历史导航大改。
- 已保存的用户 Agent 状态仍在 Redux `agents` slice 中，不需要数据迁移。

**替代方案：**
- 新增 `/aiservice-agents` 路由并保留旧 `/agents`：会造成两个 Agent 入口，测试阶段不利于验证新体验。
- 直接嵌入 AIService 前端页面：实现快，但 Raven Client 的主题、文件选择、通知、桌面权限与状态管理会割裂。

### D2: AIService 连接配置由主进程持有，renderer 只拿净化后的 base URL

**选择：** 在主进程/预加载层暴露 AIService 配置读取接口，例如 `window.api.ravenAIService.getConfig()` 返回 `{ baseUrl, host, port }`，base URL 由 `ConfigManager.getRavenAIServiceHost()` 与 `getRavenAIServicePort()` 生成。测试阶段默认 `http://10.60.11.3:8085`，也允许设置为其它本地局域网 IP。

**理由：**
- `ConfigManager` 已经是 RavenAIService endpoint 的事实来源，Device Link 与 Agent 工作台不应各自维护 host/port。
- Renderer 不需要知道配置存储细节。
- 后续可以在 Settings 里统一展示“RavenAIService 连接”。

**替代方案：**
- 在 renderer 硬编码 `http://10.60.11.3:8085`：最快，但换测试机就要改代码。
- 复用任意 `Config_Get` 读取 key：可行但类型弱，容易泄漏未来敏感配置。

### D3: 测试阶段使用可配置 Bearer token，不做完整登录联动

**选择：** 新增可选 `ravenAIServiceAuthToken` 配置项或仅在开发/测试配置中读取 token。Agent API 客户端在 token 存在时附加 `Authorization: Bearer <token>`，不存在时仍发起请求并展示 AIService 返回的 401/403 指引。

**理由：**
- AIService 的 Agent stream endpoint 当前依赖 `get_current_user`，实际运行通常需要 token。
- Raven Client 当前没有成熟的 AIService 用户登录 UI，强行做账号体系会显著扩大范围。
- 测试阶段通过本地 IP + 手动 token 可以快速验证闭环。

**替代方案：**
- 要求 AIService 测试环境关闭鉴权：短期方便，但会掩盖真实接口权限问题。
- 立即接入 AIService 登录页：属于独立能力，应另开 change。

### D4: Renderer 直接使用 fetch + ReadableStream 消费 SSE

**选择：** 新增 `src/renderer/src/services/AIServiceAgentClient.ts`，用 `fetch` 发送 JSON/multipart 请求，用 `ReadableStreamDefaultReader` 手动解析 SSE `data:` frame。不要使用 `EventSource`，因为日志分析和项目专家启动是 `POST multipart/form-data`，不是简单 `GET`。

**理由：**
- AIService 前端已经验证了 `fetch + reader` 模式。
- 可以上传文件、携带 Authorization、AbortController，并对早期 4xx body 做友好错误解析。
- 不引入新依赖。

**替代方案：**
- EventSource：无法发 multipart POST，不适合启动 run。
- Axios：浏览器环境下流式响应处理不如 fetch 直接。

### D5: Client 侧建立轻量 run 状态机，借鉴 AIService 前端但不直接复制 Pinia

**选择：** 在 Raven Client 中新增 React/Redux 或 hook 级状态：`idle | running | succeeded | failed | cancelled | stale`，保存 `sessionId`、`runId`、`agentKind`、`messages`、`traceEvents`、`answerSoFar`、`selectedProjectRepoId`、`selectedFile`、`abortController`。SSE payload 统一进入 `applyAIServiceAgentEvent(state, payload)`。

**理由：**
- Raven Client 是 React + Redux，不应引入 Vue/Pinia。
- 保持状态机小而清楚，足够支撑两个 Agent。
- 后续接入统一 run 订阅、后台恢复或本地 Agent runtime 时有扩展点。

**替代方案：**
- 完全复刻 AIService 前端 store：跨框架成本高，且 Raven Client 的 UI 模型不同。
- 仅用组件 local state：初期快，但取消、切换 Agent、重试、trace 展开会变脆。

### D6: Trace 采用 AIService AgentTraceEvent mirror

**选择：** 在 Client 侧新增 `AgentTraceEvent` TypeScript 类型镜像，支持 `run_start`、`answer_delta`、`step_start/delta/end`、`thinking_*`、`system_notice`、`run_complete`、`cancelled`、`error`。UI 默认显示回答正文，trace 面板可展开查看工具、思考、状态事件。

**理由：**
- AIService 已将 trace 协议文档化，两个 Agent 共用。
- 前端只要消费 `agent_trace` frame 与 terminal frame 即可支持不同专业 Agent。
- Trace 展示是“真正 Agent”的核心可见性，不应只显示最终答案。

**替代方案：**
- 只渲染 `done.answer`：实现简单，但用户无法观察 Agent loop 与工具进展。

### D7: 项目仓库选择统一来自 `GET /api/v1/project-repos`

**选择：** 工作台加载时调用 AIService `GET /api/v1/project-repos?limit=200`，展示 `project_name`、`project_code`、`default_branch`、`description`。项目专家启动时必须传 `project_repo_id`；日志分析启动时在用户选择项目时传入，不选择则允许只依赖日志包 metadata。

**理由：**
- 该 API 只返回展示用字段，不暴露 git token。
- 与 AIService 的项目权限和启用状态保持一致。

**替代方案：**
- Client 自己维护项目列表：会与 AIService 后端状态漂移。

### D8: 取消优先使用 run_id，早期回退到 session cancel

**选择：** 当 SSE frame 中出现 `run_id` 后，取消走 `/api/v1/ai-chat/chat/runs/{run_id}/cancel`；在 `run_id` 尚未到达前，按 Agent 类型回退到 `/log-analysis/cancel` 或 `/project-expert/cancel`，body 为 `{ session_id }`。

**理由：**
- 与 AIService 前端当前策略一致。
- 解决 run 创建初期的竞态。

**替代方案：**
- 只按 session cancel：多 run 历史和后台恢复场景会不够精确。

### D9: 错误处理以连接诊断为第一层

**选择：** Agent 工作台顶部显示 AIService 连接状态：base URL、连接测试、项目列表加载状态。常见错误分类：连接失败、401/403、项目缺失、上传格式/大小失败、SSE 中断、后端 terminal error。

**理由：**
- 测试阶段本地 IP 服务最容易遇到“服务未启动 / IP 不通 / token 过期”。
- 把连接问题和 Agent 失败区分开，减少误判。

## Risks / Trade-offs

- **[本地 IP 不稳定]** 测试机器 IP 可能变化，默认 `10.60.11.3` 不一定适用于所有人 → 使用 `ConfigManager` 配置作为唯一来源，并在设置/工作台中展示当前 base URL 与连接测试。
- **[AIService 鉴权未打通]** Client 目前没有 AIService 登录态 → 增加可配置 Bearer token；401/403 时明确提示用户配置测试 token。
- **[SSE 中途断开]** 网络或代理可能断开流 → 保留 `sessionId/runId`，提供“重新订阅/查询结果”操作；后续可接 `/active-run`。
- **[日志文件过大]** Renderer 直接 multipart 上传大文件可能卡 UI 或失败 → 依赖浏览器 FormData 流式上传能力；UI 显示文件大小，后端失败时保留文件选择以便重试。
- **[旧模板入口被弱化]** 习惯使用模板 Agent 的用户可能找不到入口 → 保留“模板助手”分区和管理弹窗，不删除数据。
- **[跨仓 API 漂移]** AIService API 字段变化会破坏 Client → 在 Client 侧集中封装 `AIServiceAgentClient`，单元测试固定 wire contract。

## Migration Plan

1. 新增 AIService 配置读取与可选 token 配置，不改现有 Device Link 行为。
2. 新增 AIService API client、SSE parser、Agent trace 类型和状态机单元测试。
3. 重构 `/agents` 页面为工作台，保留模板入口。
4. 接入项目仓库列表、日志分析运行、项目专家运行、取消/重试。
5. 在本地 IP RavenAIService 上做手动闭环测试：连接、项目列表、项目专家问答、日志上传分析、取消。
6. 若测试阶段需要回滚，可通过 feature flag 或路由分支恢复旧 `AgentsPage` 模板列表；Redux 中已有用户 Agent 数据不变。

## Addendum: Conversation redesign (sidebar + multi-turn chat)

The first iteration shipped a single-shot workbench (one question → one answer, no
history). This addendum upgrades `/agents` to a full conversation experience that
mirrors the RavenAIService Web chat.

### D10: `/agents` becomes a two-pane conversation workbench

Left sidebar = Agent selector (Log Analysis / Project Expert / Package Search) plus
the selected Agent's conversation history; right pane = the chat window (topbar,
message thread, composer). The template-assistant store is preserved behind a
secondary entry. Reuses RavenAIService's chat layout idioms (welcome state, user/AI
bubbles, trace stream, composer tool chips + project select + attachment + send/stop).

### D11: Reuse the backend per-user session history via a client login

Raven Client has no unified account system yet, so the workbench adds a RavenAIService
login (`POST /api/v1/users/auth/login`). The returned bearer token is persisted through
the existing `ConfigManager` RavenAIService token and reused for the authenticated
session/message/stream endpoints. With a token, the sidebar history, `fetchMessages`,
active-run resume, cancel and delete/rename/pin all match the Web client exactly.
Without a token, the panel shows a login prompt and history stays empty.

### D12: Multi-session, multi-turn conversation store

Port `conversationRuns.ts` (Pinia) to a framework-agnostic store consumed via React
`useSyncExternalStore`. State is keyed by `session_id`: messages, isSending, runStatus,
activeRunId, runAgentKind, trace, pending-resume, AbortController. Each send reuses the
session id and sends prior turns as `history`. Switching sessions loads DB messages +
queries the active-run snapshot to resume an in-flight run. Non-serialisable values
(File, AbortController) stay out of Redux by using the external store.

### D13: Agent ↔ history mapping

`ChatSessionSummary.run_agent_kind` (latest run's kind) is used to bucket sessions under
each Agent in the sidebar. A session that has never run keeps its frontend-selected
Agent. Backend kinds map: `log_analysis ↔ log-analysis`, `project_expert ↔ project-expert`,
`package_search ↔ package-search`.

## Open Questions

1. AIService token 在测试阶段的配置入口放在 General Settings 的 RavenAIService 分组，还是仅通过隐藏配置/环境变量注入？
2. 是否需要在 `/agents` 内支持 AIService 登录表单？本设计暂不做，但如果 token 分发成本高，可能需要单独 change。
3. 旧模板 Agent 的入口命名使用“模板助手”还是“普通助手”？需要产品口径。
4. Run 结束后的历史是否要同步写入 Raven Client 本地聊天历史？本设计默认不写，只保存轻量最近状态；长期可做跨端历史整合。
