#!/bin/bash

# 简化启动脚本 - 自动选择最佳启动方式

if [ -f "dist/Raven/Raven" ]; then
    # 使用构建的可执行文件
    echo "启动 GalaxySpace Tester Agent (可执行版本)..."
    ./dist/Raven/Raven
elif [ -f "dist/Raven.app/Contents/MacOS/Raven" ]; then
    # 使用macOS app bundle
    echo "启动 GalaxySpace Tester Agent (macOS App)..."
    open dist/Raven.app
elif [ -f "src/main.py" ]; then
    # 使用源代码
    echo "启动 GalaxySpace Tester Agent (源代码版本)..."
    if [ -d "venv" ]; then
        source venv/bin/activate
    fi
    python3 src/main.py
else
    echo "❌ 未找到可启动的版本！请先运行 python quick_build.py 构建应用。"
    exit 1
fi 