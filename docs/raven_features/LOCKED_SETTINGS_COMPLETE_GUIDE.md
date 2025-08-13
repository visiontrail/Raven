# 锁定设置完整功能指南

## 概述

此功能允许开发者通过宏定义的方式将API密钥、API地址等设置写死在代码中，防止用户随意修改这些敏感配置。同时提供了完整的模型列表锁定功能，确保企业环境下管理员可以完全控制模型配置。

## 主要功能

### 1. 锁定模式控制
- `LOCKED_MODE_ENABLED`: 控制是否启用锁定模式（当前设为 `true`）
- 启用后，所有用户输入将被禁用，使用预定义的值

### 2. 预定义配置

#### API密钥 (`LOCKED_API_KEYS`)
支持三个主要服务商的API密钥配置：
- **DeepSeek** (`deepseek`) - DeepSeek AI服务
- **DashScope** (`dashscope`) - 阿里云通义千问（bailian）
- **Gemini** (`gemini`) - Google Gemini服务

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

## 配置优化

### 简化Provider配置
**优化前：** 支持15+个Provider，包括许多未使用的服务
**优化后：** 只保留3个主要Provider：
- **DeepSeek** (`deepseek`) - 主要AI服务
- **DashScope** (`dashscope`) - 阿里云通义千问（对应bailian）
- **Gemini** (`gemini`) - Google AI服务

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

## 模型配置管理

### 修改默认模型列表

#### 1. 修改模型配置文件
在 `src/renderer/src/config/models.ts` 中修改 `SYSTEM_MODELS` 对象：

```typescript
export const SYSTEM_MODELS = {
  // 阿里云百炼提供商的默认模型
  bailian: [
    'qwen-plus'  // 只保留qwen-plus模型
  ],
  // 其他提供商配置...
}
```

#### 2. 强制更新现有配置

如果用户之前运行过程序并将模型配置保存到本地，需要通过版本迁移来强制更新：

**步骤1：** 在 `src/renderer/src/store/migrate.ts` 中添加新的迁移版本：

```typescript
'125': (state: RootState) => {
  try {
    // 强制更新阿里云百炼提供商的模型列表
    if (state.llm && state.llm.providers) {
      state.llm.providers = state.llm.providers.map(provider => {
        if (provider.id === 'bailian' || provider.id === 'dashscope') {
          return {
            ...provider,
            models: SYSTEM_MODELS.bailian || []
          }
        }
        return provider
      })
    }
    return state
  } catch (error) {
    return state
  }
}
```

**步骤2：** 在 `src/renderer/src/store/index.ts` 中更新版本号：

```typescript
const persistedReducer = persistReducer(
  {
    key: 'cherry-studio',
    storage,
    version: 125, // 从124升级到125
    blacklist: ['runtime', 'messages', 'messageBlocks'],
    migrate
  },
  rootReducer
)
```

#### 3. 迁移机制说明

- **自动触发**: 当用户重新启动应用时，Redux Persist会检测到版本号变化，自动触发迁移
- **强制更新**: 迁移函数会遍历所有已保存的提供商配置，强制更新指定提供商的模型列表
- **安全性**: 即使用户之前保存了包含多个模型的配置，也会被自动覆盖为新的代码配置

## 用户界面变化

启用锁定模式后，用户界面会有以下变化：

### Provider设置页面
1. **输入框禁用**: 所有API密钥、API地址等输入框变为只读状态，显示"(Locked)"提示
2. **按钮禁用**: 添加、删除、编辑相关按钮被禁用或隐藏
3. **搜索禁用**: Provider搜索功能被禁用，显示"Search (Disabled)"
4. **拖拽禁用**: Provider列表拖拽排序被禁用
5. **下拉菜单**: 编辑和删除选项被禁用

### 模型列表区域  
1. **模型搜索栏**: 
   - 搜索图标变为灰色禁用状态
   - 无法点击展开搜索框
   - 提示文本显示"Search (Disabled)"

2. **模型管理按钮**: 
   - 按钮文本变为"Manage (Locked)"或"管理（已锁定）"
   - 按钮被禁用，无法点击

3. **模型操作按钮**: 
   - 编辑按钮（闪电图标）完全隐藏
   - 删除按钮（减号图标）完全隐藏
   - 删除整组按钮完全隐藏

4. **模型编辑弹窗**: 
   - 不会显示任何模型编辑对话框
   - 所有编辑操作被完全阻止

## 修改的文件

### 1. 配置文件
- `src/renderer/src/config/locked-settings.ts` - 主配置文件
- `src/renderer/src/config/models.ts` - 模型配置文件
- `src/renderer/src/store/migrate.ts` - 数据迁移文件
- `src/renderer/src/store/index.ts` - Redux持久化配置

### 2. 组件文件
- `src/renderer/src/pages/settings/ProviderSettings/ProviderSetting.tsx` - Provider主设置页面
- `src/renderer/src/components/ModelList/ModelList.tsx` - 模型列表组件
- `src/renderer/src/components/ModelList/ModelListSearchBar.tsx` - 模型搜索栏组件
- 其他相关Provider设置组件

### 3. 翻译文件
- `src/renderer/src/i18n/locales/en-us.json` - 英文翻译
- `src/renderer/src/i18n/locales/zh-cn.json` - 中文翻译