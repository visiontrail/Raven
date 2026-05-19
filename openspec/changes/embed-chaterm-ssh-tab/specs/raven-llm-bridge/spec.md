## ADDED Requirements

### Requirement: Bridge IPC Surface

Raven 主进程 SHALL 暴露一组以 `raven:llm:` 为前缀的 IPC channel，作为内部子系统（首位消费者：嵌入式 Chaterm）调用 Raven 已配置 LLM 的唯一入口。该通道 MUST 包含至少以下方法：

- `raven:llm:listAvailableModels` — 返回当前用户已启用的 provider/模型列表（含 `providerId`、`modelId`、`displayName`、`capabilities`：`tools`/`vision`/`streaming`）
- `raven:llm:createMessage` — 创建一次（可流式）LLM 调用，入参包含 `systemPrompt`、`messages`、`tools?`、`modelId?`、`requestId`；返回值为 `requestId`，结果通过 `raven:llm:stream:<requestId>` 事件回推
- `raven:llm:abort` — 根据 `requestId` 中止一次进行中的调用

桥接 IPC SHALL 仅接受来自允许列表内 webContents 的调用（嵌入式 Chaterm webview 的 id 在启动时注册）；其它 sender MUST 收到 `E_BRIDGE_FORBIDDEN`。

#### Scenario: Chaterm 查询可用模型

- **WHEN** Chaterm 在启动后调用 `raven:llm:listAvailableModels`
- **THEN** 桥接 MUST 返回当前用户在 Raven 设置中启用的全部模型，且 MUST 不包含已禁用或未配置 API key 的模型

#### Scenario: 未授权 sender 调用桥接

- **WHEN** 非 Chaterm webview 的 webContents（如 miniWindow）调用 `raven:llm:createMessage`
- **THEN** 桥接 MUST 拒绝并返回错误码 `E_BRIDGE_FORBIDDEN`，不得发起任何 provider 调用

---

### Requirement: Streaming Protocol Adaptation

桥接 SHALL 把 Raven `AiProvider.completions()` 的回调/iterator 流转换为统一的事件流，事件流 MUST 按以下事件类型推送到 `raven:llm:stream:<requestId>`：

- `start` — 含 `modelId`、`createdAt`
- `text` — 含 `delta`（增量文本片段）
- `tool_use_start` — 含 `toolCallId`、`name`、`partialInput`
- `tool_use_delta` — 含 `toolCallId`、`inputJsonDelta`
- `tool_use_end` — 含 `toolCallId`、`finalInput`
- `usage` — 含 `inputTokens`、`outputTokens`、`cacheRead?`、`cacheWrite?`
- `end` — 含 `finishReason`（`stop` / `length` / `tool_use` / `abort` / `error`）、`error?`

事件 MUST 按时间顺序推送；`end` 事件之后 MUST 不再推送任何事件；同一 `requestId` MUST 不被复用。

Chaterm 侧的 `RavenBridgeHandler implements ApiHandler` SHALL 把上述事件流封装为 Chaterm 已有的 `ApiStream` async generator（`yield { type: 'text', text }` / `yield { type: 'usage', ... }` 等），从而保证 Chaterm 内 Agent loop 无需修改即可消费。

#### Scenario: 普通文本流式回复

- **WHEN** Chaterm 通过桥接发起一次纯文本对话
- **THEN** 桥接 MUST 依次推送 `start` → 多个 `text` → `usage` → `end(finishReason=stop)`，且 Chaterm 的 `ApiStream` 消费者收到的累计文本与 Raven `AiProvider` 原始返回一致

#### Scenario: 包含工具调用的流式回复

- **WHEN** 模型返回中包含一次 `tool_use`
- **THEN** 桥接 MUST 先推 `tool_use_start`，再推 0..n 次 `tool_use_delta`，再推一次 `tool_use_end` 携带完整的 `finalInput`，且 `finalInput` MUST 是合法 JSON 对象

#### Scenario: 中途中止

- **WHEN** Chaterm 在收到 `text` 事件后调用 `raven:llm:abort`
- **THEN** 桥接 MUST 取消底层 provider 调用，并在 1 秒内推送 `end(finishReason=abort)`；之后 MUST 不再推送任何事件

---

### Requirement: Model Selection & Override

`raven:llm:createMessage` 入参的 `modelId` 字段 SHALL 为可选：

- 未提供 `modelId` 时，桥接 MUST 使用 Raven 当前默认模型（与 Raven Chat 页相同的"默认模型"设置）
- 提供 `modelId` 时，桥接 MUST 校验该模型在 `listAvailableModels` 返回集合中，否则返回错误 `E_MODEL_NOT_AVAILABLE`
- 桥接 MUST 不允许调用方直接传入 API key、base URL 或 provider 凭证；所有凭证 MUST 来自 Raven 设置中的 provider 配置

#### Scenario: 不指定模型

- **WHEN** Chaterm 调用 `createMessage` 未指定 `modelId`
- **THEN** 桥接 MUST 选择 Raven "默认对话模型" 进行调用

#### Scenario: 指定不存在的模型

- **WHEN** Chaterm 传入 `modelId = "fake-model-x"`
- **THEN** 桥接 MUST 立即返回错误 `E_MODEL_NOT_AVAILABLE`，且 MUST 不创建任何 provider 调用

#### Scenario: 调用方尝试自带凭证

- **WHEN** 调用方在 `createMessage` 入参中携带 `apiKey` / `baseURL` 字段
- **THEN** 桥接 MUST 忽略该字段（不报错），并在日志中打 `warn`，使用 Raven 设置中的凭证

---

### Requirement: Chaterm Provider Registration

Chaterm 主进程 SHALL 在 `src/main/agent/api/index.ts` 的 `buildApiHandler()` 工厂中注册新的 provider key `raven-bridge`，并 SHALL 在嵌入模式下把 Chaterm 默认 `apiProvider` 设置为 `raven-bridge`，覆盖 Chaterm 自身存储中的 provider 配置。

嵌入模式由环境变量 `CHATERM_EMBEDDED=1` 标识，由 Raven 主进程在加载 Chaterm webview 时通过 `additionalArguments` 注入。

#### Scenario: 嵌入模式下创建 ApiHandler

- **WHEN** Chaterm 在 `CHATERM_EMBEDDED=1` 环境下启动并构建 ApiHandler
- **THEN** `buildApiHandler()` MUST 返回 `RavenBridgeHandler` 实例，且 MUST 不读取 Chaterm 自有的 provider 凭证

#### Scenario: 独立模式（非嵌入）启动

- **WHEN** Chaterm 在没有 `CHATERM_EMBEDDED` 的环境下被独立打包运行（开发或单独发布）
- **THEN** `buildApiHandler()` MUST 走原有 provider 分支逻辑，`raven-bridge` provider 不可用

---

### Requirement: Settings UI Surface in Embedded Mode

Chaterm 渲染层在嵌入模式下 MUST 隐藏或锁定以下 UI：

- 模型 / Provider 选择下拉
- API key / base URL / 自定义 endpoint 输入
- "登录 Chaterm 账号"、"切换 edition (cn/global)" 等账号相关入口

并 SHALL 在 Chaterm 设置页对应位置显示只读说明（如 "已使用 Raven 配置的模型，请在 Raven 设置中修改"），并提供按钮跳转到 Raven 设置页（通过 `raven:ui:navigate` IPC）。

#### Scenario: 嵌入模式下打开 Chaterm 设置

- **WHEN** 用户在嵌入模式下打开 Chaterm 设置页
- **THEN** Provider 配置区 MUST 不可编辑，并显示只读说明与跳转按钮

#### Scenario: 点击跳转按钮

- **WHEN** 用户点击 Chaterm 设置页的"前往 Raven 设置"按钮
- **THEN** Raven 主窗口路由 MUST 切换到 `/settings/providers`，Terminal 标签退到后台

---

### Requirement: Observability & Token Accounting

桥接 SHALL 把每一次 `createMessage` 的 `usage` 事件同步记录到 Raven 现有的 token 统计 / 调用日志系统，记录中 MUST 标注 `source = "chaterm"`，以便用户在 Raven 用量页中能看到 Chaterm 触发的消耗。

桥接 SHALL 在 `info` 级别记录 `requestId`、`modelId`、`source`、`finishReason`、`durationMs`；MUST 不记录消息正文。

#### Scenario: Chaterm 触发的调用计入用量

- **WHEN** Chaterm 通过桥接完成一次调用
- **THEN** Raven 用量页 SHALL 显示一条 `source=chaterm` 的记录，token 计数与本次 `usage` 事件一致

#### Scenario: 日志不泄露消息内容

- **WHEN** 调试日志开启
- **THEN** `info` / `debug` 级别日志 MUST 不包含 `messages` / `systemPrompt` 的原文，只允许记录长度、role 序列、modelId 等元信息
