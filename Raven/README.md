# Raven-锐测

一个专为卫星通信载荷测试人员设计的测试辅助工具。

## 功能特性

### 🚀 升级包制作
- **灵犀07A升级包**: 支持OAM软件、FPGA固件、协议栈软件的打包
- **配置文件包**: 支持各种JSON和XML配置文件的打包
- **智能版本识别**: 自动从文件名解析版本号
- **Patch模式**: 支持部分组件的增量升级包
- **多格式支持**: ZIP、RAR、TGZ等压缩格式的自动解压
- **文件验证**: 自动验证文件类型和格式
- **标准化命名**: 自动将文件重命名为规范格式

### 🖥️ 用户界面
- **PyQt6 GUI**: 现代化的图形用户界面
- **CLI支持**: 命令行工具，适合自动化场景
- **实时预览**: si.ini配置文件实时预览
- **进度显示**: 打包进度可视化

### 🤖 AI助手（预留）
- **MCP集成**: Model Context Protocol支持
- **RAG知识库**: 卫星通信领域知识问答
- **智能诊断**: 故障诊断和解决方案推荐

## 安装要求

### Python环境
- Python 3.8+
- PyQt6
- Click
- 其他依赖见 `requirements.txt`

### 系统要求
- **Windows**: Windows 10+ (GUI + CLI)
- **Linux**: Ubuntu 18.04+ / CentOS 7+ (CLI，GUI需要桌面环境)
- **macOS**: macOS 10.14+ (GUI + CLI)

## 快速开始

### 1. 环境准备

```bash
# 克隆项目
git clone <repository-url>
cd Raven

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate  # Linux/macOS
# 或 venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt
```

### 2. 快速构建 (推荐测试用)

```bash
python quick_build.py
```

这将为当前平台创建一个基本的可执行文件包。

### 3. 完整构建

#### 查看构建信息
```bash
python build.py --info
```

#### 清理构建文件
```bash
python build.py --clean
```

#### 构建特定平台
```bash
# Windows 版本
python build.py --platform windows

# macOS 版本
python build.py --platform macos

# Linux 版本
python build.py --platform linux

# 当前平台版本
python build.py --platform all
```

## 构建输出

### 基本输出
所有构建文件位于 `dist/` 目录下：

```
dist/
├── Raven/          # 可执行文件目录
│   ├── Raven       # 主程序 (macOS/Linux)
│   ├── Raven.exe   # 主程序 (Windows)
│   └── _internal/                    # 依赖文件
```

### Windows 特有输出
- `Raven-installer.nsi` - NSIS 安装脚本
- `dist/Raven-1.0.0-Setup.exe` - 安装程序 (如果运行了 NSIS)

### macOS 特有输出
- `Raven.app` - macOS 应用包
- `create_dmg.sh` - DMG 创建脚本
- `dist/Raven-1.0.0.dmg` - DMG 安装包 (如果运行了脚本)

### Linux 特有输出
- `Raven.desktop` - 桌面文件
- `create_appimage.sh` - AppImage 创建脚本
- `dist/deb/` - DEB 包目录结构
- `dist/Raven-1.0.0-x86_64.AppImage` - AppImage 文件 (如果运行了脚本)

## 高级构建选项

### 跳过环境设置
如果已经安装了构建依赖，可以跳过环境设置：

```bash
python build.py --platform all --no-setup
```

### 创建发布包

#### Windows 安装程序
1. 安装 NSIS
2. 运行构建脚本
3. 执行 NSIS 脚本：
   ```cmd
   makensis Raven-installer.nsi
   ```

#### macOS DMG
1. 运行构建脚本
2. 创建 DMG：
   ```bash
   ./create_dmg.sh
   ```

#### Linux 包
1. **AppImage:**
   ```bash
   ./create_appimage.sh
   ```

2. **DEB 包:**
   ```bash
   dpkg-deb --build dist/deb dist/Raven_1.0.0_amd64.deb
   ```

## 自定义构建

### 修改应用信息
编辑 `build.py` 中的应用信息：

```python
# 版本信息
self.app_name = "Raven"
self.app_version = "1.0.0"
self.app_description = "卫星通信载荷测试人员升级包制作工具"
self.app_author = "GalaxySpace"
```

### 添加图标
将图标文件放在 `assets/` 目录下：
- `icon.ico` (Windows)
- `icon.icns` (macOS)  
- `icon.png` (Linux)

### 自定义 PyInstaller 配置
编辑生成的 `.spec` 文件以自定义打包行为。

## 常见问题

### 1. PyQt6 导入错误
确保在虚拟环境中安装了 PyQt6：
```bash
pip install PyQt6
```

### 2. 权限错误 (macOS/Linux)
给脚本添加执行权限：
```bash
chmod +x create_dmg.sh create_appimage.sh
```

### 3. NSIS 找不到 (Windows)
下载并安装 NSIS: https://nsis.sourceforge.io/

### 4. AppImageTool 下载失败 (Linux)
手动下载 appimagetool 并放在项目根目录。

## 测试构建结果

### 命令行测试
```bash
# 显示帮助
./dist/Raven/Raven --help

# 启动 GUI
./dist/Raven/Raven --gui

# CLI 命令测试
./dist/Raven/Raven parse-version "gnb-oam-lx07a_v1001_abc123_20250101-1200.tgz"
```

### GUI 功能测试
1. 启动应用
2. 测试各个选项卡
3. 尝试选择文件和打包功能

## 发布建议

1. **版本管理**: 在每次发布前更新版本号
2. **测试**: 在目标平台上测试构建的可执行文件
3. **签名**: 为 Windows 和 macOS 版本添加代码签名
4. **文档**: 更新用户文档和变更日志

## 支持的平台

| 平台 | 支持状态 | 输出格式 |
|------|----------|----------|
| Windows 10/11 | ✅ | EXE + NSIS 安装程序 |
| macOS 10.14+ | ✅ | APP + DMG |
| Ubuntu 18.04+ | ✅ | Binary + AppImage + DEB |
| CentOS 7+ | ✅ | Binary + AppImage |

## 技术细节

- **打包工具**: PyInstaller 6.14+
- **GUI 框架**: PyQt6
- **CLI 框架**: Click
- **压缩支持**: ZIP, RAR, TGZ
- **Python 版本**: 3.8+ (推荐 3.11+) 


## 使用指南

### GUI模式

#### 灵犀07A升级包制作
1. 打开"灵犀07A升级包"选项卡
2. 输入整包版本号（如：V1.0.0.7）
3. 为每个组件选择对应的文件
4. 系统会自动识别版本号，也可手动输入
5. 根据需要勾选"是否为PATCH包"
6. 点击"开始打包"

#### 配置文件包制作
1. 打开"灵犀07A配置文件包"选项卡
2. 输入配置包版本号（如：V1.0.0.0）
3. 选择需要的配置文件
4. 可使用"全选"批量选择目录中的配置文件
5. 点击"开始打包"

### CLI模式

#### 查看可用组件
```bash
python src/main.py --cli list-components
```

#### 创建升级包
```bash
python src/main.py --cli package \
  --package-type lx07a_upgrade \
  --version V1.0.0.7 \
  --component oam:path/to/oam.tgz:V1.0.0.1 \
  --component sct_fpga:path/to/sct.bin:V1.2.0.7
```

#### 创建配置文件包
```bash
python src/main.py --cli package \
  --package-type lx07a_config \
  --version V1.0.0.0 \
  --component cwmp_data:path/to/cwmp_data.xml \
  --component cucp_gnb:path/to/conf.gnb_cucp.gnb.json
```

## 输出格式

### 升级包文件名格式
- **完整包**: `GalaxySpace-Lx07A-2025Mar20-1143-V1007.tgz`
- **Patch包**: `GalaxySpace-Lx07A-2025Mar20-1143-V1007-Patch.tgz`

### 配置文件包文件名格式
- **配置包**: `GalaxySpace-Lx07A-2025Mar20-1143-V1000-Config.tgz`

### si.ini配置文件示例
```ini
Packet_Ver=V1.0.0.7;
PacketAtttir=1001;
Publisher=yinhe;
FileNumInPacket=7;

FileName_1=gnb-oam-lx07a;
FileAttr_1=301;
FileVer_1=V1.0.0.1;

FileName_2=cucp.deb;
FileAttr_2=302;
FileVer_2=1.2.30.9;
...
```

## 项目结构

```
TestAgent/
├── src/
│   ├── main.py              # 主入口
│   ├── gui/                 # GUI界面
│   │   ├── main_window.py   # 主窗口
│   │   ├── upgrade_tab.py   # 升级包选项卡
│   │   ├── config_tab.py    # 配置文件选项卡
│   │   └── chatbot_tab.py   # AI助手选项卡
│   ├── cli/                 # CLI接口
│   │   └── commands.py      # 命令行工具
│   ├── core/                # 核心逻辑
│   │   ├── package_maker.py # 包制作器
│   │   ├── file_processor.py# 文件处理器
│   │   ├── config_generator.py # 配置生成器
│   │   └── version_parser.py# 版本解析器
│   ├── models/              # 数据模型
│   │   └── component.py     # 组件模型
│   └── utils/               # 工具函数
│       └── constants.py     # 常量定义
├── requirements.txt         # 依赖文件
├── logs/                    # 日志目录
├── temp/                    # 临时文件目录
└── output/                  # 输出目录
```

## 开发计划

### v1.0.x (当前版本)
- [x] 灵犀07A升级包制作
- [x] 配置文件包制作
- [x] 基础GUI界面
- [x] CLI工具支持
- [x] 文件验证和处理

### v1.1.x (计划中)
- [ ] 灵犀10升级包支持
- [ ] 三标段升级包支持
- [ ] 批量处理功能
- [ ] 配置模板管理

### v2.0.x (未来版本)
- [ ] MCP协议集成
- [ ] RAG知识库
- [ ] AI助手功能
- [ ] Web界面支持

## 许可证

Copyright (c) 2025 GalaxySpace Team. All rights reserved.

## 支持

如有问题或建议，请联系开发团队。 