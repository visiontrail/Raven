# Raven Update Server Dockerfile
# 基于 Node.js 18 Alpine 镜像构建轻量级容器

FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apk add --no-cache \
    curl \
    bash

# 复制 package.json
COPY package.json ./

# 安装 Node.js 依赖
RUN npm install --omit=dev && npm cache clean --force

# 复制源代码和静态文件
COPY src/ ./src/
COPY public/ ./public/

# 创建必要的目录
RUN mkdir -p /app/data /app/releases /app/logs

# 设置目录权限
RUN chown -R node:node /app

# 切换到非 root 用户
USER node

# 暴露端口
EXPOSE 8082

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8082/health || exit 1

# 启动命令
CMD ["npm", "start"]