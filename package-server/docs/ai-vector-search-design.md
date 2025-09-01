# Package Server 向量搜索（RAG-lite）需求与设计说明

本文档定义在 Package Server 中基于现有关键字检索之上的“AI 向量搜索”能力，用于支持模糊与自然语言检索；并描述其总体架构、接口、数据流与实施计划。文档将随实现过程持续更新。

---

## 1. 背景与目标
- 现有搜索以关键字匹配为主，难以覆盖语义相近但表述不同的检索需求（如“图像处理”≈“图片编辑/滤镜/视觉处理”）。
- 引入向量检索（RAG-lite）以提升检索召回与排序质量，支持自然语言查询与模糊匹配。
- 兼容并保留原有关键字搜索；前端新增“AI 搜索/向量搜索”入口，用户可自由切换。

目标：
- 为 metadata 中每个包生成稳定的语义向量；
- 提供高质量、低时延的相似度检索接口；
- 可离线运行（本地模型）或在线（第三方 API），可配置、可扩展。

非目标（初期）：
- 不做跨文档多轮对话与答案生成；
- 不提供端到端 RAG 回答，仅做语义检索与结果排序。

---

## 2. 关键文件
- 元数据文件：`package-metadata.json`（所有包数据统一存储），由服务在运行时读写与更新。
  - 当该元数据文件更新时，需要更新向量数据库
  - 该元数据文件是标准的json格式，文档切分直接按照一个json数据块切分即可
  - 实例如下：

```json
[
  {
    "id": "3a9ef06d-52f9-4c1f-83bd-e4c916417412",
    "name": "GalaxySpace-Lx10-2025Aug21-1224-V1006-Patch.tgz",
    "version": "1.0.0.6",
    "packageType": "lingxi-10",
    "size": 2311733,
    "createdAt": "2025-08-21T04:24:20.713Z",
    "metadata": {
      "isPatch": true,
      "components": [
        "oam",
        "cucp",
        "cuup",
        "du"
      ],
      "description": "这是一个测试包",
      "tags": [
        "Tags-1",
        "标签1"
      ],
      "customFields": {}
    },
    "path": "/app/uploads/GalaxySpace-Lx10-2025Aug21-1224-V1006-Patch.tgz"
  },
  {
    "id": "d87bb6e9-8c1d-42e5-90ca-5e7c72ae570f",
    "name": "GalaxySpace-Lx10-2025Jul29-1348-V1025.tgz",
    "path": "/app/uploads/GalaxySpace-Lx10-2025Jul29-1348-V1025.tgz",
    "size": 136584794,
    "createdAt": "2025-08-22T06:31:16.590Z",
    "packageType": "lingxi-10",
    "version": "10",
    "metadata": {
      "isPatch": "false",
      "components": "[]",
      "description": "",
      "tags": "[]",
      "sha256": "90c7b3c2bab17c64ce09fa977af5575b04b601ce69abe5916f5d32f734450c6d",
      "customFields": {}
    }
  }
]
```

## 3. 需求说明
### 3.1 功能需求
1. 向量化
   - 对每个包构建文本表示（如：name + description + tags + 其他关键信息）。
   - 生成并持久化语义向量；支持增量更新（仅更新新增/变更的包）。
2. 检索接口
   - 新增 API：根据自然语言 query 返回 TopK 语义最相近的包，附带相似度分数。
   - 支持可选过滤（如标签、平台），若后续 metadata 已有结构化字段可直接复用。
3. 前端交互
   - 在现有搜索框旁新增“AI 搜索/向量搜索”入口；
   - 支持 Loading、无结果、错误状态展示；
   - 结果列表与现有 UI 风格一致，可显示匹配理由（简要片段或高亮字段）。
   - 当用户点击AI搜索后，弹出一个简单的ChatBot窗口，该窗口会以流的方式输出大模型的检索结果
   - 提供一个“继续提问”的按钮，点击后显示输入框和发送按钮允许用户继续根据结果提问
4. 降级与容错
   - 当向量服务不可用时，自动回退至原关键字检索；
   - 允许在配置层面关闭/隐藏“AI 搜索”。

### 3.2 非功能需求
- 时延：P50 < 150ms（小规模、内存索引、无外部网络）；
- 资源：内存向量索引 <= 数十 MB（随规模增长优化）；
- 可观测：关键日志、QPS、成功率与时延分布；
- 可配置：本地/在线模型切换、TopK、向量维度、阈值等。

### 3.3 安全与隐私
- 若使用第三方 API（如 OpenAI/HF），需显式提示并通过配置开启；
- 不上传敏感信息；仅发送用于向量化的必要文本字段；
- 严禁在日志中输出密钥；密钥通过环境变量注入。

---

## 4. 方案概述
- 嵌入生成（Embedding）
  - 使用第三方Embedding API，
- 前后端交互
  - 前端（public/index.html + public/app.js）调用 Node 代理接口：
    - `POST /api/ai/search` 发送 { question, filters }，返回 { hits, answer? }
    - `GET /api/ai/chat/stream?question=...&ids=...` 通过 SSE 接收流式回答
  - Node 服务新增 `src/routes/ai.js` 作为代理层，转发到 Python 服务：
    - `AI_SERVICE_URL` 通过环境变量配置（默认 `http://localhost:9090`）
    - 统一错误处理与鉴权注入（如需要）
  - Python FastAPI 提供实际 RAG 能力：
    - `POST /rag/search` 返回命中的包列表与可选答案
    - `GET /rag/chat/stream` 返回 SSE 流式回答
- 索引与检索
  - V1：小规模数据，暴力余弦相似度（精确、实现简单）；
  - V2：规模扩大后，引入 HNSW 近似检索（如 hnswlib 绑定）
- 存储
  - 初期：`embeddings.json`（包含版本、维度、更新时间、items 列表）；
  - 可平滑迁移至 sqlite/LevelDB，以支持更大规模与并发。
- Python Server
  - 运行一个Python server用于和前端界面以及大模型API进行交互
  - 该Python Server依赖langchain框架对接大模型

---

## 5. 数据模型与文件
- 元数据文件：`data/package-metadata.json`
- 向量存储（初稿建议）：`data/package-embeddings.json`
  ```json
  {
    "version": 1,
    "dimension": 384,
    "updatedAt": "2025-01-01T00:00:00.000Z",
    "items": [
      {
        "id": "<package-id>",
        "hash": "<content-hash>",
        "vector": [0.01, 0.23, ...],
        "fields": {
          "name": "...",
          "description": "...",
          "tags": ["..."],
          "author": "..."
        }
      }
    ]
  }
  ```
- hash 用于检测包内容是否变化（避免重复向量化）。

---

## 6. 文本构建与向量化策略
- 拼接字段：`name + "\n" + description + "\n" + tags.join(",") + 可选额外字段`。
- 维度：随模型而定（384/512/768/1536 等），通过配置读取。
- 归一化：持久化前对向量进行 L2 归一化，便于余弦计算与阈值稳定。
- 质量保障：
  - 对过长文本进行裁剪或摘要，避免超限；
  - 保留原字段用于前端展示片段。

---

## 7. 更新与重建流程
- 启动时：
  - 若无向量文件或其更新时间早于 `package-metadata.json`，触发异步重建；
  - 重建期间对外正常服务（查询命中老索引或回退关键字）。
- 运行时：
  - 当包新增/更新时，仅对变更项执行向量化并写回索引；
  - 失败任务记录并重试，设置最大重试次数与退避策略。

---

## 8. API 设计（初稿）
- `POST /api/search/ai`
  - Request Body：
    ```json
    { "query": "自然语言描述", "topK": 20, "filters": { "tags": ["..." ] } }
    ```
  - Response：
    ```json
    {
      "queryVector": [ ... ],
      "results": [
        { "id": "...", "score": 0.82, "name": "...", "description": "...", "tags": ["..."] }
      ]
    }
    ```
- `GET /api/search`（保留现有关键字搜索）
- `GET /api/search/health`（可选）返回索引状态/维度/更新时间等。

错误码与语义：
- 429（外部 API 限频）、503（向量服务暂不可用）、500（未知错误）。

---

## 9. 前端交互与 UX
- 在现有搜索输入框旁新增“AI 搜索”按钮；
- 点击后：
  - 触发 `/api/search/ai` 请求；
  - 显示 Loading 与错误提示；
  - 结果列表展示与现有样式一致，附相似度分数（可隐藏或用“匹配度高/中/低”标签显示）。
- 可选：提供“关键字/AI”切换 Tab；或在一个输入框中通过按钮切换模式。
- 当后端报告不可用时，按钮置灰并给出说明。

---

## 10. 排序与融合（可选增强）
- 融合检索：同时计算关键字 BM25 与向量相似度，采用 RRF 或线性加权得到最终排序；
- 适用场景：既要确保关键字段强匹配，又要兼顾语义召回。

---

## 11. 可配置项与运维
- `.env`（示例）：
  ```ini
  AI_SEARCH_ENABLED=true
  EMBEDDING_PROVIDER=local|openai|huggingface
  EMBEDDING_MODEL=text-embedding-3-small
  EMBEDDING_DIM=1536
  OPENAI_API_KEY=...
  HF_API_KEY=...
  VECTOR_FILE=./data/package-embeddings.json
  TOPK_DEFAULT=20
  SCORE_THRESHOLD=0.3
  ```
- 日志：向量文件加载/重建、向量化耗时、查询时延、命中率、错误码分布。

---

## 12. 测试计划
- 单元测试：
  - 文本构建、哈希、向量归一化与相似度计算；
  - 增量更新逻辑（仅更新变更包）。
- 集成测试：
  - 启动时重建、失败重试、降级回退；
  - API 语义检索结果 TopK 稳定性与阈值过滤。
- 前端 E2E：
  - 按钮交互、加载/错误态、结果渲染与排序一致性。

---

## 13. 实施计划（迭代）
- M1（落地最小可用）：
  1) 定义文本构建与向量存储格式；
  2) 接入一种可用嵌入方案（本地或在线，优先在线以加快验证）；
  3) 首版 `/api/search/ai` + 前端按钮；
  4) 小规模数据上通过暴力余弦检索返回 TopK。
- M2（工程化与增量）：
  1) 增量更新、启动重建、失败重试；
  2) 健康检查与基础监控；
  3) 配置化阈值/维度/TopK。
- M3（质量与扩展）：
  1) 融合检索排序；
  2) HNSW 近似检索（视规模与性能需求）；
  3) 更丰富的前端展示与筛选。

---

## 14. 风险与应对
- 外部 API 风险：限频/费用/网络抖动 → 本地模型兜底 + 缓存；
- 模型质量差异：模型可配置，允许替换升级；
- 索引膨胀：转存至 sqlite/LevelDB 或引入近似索引；
- 元数据突变：通过 hash 与时间戳严谨检测与重建。

---

## 15. 开放问题（待定）
- 嵌入提供方的最终选型与默认模型？
- 前端是否展示相似度分数，采用何种文案？
- 是否需要多语言支持（中/英）与跨语言检索？
- package 粒度是否需要拆分为片段级（chunk）以提升长描述的召回？

---

本文档为可演进的设计说明，后续将根据实现与评审持续更新。