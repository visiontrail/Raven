## 1. AIService 配置与契约

- [x] 1.1 在 `ConfigManager` 中补齐 RavenAIService Agent 工作台所需配置读取：host、port、baseUrl、可选测试 token
- [x] 1.2 在 `packages/shared/IpcChannel.ts` 新增 RavenAIService 配置读取/更新 IPC channel
- [x] 1.3 在 `src/main/ipc.ts` 注册 RavenAIService 配置 IPC handler，返回净化后的 `{ host, port, baseUrl, hasToken }`
- [x] 1.4 在 `src/preload/index.ts` 暴露 `window.api.ravenAIService`，包含 `getConfig()` 与测试 token 更新能力
- [x] 1.5 在 General Settings 或 Agents 工作台中展示当前 RavenAIService 本地 IP base URL，默认使用现有 `172.16.9.224:8085` 回落逻辑

## 2. AIService API Client 与类型

- [x] 2.1 新增 `src/renderer/src/types/aiServiceAgent.ts`，定义 `AIServiceAgentKind`、`AgentTraceEvent`、`ProjectRepoOption`、run 状态与 SSE payload 类型
- [x] 2.2 新增 `src/renderer/src/services/AIServiceAgentClient.ts`，集中封装 base URL、Authorization header、错误解析与 fetch 调用
- [x] 2.3 实现 `listProjectRepos()` 调用 `GET /api/v1/project-repos?limit=200`
- [x] 2.4 实现 `startLogAnalysisRun()`，用 multipart form 调用 `POST /api/v1/ai-chat/log-analysis/stream`
- [x] 2.5 实现 `startProjectExpertRun()`，用 multipart form 调用 `POST /api/v1/ai-chat/project-expert/stream`
- [x] 2.6 实现 `cancelRun()`，优先调用 `/api/v1/ai-chat/chat/runs/{run_id}/cancel`，缺少 `run_id` 时回退到 session cancel endpoint
- [x] 2.7 实现 `getRunResult()` 兜底查询 log-analysis/project-expert result endpoint
- [ ] 2.8 单元测试覆盖 base URL 构建、Authorization header、multipart 字段、401/403 错误解析、本地服务不可达错误

## 3. SSE Parser 与 Run 状态机

- [x] 3.1 新增 SSE parser 工具，支持按 `\n\n` 分帧、解析 `data:` JSON、处理 CRLF、忽略空 frame
- [x] 3.2 新增 `applyAIServiceAgentEvent()`，处理 `session_id`、`run_id`、`agent_trace`、`answer_delta`、`done`、`run_complete`、`cancelled`、`error`
- [x] 3.3 新增 Agent run hook 或 Redux slice，维护 `idle/running/succeeded/failed/cancelled/stale` 状态、消息、trace、当前文件、当前项目、AbortController
- [x] 3.4 支持 SSE 提前断开时保留 `sessionId/runId`，将 run 标记为可恢复或可查询
- [x] 3.5 支持 retry：失败或取消后复用同一 Agent 类型、message、projectRepoId 与 file
- [ ] 3.6 单元测试覆盖 answer delta 拼接、trace 追加、terminal 状态、取消竞态、SSE 半包、断流恢复状态

## 4. Agents 工作台 UI

- [x] 4.1 重构 `src/renderer/src/pages/agents/AgentsPage.tsx` 为 AIService Agent 工作台容器
- [x] 4.2 新增 Agent 切换控件：Log Analysis、Project Expert、模板助手入口
- [x] 4.3 新增连接状态条，展示本地 AIService base URL、项目列表加载状态、连接错误和重试按钮
- [x] 4.4 新增项目仓库选择器，展示 `project_name`、`project_code`、`default_branch`、`description`
- [x] 4.5 新增 Log Analysis 输入区，支持日志文件/归档选择、文件名/大小展示、移除文件、默认问题
- [x] 4.6 新增 Project Expert 输入区，提交前强制校验项目仓库已选择
- [x] 4.7 新增回答区，流式渲染 Agent 最终答案并复用现有 Markdown 渲染能力
- [x] 4.8 新增 trace 面板，按时间展示 run_start、tool step、thinking、system_notice、run_complete/cancelled/error
- [x] 4.9 新增运行控制按钮：发送、取消、重试、刷新项目列表
- [x] 4.10 保留现有普通 Agent 模板入口，确保用户 Agent 数据、导入、添加、管理、创建 Assistant 行为仍可访问
- [ ] 4.11 组件测试覆盖项目必选、文件保留、取消按钮状态、模板入口可达、连接错误展示

## 5. 本地 RavenAIService 验证

- [ ] 5.1 启动本地 IP RavenAIService，确认 `http://172.16.9.224:8085` 或配置 IP 可访问
- [ ] 5.2 用测试 token 验证 `GET /api/v1/project-repos` 在 Raven Client 工作台中返回项目列表
- [ ] 5.3 手动运行 Project Expert：选择项目、提交问题、看到 answer_delta、trace、terminal done
- [ ] 5.4 手动运行 Log Analysis：上传日志文件、可选项目、提交分析、看到 trace 与最终答案
- [ ] 5.5 手动验证取消：在 run 运行中点击取消，确认 run 状态变为 cancelled，后端不继续输出
- [ ] 5.6 手动验证本地服务不可达、token 无效、项目缺失、SSE 中断时的错误提示

## 6. 质量门禁

- [x] 6.1 运行 `yarn typecheck:web`，修复新增 React/TypeScript 类型问题
- [ ] 6.2 运行相关 renderer 单元测试，至少覆盖 AIService client、SSE parser、run 状态机、AgentsPage 关键 UI
- [ ] 6.3 运行 `yarn check:i18n`，确保新增文案有中英文 key 或符合现有 i18n 约定
- [ ] 6.4 更新 `AGENTS.md` 或 Raven Client 文档，说明 Agents 工作台复用本地 IP RavenAIService，TypeScript SDK 本地 Agent loop 不在本阶段
