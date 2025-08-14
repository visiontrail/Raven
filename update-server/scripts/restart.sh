#!/bin/bash

# Raven Update Server - Restart Script
# 重启 Docker 容器中的更新服务器

set -e

echo "🔄 重启 Raven 更新服务器..."

# 配置变量
CONTAINER_NAME="raven-update-server"
IMAGE_NAME="raven-update-server"
IMAGE_TAG="latest"
PORT="3000"
HOST_PORT="3000"

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "📁 项目目录: $PROJECT_DIR"
cd "$PROJECT_DIR"

# 检查容器是否存在并运行
if [ "$(docker ps -q -f name=$CONTAINER_NAME)" ]; then
    echo "🛑 停止现有容器: $CONTAINER_NAME"
    docker stop $CONTAINER_NAME
    echo "✅ 容器已停止"
else
    echo "⚠️  容器 $CONTAINER_NAME 未运行"
fi

# 检查容器是否存在（已停止状态）
if [ "$(docker ps -aq -f name=$CONTAINER_NAME)" ]; then
    echo "🗑️  删除容器: $CONTAINER_NAME"
    docker rm $CONTAINER_NAME
    echo "✅ 容器已删除"
fi

# 检查是否需要重新构建镜像
echo "🔍 检查 Docker 镜像..."
if [ "$(docker images -q $IMAGE_NAME:$IMAGE_TAG)" ]; then
    read -p "🤔 是否重新构建镜像？(y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🔨 重新构建 Docker 镜像: $IMAGE_NAME:$IMAGE_TAG"
        docker build -t $IMAGE_NAME:$IMAGE_TAG .
    else
        echo "📦 使用现有镜像: $IMAGE_NAME:$IMAGE_TAG"
    fi
else
    echo "🔨 构建 Docker 镜像: $IMAGE_NAME:$IMAGE_TAG"
    docker build -t $IMAGE_NAME:$IMAGE_TAG .
fi

# 检查 .env 文件
if [ ! -f ".env" ]; then
    echo "⚠️  未找到 .env 文件，创建默认配置..."
    cat > .env << EOF
PORT=3000
BASE_URL=http://localhost:3000
ADMIN_API_KEY=your-super-secret-admin-key-$(date +%s)
LOG_LEVEL=info
NODE_ENV=production
EOF
    echo "✅ 已创建默认 .env 文件"
fi

# 创建必要的目录
echo "📁 确保数据目录存在..."
mkdir -p ./data
mkdir -p ./releases
mkdir -p ./logs

# 启动容器
echo "🐳 启动 Docker 容器: $CONTAINER_NAME"
docker run -d \
  --name $CONTAINER_NAME \
  --restart unless-stopped \
  -p $HOST_PORT:$PORT \
  --env-file .env \
  -v "$(pwd)/data:/app/data" \
  -v "$(pwd)/releases:/app/releases" \
  -v "$(pwd)/logs:/app/logs" \
  $IMAGE_NAME:$IMAGE_TAG

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 5

# 检查容器状态
if [ "$(docker ps -q -f name=$CONTAINER_NAME)" ]; then
    echo "✅ 容器重启成功！"
    echo "📊 容器状态:"
    docker ps -f name=$CONTAINER_NAME
    echo ""
    echo "🌐 服务地址: http://localhost:$HOST_PORT"
    echo "🔍 健康检查: http://localhost:$HOST_PORT/health"
    echo "📋 查看日志: docker logs $CONTAINER_NAME"
    echo "📋 实时日志: docker logs -f $CONTAINER_NAME"
else
    echo "❌ 容器重启失败！"
    echo "📋 查看错误日志: docker logs $CONTAINER_NAME"
    exit 1
fi

echo "🎉 Raven 更新服务器重启完成！"