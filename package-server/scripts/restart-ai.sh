#!/bin/bash

# Galaxy Space AI Service - Restart Script
# 重启 AI 服务容器

set -e

echo "🔄 重启 Galaxy Space AI 服务..."

# 配置变量
CONTAINER_NAME="galaxy-package-ai-service"

# 检查容器是否存在
if [ "$(docker ps -aq -f name=$CONTAINER_NAME)" ]; then
    echo "🔍 找到容器: $CONTAINER_NAME"

    # 如果容器正在运行，先停止
    if [ "$(docker ps -q -f name=$CONTAINER_NAME)" ]; then
        echo "🛑 停止运行中的容器..."
        docker stop $CONTAINER_NAME
    fi

    # 启动容器
    echo "🚀 启动容器..."
    docker start $CONTAINER_NAME

    # 等待服务启动
    echo "⏳ 等待服务启动..."
    sleep 2

    # 检查容器状态
    if [ "$(docker ps -q -f name=$CONTAINER_NAME)" ]; then
        echo "✅ 容器重启成功！"
        echo "📊 容器状态:"
        docker ps -f name=$CONTAINER_NAME
    else
        echo "❌ 容器启动失败！"
        echo "📋 查看错误日志: docker logs $CONTAINER_NAME"
        exit 1
    fi
else
    echo "❌ 未找到容器 $CONTAINER_NAME"
    echo "💡 请先运行部署脚本: ./scripts/deploy-ai.sh"
    exit 1
fi

echo "🎉 重启完成！"


