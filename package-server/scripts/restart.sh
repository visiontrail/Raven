#!/bin/bash

# Galaxy Space Package Server - Restart Script
# 重启包管理服务器容器

set -e

echo "🔄 重启 Galaxy Space 包管理服务器..."

# 配置变量
CONTAINER_NAME="galaxy-package-server"

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
    sleep 5
    
    # 检查容器状态
    if [ "$(docker ps -q -f name=$CONTAINER_NAME)" ]; then
        echo "✅ 容器重启成功！"
        echo "📊 容器状态:"
        docker ps -f name=$CONTAINER_NAME
        echo ""
        echo "🌐 服务地址: http://localhost:8083"
        echo "🔍 健康检查: http://localhost:8083/health"
        echo "📋 查看日志: docker logs $CONTAINER_NAME"
    else
        echo "❌ 容器启动失败！"
        echo "📋 查看错误日志: docker logs $CONTAINER_NAME"
        exit 1
    fi
else
    echo "❌ 未找到容器 $CONTAINER_NAME"
    echo "💡 请先运行部署脚本: ./deploy.sh"
    exit 1
fi

echo "🎉 重启完成！"