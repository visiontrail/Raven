#!/bin/bash

# Raven 应用数据清理脚本
# 用于构造初次使用的场景

echo "开始清理 Raven 应用数据..."

# 主要应用数据目录
APP_DATA_DIR="$HOME/Library/Application Support/Raven"
# 配置目录
CONFIG_DIR="$HOME/.cherrystudio"

# 删除主应用数据
if [ -d "$APP_DATA_DIR" ]; then
    echo "删除应用数据目录: $APP_DATA_DIR"
    rm -rf "$APP_DATA_DIR"
else
    echo "应用数据目录不存在: $APP_DATA_DIR"
fi

# 删除配置目录
if [ -d "$CONFIG_DIR" ]; then
    echo "删除配置目录: $CONFIG_DIR"
    rm -rf "$CONFIG_DIR"
else
    echo "配置目录不存在: $CONFIG_DIR"
fi

# 可选：删除偏好设置（如果需要的话）
PREF_FILE="$HOME/Library/Preferences/com.yinhe.Raven.plist"
if [ -f "$PREF_FILE" ]; then
    echo "删除偏好设置: $PREF_FILE"
    rm -f "$PREF_FILE"
else
    echo "偏好设置文件不存在: $PREF_FILE"
fi

# 可选：删除缓存
CACHE_DIR="$HOME/Library/Caches/com.yinhe.Raven"
if [ -d "$CACHE_DIR" ]; then
    echo "删除缓存目录: $CACHE_DIR"
    rm -rf "$CACHE_DIR"
else
    echo "缓存目录不存在: $CACHE_DIR"
fi

echo "✅ 清理完成！现在可以像初次使用一样启动 Raven 应用了。"
