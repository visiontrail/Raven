@echo off
REM Raven Update Server - Restart Script for Windows
REM 重启 Docker 容器中的更新服务器

setlocal enabledelayedexpansion

echo 🔄 重启 Raven 更新服务器...

REM 配置变量
set CONTAINER_NAME=raven-update-server
set IMAGE_NAME=raven-update-server
set IMAGE_TAG=latest
set PORT=3000
set HOST_PORT=3000

REM 获取脚本所在目录的父目录
set SCRIPT_DIR=%~dp0
set PROJECT_DIR=%SCRIPT_DIR%..

echo 📁 项目目录: %PROJECT_DIR%
cd /d "%PROJECT_DIR%"

REM 检查容器是否存在并运行
for /f "tokens=*" %%i in ('docker ps -q -f name=%CONTAINER_NAME% 2^>nul') do set RUNNING=%%i
if defined RUNNING (
    echo 🛑 停止现有容器: %CONTAINER_NAME%
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

REM 检查是否需要重新构建镜像
echo 🔍 检查 Docker 镜像...
for /f "tokens=*" %%i in ('docker images -q %IMAGE_NAME%:%IMAGE_TAG% 2^>nul') do set IMAGE_EXISTS=%%i
if defined IMAGE_EXISTS (
    set /p REBUILD="🤔 是否重新构建镜像？(y/N): "
    if /i "!REBUILD!"=="y" (
        echo 🔨 重新构建 Docker 镜像: %IMAGE_NAME%:%IMAGE_TAG%
        docker build -t %IMAGE_NAME%:%IMAGE_TAG% .
        if errorlevel 1 (
            echo ❌ Docker 镜像构建失败！
            exit /b 1
        )
    ) else (
        echo 📦 使用现有镜像: %IMAGE_NAME%:%IMAGE_TAG%
    )
) else (
    echo 🔨 构建 Docker 镜像: %IMAGE_NAME%:%IMAGE_TAG%
    docker build -t %IMAGE_NAME%:%IMAGE_TAG% .
    if errorlevel 1 (
        echo ❌ Docker 镜像构建失败！
        exit /b 1
    )
)

REM 检查 .env 文件
if not exist ".env" (
    echo ⚠️  未找到 .env 文件，创建默认配置...
    (
        echo PORT=3000
        echo BASE_URL=http://localhost:3000
        echo ADMIN_API_KEY=your-super-secret-admin-key-%RANDOM%
        echo LOG_LEVEL=info
        echo NODE_ENV=production
    ) > .env
    echo ✅ 已创建默认 .env 文件
)

REM 创建必要的目录
echo 📁 确保数据目录存在...
if not exist "data" mkdir data
if not exist "releases" mkdir releases
if not exist "logs" mkdir logs

REM 启动容器
echo 🐳 启动 Docker 容器: %CONTAINER_NAME%
docker run -d ^
  --name %CONTAINER_NAME% ^
  --restart unless-stopped ^
  -p %HOST_PORT%:%PORT% ^
  --env-file .env ^
  -v "%cd%/data:/app/data" ^
  -v "%cd%/releases:/app/releases" ^
  -v "%cd%/logs:/app/logs" ^
  %IMAGE_NAME%:%IMAGE_TAG%

if errorlevel 1 (
    echo ❌ 容器重启失败！
    echo 📋 查看错误日志: docker logs %CONTAINER_NAME%
    exit /b 1
)

REM 等待服务启动
echo ⏳ 等待服务启动...
timeout /t 5 /nobreak >nul

REM 检查容器状态
for /f "tokens=*" %%i in ('docker ps -q -f name=%CONTAINER_NAME% 2^>nul') do set RUNNING=%%i
if defined RUNNING (
    echo ✅ 容器重启成功！
    echo 📊 容器状态:
    docker ps -f name=%CONTAINER_NAME%
    echo.
    echo 🌐 服务地址: http://localhost:%HOST_PORT%
    echo 🔍 健康检查: http://localhost:%HOST_PORT%/health
    echo 📋 查看日志: docker logs %CONTAINER_NAME%
    echo 📋 实时日志: docker logs -f %CONTAINER_NAME%
) else (
    echo ❌ 容器重启失败！
    echo 📋 查看错误日志: docker logs %CONTAINER_NAME%
    exit /b 1
)

echo 🎉 Raven 更新服务器重启完成！
pause