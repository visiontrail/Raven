## Why

Raven Client 的 Agents 选项卡当前只是“提示词/助手模板商店”：用户点击 Agent 后会创建一个普通 Assistant，并不会进入 RavenAIService 已经具备的真实专业 Agent 工作流。RavenAIService 现有“日志分析”和“项目专家”已经具备 Claude Agent SDK loop、项目仓库上下文、SSE trace、取消与结果持久化，测试阶段应优先复用这条成熟链路，而不是在 Client 内重复实现 Agent runtime。

## What Changes

- 将 Raven Client 的 `/agents` 从模板列表改造成 **AIService Agent 对话工作台**，提供“日志分析”“项目专家”“包检索”三个 Agent 入口。
- 工作台采用与 RavenAIService Web 端一致的双栏布局：左侧边栏选择 Agent 并列出该 Agent 的历史会话，右侧为完整对话窗口（连续多轮对话、项目仓库选择、附件上传、流式回答与 Agent trace）。
- 由于 Raven Client 当前没有与服务端一致的用户登录体系，本变更新增 RavenAIService 登录（`POST /api/v1/users/auth/login`），登录后复用后端按用户的会话历史与消息接口，使会话历史与 Web 端完全一致。
- 工作台通过 RavenAIService 本地 IP 地址访问后端；测试阶段默认复用现有 `ConfigManager.getRavenAIServiceHost()` / `getRavenAIServicePort()` 配置（当前未配置时回落到局域网 IP `10.60.11.3:8085`），不接生产云端服务。
- 新增 Raven Client 侧 AIService API 客户端，支持：
  - `POST /api/v1/ai-chat/log-analysis/stream`
  - `POST /api/v1/ai-chat/project-expert/stream`
  - `POST /api/v1/ai-chat/*/cancel`
  - `GET /api/v1/ai-chat/*/result`
  - 统一 run 订阅与取消接口（在后端返回 `run_id` 后使用 `/chat/runs/{run_id}/stream|cancel`）。
- 新增 Agents 工作台 UI：左栏 Agent 选择 + 历史会话列表（按 Agent 过滤、新建会话、选择/删除/重命名会话），右栏对话窗口（连续多轮对话、项目仓库选择、日志文件上传、问题输入、流式回答、Agent trace、运行状态、取消/重试、错误提示）。
- 连续对话：每轮发送时携带历史消息，单个会话内可多轮提问；切换会话时载入该会话历史并可续聊；运行中切走再切回可通过 active-run 快照恢复订阅。
- 项目专家与包检索必须选择 AIService 中登记的项目仓库；日志分析支持上传日志包，并可选关联项目仓库。
- 保留现有“添加/导入普通 Agent 模板”的数据与能力，但不再作为 `/agents` 首屏主体验；迁移为次级入口或“模板助手”分区。
- **不做** Client 内 Claude Agent SDK TypeScript agent loop；本变更只复用 RavenAIService。

## Capabilities

### New Capabilities

- `aiservice-agent-workbench`: Raven Client 的 Agents 选项卡作为远程 RavenAIService Agent 工作台，能通过本地 IP AIService 运行日志分析与项目专家 Agent，并展示 SSE trace、回答、状态与取消操作。

### Modified Capabilities

<!-- 无现有 specs；本次以新 capability 定义完整行为。 -->

## Impact

- **Raven Client Renderer**：
  - `src/renderer/src/pages/agents/AgentsPage.tsx`：重做为 Agent 工作台页面。
  - 新增 `src/renderer/src/pages/agents/aiservice-*` 相关组件、hooks/store：会话状态、SSE 解析、trace 展示、文件上传、项目选择。
  - 复用现有 Markdown 渲染、文件选择、通知、主题/i18n 体系。
- **Raven Client Main/Preload**：
  - `src/main/services/ConfigManager.ts` 已有 RavenAIService host/port 配置，需要暴露给 renderer 或新增专用 IPC/API。
  - `packages/shared/IpcChannel.ts`、`src/preload/index.ts` 可能新增 AIService 配置读取/更新通道。
- **RavenAIService API 依赖**：
  - 依赖 AIService 已实现的 log-analysis / project-expert stream、cancel、result、project repo list，以及鉴权。
  - 测试阶段使用本地局域网 IP 运行的 RavenAIService，避免生产环境偶然调用。
- **数据/状态**：
  - Client 侧保存轻量 UI 状态（最近选择的 Agent、项目仓库、会话 run 信息），最终 Agent 执行结果仍由 AIService 持久化。
- **测试**：
  - 单元测试覆盖 SSE parser、状态机、错误与取消。
  - 组件测试覆盖两类 Agent 的输入约束。
  - 手动/集成测试连接本地 IP AIService，验证日志分析上传与项目专家问答闭环。
