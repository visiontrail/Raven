#!/bin/bash

# Raven Update Server - Stop Script
# 停止 Docker 容器中的更新服务器

set -e

echo "🛑 停止 Raven 更新服务器..."

# 容器名称
CONTAINER_NAME="raven-update-server"

# 检查容器是否存在并运行
if [ "$(docker ps -q -f name=$CONTAINER_NAME)" ]; then
    echo "📦 停止容器: $CONTAINER_NAME"
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

echo "🎉 Raven 更新服务器已完全停止"