# GalaxySpace Tester Agent - 快速开始

## 🚀 立即使用

### 选项一：直接运行 (开发环境)

```bash
# 1. 创建虚拟环境（首次使用时）
python3 -m venv venv        # macOS/Linux 如果需要指定python3

# 2. 激活虚拟环境
source venv/bin/activate    # Linux/macOS
# 或 venv\Scripts\activate  # Windows

# 3. 安装依赖包（首次使用时）
pip install -r requirements.txt

# 4. 编译（如果需要）
python quick_build.py
python quick_build.py 1.0.1

# 版本管理场景 - 使用 version_manager.py  
python version_manager.py --set 1.0.1    # 纯版本更新
python version_manager.py --check        # 版本一致性检查

# 5. 启动GUI应用
./start.sh          # Linux/macOS
# 或 start.bat       # Windows

# 6. 或手动启动
python src/main.py --gui
```

### 选项二：使用构建的可执行文件

```bash
# 1. 快速构建
python quick_build.py

# 2. 运行可执行文件（修复后的正确路径）
./dist/Raven/Raven --gui

# 3. 或使用简化启动脚本
chmod +x run.sh
./run.sh

# 4. macOS用户也可以双击
open dist/Raven.app
```

### 选项三：创建安装包

```bash
# macOS
python build.py --platform macos
./create_dmg.sh  # 创建DMG安装包

# Windows
python build.py --platform windows
# 然后使用NSIS创建安装程序

# Linux（暂未实现）
python build.py --platform linux
./create_appimage.sh  # 创建AppImage
```

## 📋 功能介绍

### 🛰️ 升级包制作
- **灵犀07A升级包**：支持7个组件的升级包制作
- **配置文件包**：支持7个配置文件的打包
- **Patch模式**：部分组件更新
- **版本自动识别**：从文件名自动提取版本号

### 🖥️ 界面特色
- **多选项卡设计**：升级包、配置文件、AI助手(预留)
- **实时预览**：si.ini文件内容实时显示
- **智能提示**：自动检测Patch模式需求
- **详细日志**：操作记录和错误追踪

### ⌨️ CLI工具
```bash
# 查看组件列表
python src/main.py --cli list-components

# 解析版本号
python src/main.py --cli parse-version "gnb-oam-lx07a_v1001_abc123_20250101.tgz"

# 制作升级包
python src/main.py --cli package --package-type lx07a_upgrade --version V1.0.0.1

# 制作配置文件包
python src/main.py --cli package --package-type lx07a_config --version V1.0.0.0 --component cwmp_data:./file.xml
```

## 📁 支持的文件格式

### 升级包组件
- **OAM软件**：.tgz, .zip, .rar
- **FPGA文件**：.bin
- **协议栈**：.deb

### 配置文件
- **XML配置**：.xml
- **JSON配置**：.json

## ✨ 快速测试

1. **启动应用**：`./start.sh` 或 `python src/main.py --gui`
2. **选择文件**：点击"浏览"按钮选择组件文件
3. **输入版本**：填写整包版本号（如V1.0.0.1）
4. **预览配置**：右侧实时显示si.ini内容
5. **开始打包**：点击"开始打包"按钮

## 🔧 故障排除

### 常见问题

**Q: PyQt6导入错误**
```bash
pip install PyQt6
```

**Q: 构建失败 - pathlib错误**
```bash
pip uninstall pathlib -y
```

**Q: 图标文件缺失**
```bash
python create_simple_icon.py
```

**Q: 权限错误 (Linux/macOS)**
```bash
chmod +x start.sh create_dmg.sh create_appimage.sh
```

### 获取帮助

- 查看详细文档：`README.md`
- 构建说明：`README_BUILD.md`
- 项目状态：`PROJECT_STATUS.md`
- CLI帮助：`python src/main.py --cli --help`

## 🎯 下一步

- [ ] 添加灵犀10和三标段支持
- [ ] 集成AI助手功能
- [ ] 添加批量处理
- [ ] 实现配置模板保存

---

**享受使用 GalaxySpace Tester Agent！** 🚀 