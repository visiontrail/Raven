#!/bin/bash

APP_NAME="Raven"
APP_VERSION="0.0.1"
DMG_NAME="${APP_NAME}-${APP_VERSION}"

echo "创建DMG包..."

# 创建临时目录
mkdir -p dist/dmg

# 复制app到临时目录
cp -R "dist/${APP_NAME}.app" dist/dmg/

# 创建应用程序链接
ln -s /Applications dist/dmg/Applications

# 创建DMG
hdiutil create -volname "${APP_NAME}" -srcfolder dist/dmg -ov -format UDZO "dist/${DMG_NAME}.dmg"

echo "DMG创建完成: dist/${DMG_NAME}.dmg"

# 清理临时目录
rm -rf dist/dmg
