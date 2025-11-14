#!/bin/bash

# Galaxy Space Package Server - 诊断脚本
# 排查容器重启问题

CONTAINER_NAME="galaxy-package-server"

echo "=========================================="
echo "  容器诊断工具"
echo "=========================================="
echo ""

echo "1️⃣ 检查容器状态..."
docker ps -a | grep $CONTAINER_NAME || echo "❌ 容器不存在"
echo ""

echo "2️⃣ 查看最近日志（最后50行）..."
docker logs $CONTAINER_NAME --tail=50 2>&1 || echo "❌ 无法获取日志"
echo ""

echo "3️⃣ 查看容器退出信息..."
docker inspect $CONTAINER_NAME --format='{{.State.Status}} - Exit Code: {{.State.ExitCode}}' 2>/dev/null || echo "❌ 无法获取状态"
echo ""

echo "4️⃣ 检查端口占用..."
lsof -i :8083 2>/dev/null || netstat -tulpn 2>/dev/null | grep 8083 || echo "✅ 端口 8083 未被占用"
echo ""

echo "5️⃣ 检查系统资源..."
echo "内存使用:"
free -h | head -2
echo ""
echo "磁盘空间:"
df -h . | tail -1
echo ""

echo "6️⃣ 检查挂载目录..."
if [ -d "uploads" ]; then
    echo "✅ uploads 目录存在"
    ls -ld uploads
else
    echo "❌ uploads 目录不存在"
fi

if [ -d "data" ]; then
    echo "✅ data 目录存在"
    ls -ld data
else
    echo "❌ data 目录不存在"
fi
echo ""

echo "7️⃣ 尝试查看容器内进程..."
docker top $CONTAINER_NAME 2>/dev/null || echo "❌ 容器未运行，无法查看进程"
echo ""

echo "=========================================="
echo "  诊断完成"
echo "=========================================="
echo ""
echo "💡 如果看到错误信息，请检查："
echo "   - 日志中的错误消息"
echo "   - 端口是否被占用"
echo "   - 内存是否充足"
echo "   - 文件权限是否正确"
echo ""
echo "📋 查看完整日志: docker logs -f $CONTAINER_NAME"

