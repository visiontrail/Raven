@echo off
chcp 65001 >nul

echo 🚀 启动 GalaxySpace Tester Agent...

REM 检查虚拟环境
if exist "venv\" (
    echo 📦 激活虚拟环境...
    call venv\Scripts\activate
)

REM 检查PyQt6是否安装
python -c "import PyQt6" 2>nul
if errorlevel 1 (
    echo ⚠️  PyQt6 未安装，正在安装...
    pip install PyQt6
)

REM 启动GUI
echo 🖥️  启动图形界面...
python src\main.py --gui

echo 👋 感谢使用 GalaxySpace Tester Agent！
pause 