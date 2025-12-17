import { loggerService } from '@logger'
import {
  DEFAULT_CONTEXTCOUNT,
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  MAX_CONTEXT_COUNT,
  UNLIMITED_CONTEXT_COUNT
} from '@renderer/config/constant'
import { UNKNOWN } from '@renderer/config/translate'
import i18n from '@renderer/i18n'
import store from '@renderer/store'
import { addAssistant } from '@renderer/store/assistants'
import type {
  Agent,
  Assistant,
  AssistantSettings,
  Model,
  Provider,
  Topic,
  TranslateAssistant,
  TranslateLanguage
} from '@renderer/types'
import { uuid } from '@renderer/utils'

const logger = loggerService.withContext('AssistantService')

export const DEFAULT_ASSISTANT_SETTINGS: AssistantSettings = {
  temperature: DEFAULT_TEMPERATURE,
  enableTemperature: true,
  contextCount: DEFAULT_CONTEXTCOUNT,
  enableMaxTokens: false,
  maxTokens: 0,
  streamOutput: true,
  topP: 1,
  enableTopP: true,
  toolUseMode: 'prompt',
  customParameters: []
}

export function getDefaultAssistant(): Assistant {
  return {
    id: 'default',
    name: '卫星基带载荷测试助手',
    emoji: '🧪',
    prompt: `# Role: 星载基站测试助手

## Profile
- 语言: 中文
- 你的名字：Raven
- 描述: 专业协助用户执行星载基站测试流程的AI助手，能够通过调用接口执行基础操作或编写Python代码实现复杂测试流程
- 背景: 专为卫星通信基站测试场景设计，熟悉各类基站接口和测试规范
- 性格: 严谨、专业、细致
- 专业知识: 卫星通信测试、自动化测试脚本编写、故障诊断
- 目标受众: 卫星通信工程师、测试工程师、系统运维人员

## Rules
1. 安全规范：
   - 在没有经过授权的情况下严格遵守沙箱执行环境限制
   - 禁止尝试突破权限限制的任何操作
   - 所有代码必须经过安全检查

2. 测试准则：
   - 确保测试流程可重复性
   - 保持测试环境一致性
   - 提供清晰的测试报告

## Workflows
- 目标: 完成用户指定的星载基站测试任务
- 步骤 1: 确认测试需求和可用工具
- 步骤 2: 设计测试方案(简单接口调用或复杂脚本)
- 步骤 3: 执行测试并监控过程
- 步骤 4: 收集和分析测试结果
- 预期结果: 提供完整的测试报告和问题诊断建议

## Ability
你具备以下能力：
1. 你可以根据用户给出的tools列表调用对应的函数来控制星载基站的一些对外接口以实现一些对基站的基础操作
2. 当用户提出一些复杂的测试流程时，在tools列表中有一个execute_python_code能力，你可以编写一段python代码并按照要求的格式返回。在这个python中你可以调用任意MCP Server中的其他tools以实现一个对星载基站的复杂操作

代码调用示例如下：
\`\`\`python
print("=== Complex Workflow Test ===")

# Step 1: Check FTP server status
print("Step 1: Checking FTP server status...")
ftp_status = mcp_tools.call('get_ftp_server_status', random_string="")
ftp_parsed = mcp_tools.parse_result(ftp_status)
print(f"FTP status: {ftp_parsed.get('status', 'unknown')}")

# Step 2: List background tasks
print("Step 2: Listing background tasks...")
tasks_result = mcp_tools.call('list_background_tasks', random_string="")
tasks_parsed = mcp_tools.parse_result(tasks_result)
task_count = len(tasks_parsed.get('tasks', {}))
print(f"Background tasks count: {task_count}")

# Step 3: Send a health check
print("Step 3: Performing health check...")
health_result = mcp_tools.call('satellite_health_check', target_ip='127.0.0.1')
health_parsed = mcp_tools.parse_result(health_result)
print(f"Health check completed")

# Step 4: Compile results
workflow_result = {
    "ftp_server_status": ftp_parsed.get('status', 'unknown'),
    "background_tasks_count": task_count,
    "health_check_performed": True,
    "workflow_status": "completed"
}

print(f"Workflow completed: {workflow_result}")
__result__ = workflow_result
\`\`\`

python代码将在一个沙箱环境中运行，权限范围如下：
\`\`\`json
{
  "sandbox_config": {
    "description": "Configuration for Python code execution sandbox",
    "security": {
      "max_execution_time": 60.0,
      "default_timeout": 30.0,
      "allow_imports": true,
      "restricted_builtins": [
        "abs", "all", "any", "bin", "bool", "chr", "dict", "dir", "divmod",
        "enumerate", "filter", "float", "format", "frozenset", "hash", "hasattr",
        "hex", "int", "isinstance", "issubclass", "iter", "len", "list",
        "map", "max", "min", "oct", "ord", "pow", "print", "range",
        "repr", "reversed", "round", "set", "slice", "sorted", "str",
        "sum", "tuple", "type", "zip", "__import__"
      ],
      "allowed_exceptions": [
        "Exception", "ValueError", "TypeError", "KeyError", "IndexError",
        "AttributeError", "RuntimeError", "ImportError", "NameError"
      ],
      "forbidden_operations": [
        "file_system_write",
        "network_access",
        "process_control",
        "system_calls",
        "module_compilation"
      ]
    },
    "allowed_modules": {
      "standard_library": [
        "json",
        "time",
        "math",
        "re",
        "random",
        "datetime",
        "asyncio",
        "traceback"
      ],
      "forbidden_modules": [
        "os",
        "sys",
        "subprocess",
        "socket",
        "urllib",
        "requests",
        "threading",
        "multiprocessing",
        "ctypes",
        "importlib"
      ]
    },
    "resource_limits": {
      "max_memory_mb": 100,
      "max_output_length": 10000,
      "max_code_length": 50000
    },
    "features": {
      "mcp_tools_interface": true,
      "stdout_capture": true,
      "stderr_capture": true,
      "return_value_support": true,
      "exception_handling": true
    }
  }
}
\`\`\`

作为星载基站测试助手，你必须遵守上述Rules，按照Workflows执行任务。`,
    topics: [getDefaultTopic('default')],
    messages: [],
    type: 'assistant',
    regularPhrases: [
      {
        content:
          '请提取${组件或板卡}日志\n问题简述： ${问题描述}\n研发定位人员姓名： ${研发人员姓名}',
        title: '日志提取',
        id: 'preset-log-collection',
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        content: '请模拟星务软件即SMU开启连续TOD发送',
        title: '开启连续TOD发送',
        id: 'preset-tod-send',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ], // Added regularPhrases
    settings: DEFAULT_ASSISTANT_SETTINGS,
    mcpServers: [
      {
        baseUrl: 'http://172.77.245.1:8090/mcp',
        description: 'Satellite gNB OAM MCP Server for debugging purposes',
        id: 'satellite-gnb-oam-debug',
        isActive: true,
        name: 'Satellite gNB OAM MCP Server(Debug)',
        provider: 'GalaxySpace',
        type: 'streamableHttp'
      }
    ]
  }
}

export function getDefaultTranslateAssistant(targetLanguage: TranslateLanguage, text: string): TranslateAssistant {
  const translateModel = getTranslateModel()
  const assistant: Assistant = getDefaultAssistant()
  assistant.model = translateModel

  if (!assistant.model) {
    logger.error('No translate model')
    throw new Error(i18n.t('translate.error.not_configured'))
  }

  if (targetLanguage.langCode === UNKNOWN.langCode) {
    logger.error('Unknown target language', targetLanguage)
    throw new Error('Unknown target language')
  }

  assistant.settings = {
    temperature: 0.7
  }

  assistant.prompt = store
    .getState()
    .settings.translateModelPrompt.replaceAll('{{target_language}}', targetLanguage.value)
    .replaceAll('{{text}}', text)
  return { ...assistant, targetLanguage }
}

export function getDefaultAssistantSettings() {
  return store.getState().assistants.defaultAssistant.settings
}

export function getDefaultTopic(assistantId: string): Topic {
  return {
    id: uuid(),
    assistantId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    name: i18n.t('chat.default.topic.name'),
    messages: [],
    isNameManuallyEdited: false
  }
}

export function getDefaultProvider() {
  return getProviderByModel(getDefaultModel())
}

export function getDefaultModel() {
  return store.getState().llm.defaultModel
}

export function getQuickModel() {
  return store.getState().llm.quickModel
}

export function getTranslateModel() {
  return store.getState().llm.translateModel
}

export function getAssistantProvider(assistant: Assistant): Provider {
  const providers = store.getState().llm.providers
  const provider = providers.find((p) => p.id === assistant.model?.provider)
  return provider || getDefaultProvider()
}

export function getProviderByModel(model?: Model): Provider {
  const providers = store.getState().llm.providers
  const providerId = model ? model.provider : getDefaultProvider().id
  return providers.find((p) => p.id === providerId) as Provider
}

export function getProviderByModelId(modelId?: string) {
  const providers = store.getState().llm.providers
  const _modelId = modelId || getDefaultModel().id
  return providers.find((p) => p.models.find((m) => m.id === _modelId)) as Provider
}

export const getAssistantSettings = (assistant: Assistant): AssistantSettings => {
  const contextCount = assistant?.settings?.contextCount ?? DEFAULT_CONTEXTCOUNT
  const getAssistantMaxTokens = () => {
    if (assistant.settings?.enableMaxTokens) {
      const maxTokens = assistant.settings.maxTokens
      if (typeof maxTokens === 'number') {
        return maxTokens > 0 ? maxTokens : DEFAULT_MAX_TOKENS
      }
      return DEFAULT_MAX_TOKENS
    }
    return undefined
  }

  return {
    contextCount: contextCount === MAX_CONTEXT_COUNT ? UNLIMITED_CONTEXT_COUNT : contextCount,
    temperature: assistant?.settings?.temperature ?? DEFAULT_TEMPERATURE,
    enableTemperature: assistant?.settings?.enableTemperature ?? true,
    topP: assistant?.settings?.topP ?? 1,
    enableTopP: assistant?.settings?.enableTopP ?? true,
    enableMaxTokens: assistant?.settings?.enableMaxTokens ?? false,
    maxTokens: getAssistantMaxTokens(),
    streamOutput: assistant?.settings?.streamOutput ?? true,
    toolUseMode: assistant?.settings?.toolUseMode ?? 'prompt',
    defaultModel: assistant?.defaultModel ?? undefined,
    customParameters: assistant?.settings?.customParameters ?? []
  }
}

export function getAssistantById(id: string) {
  const assistants = store.getState().assistants.assistants
  return assistants.find((a) => a.id === id)
}

export async function createAssistantFromAgent(agent: Agent) {
  const assistantId = uuid()
  const topic = getDefaultTopic(assistantId)

  const assistant: Assistant = {
    ...agent,
    id: assistantId,
    name: agent.name,
    emoji: agent.emoji,
    topics: [topic],
    model: agent.defaultModel,
    type: 'assistant',
    regularPhrases: agent.regularPhrases || [], // Ensured regularPhrases
    settings: agent.settings || DEFAULT_ASSISTANT_SETTINGS
  }

  store.dispatch(addAssistant(assistant))

  window.message.success({
    content: i18n.t('message.assistant.added.content'),
    key: 'assistant-added'
  })

  return assistant
}
