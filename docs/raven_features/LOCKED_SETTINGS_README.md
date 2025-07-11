# 锁定设置功能说明

## 概述

此功能允许开发者通过宏定义的方式将API密钥、API地址等设置写死在代码中，防止用户随意修改这些敏感配置。

## 主要功能

### 1. 锁定模式控制
- `LOCKED_MODE_ENABLED`: 控制是否启用锁定模式（当前设为 `true`）
- 启用后，所有用户输入将被禁用，使用预定义的值

### 2. 预定义配置

#### API密钥 (`LOCKED_API_KEYS`)
支持三个主要服务商的API密钥配置：
- DeepSeek (`deepseek`) - DeepSeek AI服务
- DashScope (`dashscope`) - 阿里云通义千问（bailian）
- Gemini (`gemini`) - Google Gemini服务

#### API地址 (`LOCKED_API_HOSTS`)
为三个主要服务商预设API端点地址

#### 其他设置 (`LOCKED_SETTINGS`)
- 功能禁用开关控制

### 3. 功能禁用控制
- `DISABLE_PROVIDER_ADDITION`: 禁止添加新的Provider
- `DISABLE_MODEL_ADDITION`: 禁止添加新的模型
- `DISABLE_API_KEY_EDITING`: 禁止编辑API密钥
- `DISABLE_API_HOST_EDITING`: 禁止编辑API地址
- `DISABLE_PROVIDER_DELETION`: 禁止删除Provider
- `DISABLE_MODEL_DELETION`: 禁止删除模型

## 修改的文件

### 1. 配置文件
- `src/renderer/src/config/locked-settings.ts` - 主配置文件

### 2. 组件文件
- `src/renderer/src/pages/settings/ProviderSettings/ProviderSetting.tsx` - Provider主设置页面
- `src/renderer/src/pages/settings/ProviderSettings/VertexAISettings.tsx` - Vertex AI设置
- `src/renderer/src/pages/settings/ProviderSettings/DMXAPISettings.tsx` - DMXAPI设置
- `src/renderer/src/pages/settings/ProviderSettings/LMStudioSettings.tsx` - LM Studio设置
- `src/renderer/src/pages/settings/ProviderSettings/index.tsx` - Provider列表页面

### 3. 翻译文件
- `src/renderer/src/i18n/locales/en-us.json` - 英文翻译
- `src/renderer/src/i18n/locales/zh-cn.json` - 中文翻译

## 使用方法

### 1. 配置API密钥
在 `src/renderer/src/config/locked-settings.ts` 中修改 `LOCKED_API_KEYS` 对象：

```typescript
export const LOCKED_API_KEYS = {
  'deepseek': 'sk-your-actual-deepseek-key',
  'dashscope': 'sk-your-actual-dashscope-key', // 通义千问
  'gemini': 'your-actual-gemini-key',
} as const
```

### 2. 配置API地址
修改 `LOCKED_API_HOSTS` 对象中的地址：

```typescript
export const LOCKED_API_HOSTS = {
  'deepseek': 'https://api.deepseek.com/',
  'dashscope': 'https://dashscope.aliyuncs.com/compatible-mode/v1/',
  'gemini': 'https://generativelanguage.googleapis.com/',
} as const
```

### 3. 启用/禁用锁定模式
修改 `LOCKED_MODE_ENABLED` 常量：

```typescript
export const LOCKED_MODE_ENABLED = true  // 启用锁定模式
// 或
export const LOCKED_MODE_ENABLED = false // 禁用锁定模式
```

### 4. 控制特定功能
修改 `LOCKED_SETTINGS` 中的功能开关：

```typescript
export const LOCKED_SETTINGS = {
  DISABLE_PROVIDER_ADDITION: true,  // 禁止添加Provider
  DISABLE_MODEL_ADDITION: true,     // 禁止添加模型
  DISABLE_API_KEY_EDITING: true,    // 禁止编辑API密钥
  DISABLE_API_HOST_EDITING: true,   // 禁止编辑API地址
  DISABLE_PROVIDER_DELETION: true,  // 禁止删除Provider
  DISABLE_MODEL_DELETION: true,     // 禁止删除模型
} as const
```

## 用户界面变化

启用锁定模式后，用户界面会有以下变化：

### Provider设置页面
1. **输入框禁用**: 所有API密钥、API地址等输入框变为只读状态，显示"(Locked)"提示
2. **按钮禁用**: 添加、删除、编辑相关按钮被禁用或隐藏
3. **搜索禁用**: Provider搜索功能被禁用，显示"Search (Disabled)"
4. **拖拽禁用**: Provider列表拖拽排序被禁用
5. **下拉菜单**: 编辑和删除选项被禁用

### 模型列表区域  
1. **模型搜索栏**: 被禁用，无法点击展开，显示禁用样式
2. **Manage按钮**: 显示为"Manage (Locked)"并被禁用
3. **模型编辑按钮**: 隐藏，无法编辑模型参数
4. **模型删除按钮**: 隐藏，无法删除单个模型
5. **删除整组按钮**: 隐藏，无法删除整个模型组
6. **模型编辑弹窗**: 不会显示，所有编辑操作被阻止

## 安全考虑

1. **敏感信息**: API密钥等敏感信息直接写在代码中，请确保：
   - 不要将包含真实API密钥的代码提交到公共仓库
   - 在生产环境部署前修改为真实的密钥
   - 考虑使用环境变量或其他安全方式管理密钥

2. **版本控制**: 建议将 `locked-settings.ts` 文件加入 `.gitignore` 或使用模板文件的方式

## 注意事项

1. 锁定模式下，所有已有的Provider设置会被自动覆盖为预定义值
2. 用户的自定义设置在禁用锁定模式后会恢复
3. 需要重启应用才能使锁定设置生效
4. 确保预定义的API密钥和地址格式正确，否则可能导致服务不可用 