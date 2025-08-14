@echo off
REM Raven Update Server - Deploy Script for Windows
REM 部署 Docker 容器中的更新服务器

setlocal enabledelayedexpansion

echo 🚀 部署 Raven 更新服务器...

REM 配置变量
set CONTAINER_NAME=raven-update-server
set IMAGE_NAME=raven-update-server
set IMAGE_TAG=latest
set PORT=8082
set HOST_PORT=8082

REM 检查是否存在 .env 文件
if not exist ".env" (
    echo ⚠️  未找到 .env 文件，创建默认配置...
    (
        echo PORT=8082
        echo BASE_URL=http://localhost:8082
        echo ADMIN_API_KEY=your-super-secret-admin-key-%RANDOM%
        echo LOG_LEVEL=info
        echo NODE_ENV=production
    ) > .env
    echo ✅ 已创建默认 .env 文件，请根据需要修改配置
)

REM 停止并删除现有容器（如果存在）
echo 🔍 检查现有容器...
for /f "tokens=*" %%i in ('docker ps -q -f name=%CONTAINER_NAME% 2^>nul') do (
    echo 🛑 停止现有容器: %CONTAINER_NAME%
    docker stop %CONTAINER_NAME%
)

for /f "tokens=*" %%i in ('docker ps -aq -f name=%CONTAINER_NAME% 2^>nul') do (
    echo 🗑️  删除现有容器: %CONTAINER_NAME%
    docker rm %CONTAINER_NAME%
)

REM 构建 Docker 镜像
echo 🔨 构建 Docker 镜像: %IMAGE_NAME%:%IMAGE_TAG%
docker build -t %IMAGE_NAME%:%IMAGE_TAG% .
if errorlevel 1 (
    echo ❌ Docker 镜像构建失败！
    exit /b 1
)

REM 创建必要的目录
echo 📁 创建数据目录...
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
    echo ❌ 容器启动失败！
    echo 📋 查看错误日志: docker logs %CONTAINER_NAME%
    exit /b 1
)

REM 等待服务启动
echo ⏳ 等待服务启动...
timeout /t 5 /nobreak >nul

REM 检查容器状态
for /f "tokens=*" %%i in ('docker ps -q -f name=%CONTAINER_NAME% 2^>nul') do set RUNNING=%%i
if defined RUNNING (
    echo ✅ 容器启动成功！
    echo 📊 容器状态:
    docker ps -f name=%CONTAINER_NAME%
    echo.
    echo 🌐 服务地址: http://localhost:%HOST_PORT%
    echo 🔍 健康检查: http://localhost:%HOST_PORT%/health
    echo 📋 查看日志: docker logs %CONTAINER_NAME%
) else (
    echo ❌ 容器启动失败！
    echo 📋 查看错误日志: docker logs %CONTAINER_NAME%
    exit /b 1
)

echo 🎉 Raven 更新服务器部署完成！
pause