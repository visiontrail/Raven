@echo off
REM Raven Update Server - Stop Script for Windows
REM 停止 Docker 容器中的更新服务器

setlocal enabledelayedexpansion

echo 🛑 停止 Raven 更新服务器...

REM 容器名称
set CONTAINER_NAME=raven-update-server

REM 检查容器是否存在并运行
for /f "tokens=*" %%i in ('docker ps -q -f name=%CONTAINER_NAME% 2^>nul') do set RUNNING=%%i
if defined RUNNING (
    echo 📦 停止容器: %CONTAINER_NAME%
    docker stop %CONTAINER_NAME%
    if errorlevel 1 (
        echo ❌ 停止容器失败！
        exit /b 1
    )
    echo ✅ 容器已停止
) else (
    echo ⚠️  容器 %CONTAINER_NAME% 未运行
)

REM 检查容器是否存在（已停止状态）
for /f "tokens=*" %%i in ('docker ps -aq -f name=%CONTAINER_NAME% 2^>nul') do set EXISTS=%%i
if defined EXISTS (
    echo 🗑️  删除容器: %CONTAINER_NAME%
    docker rm %CONTAINER_NAME%
    if errorlevel 1 (
        echo ❌ 删除容器失败！
        exit /b 1
    )
    echo ✅ 容器已删除
)

echo 🎉 Raven 更新服务器已完全停止
pause