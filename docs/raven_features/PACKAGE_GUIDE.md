# 包管理端到端数据流分析

下面是从"点击 Start Packing 到列表/详情展示"的端到端数据流分析，以及持久化与扩展方案。

## 一、点击 Start Packing 后的端到端流程（时序）

1. **Renderer（Packager 页面）收集配置并发起打包**
   - 在 `PackageTab.tsx` 中，点击"Start Packing"后会执行 `handleStartPackaging`
   - 构建 config（package_type、package_version、is_patch、selected_components 等）
   - 调用 `window.api.packager.createPackage(config)`
   - 你可以在该文件 205-262 行看到这段逻辑

2. **IPC 路由到主进程**
   - 主进程在 `ipc.ts` 中注册了 `IpcChannel.Packager_CreatePackage` 的处理器
   - 收到调用后委托到打包服务

3. **主进程完成打包并生成包文件**
   在 `packagingService.ts` 的 `handleCreatePackage` 中：
   - 将所选组件按规则处理，生成 si.ini
   - 在系统临时目录构建工作区并打成 .tgz 包，输出到 Downloads 目录
   - 调用 `extractMetadataFromTGZ(outputPath)` 解析生成的包文件，得到一个 Package 对象（包含 id、name、path、size、createdAt、packageType、version、metadata 等）
   - 将该 Package 对象写入两个地方：
     - 添加到 packagingService 自身的内存 Map（仅内存）
     - 更重要：调用 `packageService.addPackage(packageInfo)` 持久化

4. **持久化存储**
   - 在 `PackageService.ts` 中，`addPackage` 会把包信息放入内存 Map 并写入磁盘 JSON（见下文"持久化"）

5. **Renderer（Files 页面）展示**
   - 列表页 `PackageListView.tsx` 使用自定义 Hook `usePackages.ts`
   - 该 Hook 在挂载时会调用 `window.api.package.getAll()` 取所有包，并填充 packages 状态
   - 列表项点击后将选中的 Package 作为 props 传给 `PackageDetailView.tsx` 展示详情

## 二、PackageListView 如何拿到包并显示

1. **取数入口**
   - `usePackages.ts` 中的 `fetchPackages()` 调用 `window.api.package.getAll()`

2. **IPC 到主进程**
   - `ipc.ts` 将 `Package_GetAll` 路由到 `packageService.getPackages()`

3. **主进程返回数据**
   - `PackageService.ts` 的 `getPackages()` 会返回内存 Map 中的包（并会顺便剔除磁盘上已不存在的文件，然后保存最新元数据）

4. **列表渲染**
   - `PackageListView.tsx` 使用 packages 渲染表格列（name、packageType、version、size、createdAt、是否补丁等）

## 三、PackageDetailView 如何拿到并展示"基本信息"

1. **传参方式**
   - 在列表中点击某项后，选中的 Package 作为 prop 传递给 `PackageDetailView.tsx`
   - 父组件通过 `setSelectedPackage(record)` 将对象传入

2. **展示字段**
   - 该页面展示了 name、packageType、version、size、createdAt、path 等基本信息
   - 同时还展示 metadata 中的 isPatch、components、description、tags
   - 并提供编辑入口（编辑后会自动保存）

## 四、这些基本信息是否被持久化存储？

**是，被持久化到 JSON 文件。**

### 存储位置
- 应用的 userData 目录下的 `package-metadata.json`
- 具体见 `PackageService.ts` 构造函数：它通过 Electron `app.getPath('userData')` 拼出 metadataFilePath，并在 load/save 时读写该 JSON

### 存储时间点
1. **打包完成后**
   - `handleCreatePackage` 会调用 `packageService.addPackage(packageInfo)`
   - 而 `addPackage` 在成功后会立即 `savePackageMetadata()` 写入磁盘

2. **在详情页编辑元数据时**
   - `usePackages.ts` 的 `updatePackageMetadata()` 走 IPC 到 `packageService.updatePackageMetadata()`
   - 该方法更新内存 Map 后立即 `savePackageMetadata()`，因此编辑也会持久化

3. **删除包时**
   - `deletePackage()` 会删除磁盘文件并更新 JSON

### 包基础信息的来源
- `packageUtils.ts` 的 `extractMetadataFromTGZ(filePath)` 会从文件路径和文件名推断 packageType、version、components、isPatch，并结合文件 stats（size、createdAt）生成 Package 对象
- metadata 初始值包含 isPatch、components、description、tags、customFields
- 类型定义见 `package.ts`

## 五、能否在打包阶段传入"额外的包数据"并显示在 PackageDetailView？

**可以，推荐通过 metadata.customFields 传递与展示。**

当前类型已经内置 `customFields: Record<string, any>`，无需改动类型即可扩展。

### 实现机制（整包生成：基于 si.ini FileAttr 的组件回填与持久化）

- 适用场景：生成“整包”时，组件来源以 si.ini 的 `FileAttr` 为准，并回填到 `metadata.components` 持久化保存。

1. 打包阶段写入 FileAttr
   - 在打包服务 `packagingService.ts` 的 `generateSiIni` 中，根据所选包型号与组件配置 `COMPONENT_CONFIGS` 生成 `si.ini`；每个组件节的 `FileAttr` 来自对应配置的 `file_attr`。

2. 打包完成后回填 components
   - 在 `handleCreatePackage` 中，创建 tgz 成功后、入库前，读取刚生成的 `si.ini` 并解析所有 `FileAttr`。
   - 依据 `COMPONENT_CONFIGS` 进行反查，得到组件名称列表，写入 `packageInfo.metadata.components`；同时设置 `packageInfo.metadata.isPatch`（整包为 `false` 或按传入类型判断）。
   - 如前端传入了额外字段（如 `extraFields`），会合并到 `packageInfo.metadata.customFields`（可选，不影响本机制）。

3. 持久化与内存同步
   - 调用 `packageService.addPackage(packageInfo)` 将元数据写入用户数据目录的 `package-metadata.json`，并同步更新 `PackagingService` 的内存 Map，供前端消费。

4. 兜底策略
   - 若解析 `si.ini` 失败或 `FileAttr` 无法匹配组件：
     - 首先回退到 `config.selected_components`；
     - 若仍为空，则回退到 `packageUtils.ts` 的文件名关键字推断（`extractComponentsFromFilename`）。
   - 以上确保 `components` 始终有确定来源。

### 页面展示

- PackageListView/PackageDetailView 会展示 `metadata.components`；由于该字段来自 `si.ini` 的权威信息，可准确反映实际打入包的组件。
- 在详情页编辑并保存时，`updatedMetadata` 会保留并更新 `components`/`isPatch`/`description`/`tags`/`customFields`，并通过 `updatePackageMetadata` 持久化。

### 是否持久化

- 会。`handleCreatePackage` 完成回填后，调用 `packageService.addPackage(packageInfo)` 将数据写入 `package-metadata.json`；若开启 HTTP 上传，会传递整个 pkg 对象，`customFields` 也会随之上传。

## 六、几点注意

1. **列表页"自动刷新"行为**
   - 当前 `usePackages.ts` 在挂载时拉取一次包列表
   - 点击"刷新"或"扫描"会再拉取
   - 打包完成后并没有主动推送给 Files 页面
   - 因此通常是你切到 Files 页面（触发挂载拉取），或手动点刷新，才能看到新包

2. **扫描逻辑与持久化**
   - `packagingService.ts` 中的 `indexExistingPackages`/`startWatchingForPackages` 会把扫描到的包放进 PackagingService 的内存 Map
   - 而 PackageListView 使用的接口是 `packageService.getPackages()`（持久化来源）
   - 如果你想让"扫描"也把历史包持久化到 JSON，需在 packagingService 的扫描回调中同步调用 `packageService.addPackage(...)`