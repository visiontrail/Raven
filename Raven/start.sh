#!/bin/bash

# GalaxySpace Tester Agent 启动脚本

echo "🚀 启动 GalaxySpace Tester Agent..."

# 优先使用构建的可执行文件
if [ -f "dist/Raven/Raven" ]; then
    echo "🖥️  启动构建版本的图形界面..."
    ./dist/Raven/Raven --gui
elif [ -f "src/main.py" ]; then
    echo "📦 激活虚拟环境..."
    # 检查虚拟环境
    if [ -d "venv" ]; then
        source venv/bin/activate
    fi

    # 检查PyQt6是否安装
    python3 -c "import PyQt6" 2>/dev/null
    if [ $? -ne 0 ]; then
        echo "⚠️  PyQt6 未安装，正在安装..."
        pip install PyQt6
    fi

    # 启动GUI
    echo "🖥️  启动源代码版本的图形界面..."
    python3 src/main.py --gui
else
    echo "❌ 未找到可执行文件或源代码！"
    echo "请确保："
    echo "  1. 运行 python quick_build.py 构建可执行文件，或"
    echo "  2. 确保 src/main.py 文件存在"
    exit 1
fi

echo "👋 感谢使用 GalaxySpace Tester Agent！" 