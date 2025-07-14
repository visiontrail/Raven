#!/usr/bin/env python3
"""
GalaxySpace Tester Agent 多平台发布脚本

支持功能：
- Windows (PyInstaller + NSIS)
- macOS (PyInstaller + 可选的DMG)
- Linux (PyInstaller + AppImage/DEB)

使用方法：
    python build.py --platform windows
    python build.py --platform macos
    python build.py --platform linux
    python build.py --platform all
"""

import argparse
import shutil
import subprocess
import sys
import os
import platform
from pathlib import Path
from typing import Optional

def get_version_from_source():
    """从源代码中获取版本号"""
    try:
        # 读取src/__init__.py中的版本号
        init_file = Path(__file__).parent / "src" / "__init__.py"
        if init_file.exists():
            content = init_file.read_text(encoding='utf-8')
            for line in content.split('\n'):
                if line.strip().startswith('__version__'):
                    # 提取版本号
                    version = line.split('=')[1].strip().strip('"\'')
                    return version
    except Exception as e:
        print(f"警告: 无法从源代码读取版本号: {e}")
    
    # 备用版本号
    return "1.0.0"

class MultiPlatformBuilder:
    """多平台构建器"""
    
    def __init__(self):
        self.project_root = Path(__file__).parent
        self.src_dir = self.project_root / "src"
        self.dist_dir = self.project_root / "dist"
        self.build_dir = self.project_root / "build"
        self.assets_dir = self.project_root / "assets"
        
        # 版本信息 - 从源代码动态获取
        self.app_name = "Raven"
        self.app_version = get_version_from_source()
        self.app_description = "卫星通信载荷测试人员升级包制作工具"
        self.app_author = "GalaxySpace"
        
        # 确保目录存在
        self.assets_dir.mkdir(exist_ok=True)
        
        print(f"🔧 构建版本: {self.app_version}")
        
    def setup_environment(self):
        """设置构建环境"""
        print("🔧 设置构建环境...")
        
        # 安装构建依赖
        dependencies = [
            "pyinstaller",
            "PyQt6",
            "click",
            "rarfile"
        ]
        
        for dep in dependencies:
            print(f"   安装 {dep}...")
            subprocess.run([sys.executable, "-m", "pip", "install", dep], 
                         check=True, capture_output=True)
        
        print("✅ 构建环境准备完成")
    
    def clean_build_files(self):
        """清理构建文件"""
        print("🧹 清理构建文件...")
        
        dirs_to_clean = [self.dist_dir, self.build_dir]
        for dir_path in dirs_to_clean:
            if dir_path.exists():
                shutil.rmtree(dir_path)
                print(f"   已清理: {dir_path}")
        
        print("✅ 构建文件清理完成")
    
    def create_pyinstaller_spec(self, platform_name: str) -> Path:
        """创建PyInstaller规格文件"""
        print(f"📝 创建 {platform_name} PyInstaller 规格文件...")
        
        spec_content = f'''# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['src/main.py'],
    pathex=['{self.project_root}'],
    binaries=[],
    datas=[
        ('src', 'src'),
    ],
    hiddenimports=[
        'PyQt6.QtCore',
        'PyQt6.QtGui', 
        'PyQt6.QtWidgets',
        'click',
        'rarfile',
    ],
    hookspath=[],
    hooksconfig={{}},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='{self.app_name}',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console={'True' if platform_name == 'linux' else 'False'},
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
         {'icon="assets/icon.ico",' if platform_name == 'windows' and (self.assets_dir / "icon.ico").exists() else ''}
     {'icon="assets/icon.icns",' if platform_name == 'macos' and (self.assets_dir / "icon.icns").exists() else ''}
)

{'app = BUNDLE(exe, name="' + self.app_name + '.app"' + (', icon="assets/icon.icns"' if (self.assets_dir / "icon.icns").exists() else '') + ', bundle_identifier="com.galaxyspace.testeragent")' if platform_name == 'macos' else ''}
'''
        
        spec_file = self.project_root / f"{self.app_name}-{platform_name}.spec"
        spec_file.write_text(spec_content)
        
        print(f"✅ 规格文件创建完成: {spec_file}")
        return spec_file
    
    def create_default_icon(self):
        """创建默认图标"""
        print("🖼️ 创建默认图标...")
        
        try:
            from PIL import Image, ImageDraw, ImageFont
            
            # 创建一个简单的图标
            size = 256
            img = Image.new('RGBA', (size, size), (0, 123, 255, 255))
            draw = ImageDraw.Draw(img)
            
            # 绘制简单图形
            margin = size // 8
            draw.rectangle([margin, margin, size-margin, size-margin], 
                         fill=(255, 255, 255, 255), outline=(0, 0, 0, 255), width=3)
            
            # 添加文字
            try:
                font = ImageFont.truetype("arial.ttf", size//8) 
            except:
                font = ImageFont.load_default()
            
            text = "GA"
            bbox = draw.textbbox((0, 0), text, font=font)
            text_width = bbox[2] - bbox[0]
            text_height = bbox[3] - bbox[1]
            x = (size - text_width) // 2
            y = (size - text_height) // 2
            draw.text((x, y), text, fill=(0, 123, 255, 255), font=font)
            
            # 保存不同格式
            img.save(self.assets_dir / "icon.png")
            img.save(self.assets_dir / "icon.ico")
            if platform.system() == "Darwin":
                img.save(self.assets_dir / "icon.icns")
                
        except ImportError:
            print("   PIL未安装，跳过图标创建")
        except Exception as e:
            print(f"   图标创建失败: {e}")
    
    def build_windows(self):
        """构建Windows版本"""
        print("🪟 构建Windows版本...")
        
        if platform.system() != "Windows":
            print("⚠️  当前不是Windows系统，Windows构建可能有问题")
        
        # 创建图标
        self.create_default_icon()
        
        # 创建规格文件
        spec_file = self.create_pyinstaller_spec('windows')
        
        # 运行PyInstaller
        cmd = [sys.executable, "-m", "PyInstaller", str(spec_file), "--clean"]
        subprocess.run(cmd, check=True)
        
        # 创建安装程序脚本
        self.create_nsis_script()
        
        print("✅ Windows版本构建完成")
        
    def create_nsis_script(self):
        """创建NSIS安装脚本"""
        print("📦 创建Windows安装程序脚本...")
        
        nsis_content = f'''!define APP_NAME "{self.app_name}"
!define APP_VERSION "{self.app_version}"
!define APP_PUBLISHER "{self.app_author}"
!define APP_DESCRIPTION "{self.app_description}"

Name "${{APP_NAME}}"
OutFile "dist/${{APP_NAME}}-${{APP_VERSION}}-Setup.exe"
InstallDir "$PROGRAMFILES\\${{APP_NAME}}"
RequestExecutionLevel admin

Section "Install"
    SetOutPath "$INSTDIR"
    File /r "dist\\{self.app_name}\\*"
    
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${{APP_NAME}}" \\
                     "DisplayName" "${{APP_NAME}}"
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${{APP_NAME}}" \\
                     "UninstallString" "$INSTDIR\\uninstall.exe"
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${{APP_NAME}}" \\
                     "DisplayVersion" "${{APP_VERSION}}"
    WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${{APP_NAME}}" \\
                     "Publisher" "${{APP_PUBLISHER}}"
    
    CreateDirectory "$SMPROGRAMS\\${{APP_NAME}}"
    CreateShortCut "$SMPROGRAMS\\${{APP_NAME}}\\${{APP_NAME}}.lnk" \\
                   "$INSTDIR\\{self.app_name}.exe"
    CreateShortCut "$DESKTOP\\${{APP_NAME}}.lnk" \\
                   "$INSTDIR\\{self.app_name}.exe"
    
    WriteUninstaller "$INSTDIR\\uninstall.exe"
SectionEnd

Section "Uninstall"
    Delete "$INSTDIR\\*"
    RMDir /r "$INSTDIR"
    Delete "$SMPROGRAMS\\${{APP_NAME}}\\*"
    RMDir "$SMPROGRAMS\\${{APP_NAME}}"
    Delete "$DESKTOP\\${{APP_NAME}}.lnk"
    DeleteRegKey HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${{APP_NAME}}"
SectionEnd
'''
        
        nsis_file = self.project_root / f"{self.app_name}-installer.nsi"
        nsis_file.write_text(nsis_content, encoding='utf-8')
        
        print(f"✅ NSIS脚本创建完成: {nsis_file}")
        print("💡 要创建安装程序，请运行: makensis {}.nsi".format(self.app_name + "-installer"))
    
    def build_macos(self):
        """构建macOS版本"""
        print("🍎 构建macOS版本...")
        
        if platform.system() != "Darwin":
            print("⚠️  当前不是macOS系统，macOS构建可能有问题")
        
        # 创建图标
        self.create_default_icon()
        
        # 创建规格文件
        spec_file = self.create_pyinstaller_spec('macos')
        
        # 运行PyInstaller
        cmd = [sys.executable, "-m", "PyInstaller", str(spec_file), "--clean"]
        subprocess.run(cmd, check=True)
        
        # 创建DMG脚本
        self.create_dmg_script()
        
        print("✅ macOS版本构建完成")
    
    def create_dmg_script(self):
        """创建DMG打包脚本"""
        print("📦 创建macOS DMG打包脚本...")
        
        dmg_script = f'''#!/bin/bash

APP_NAME="{self.app_name}"
APP_VERSION="{self.app_version}"
DMG_NAME="${{APP_NAME}}-${{APP_VERSION}}"

echo "创建DMG包..."

# 创建临时目录
mkdir -p dist/dmg

# 复制app到临时目录
cp -R "dist/${{APP_NAME}}.app" dist/dmg/

# 创建应用程序链接
ln -s /Applications dist/dmg/Applications

# 创建DMG
hdiutil create -volname "${{APP_NAME}}" -srcfolder dist/dmg -ov -format UDZO "dist/${{DMG_NAME}}.dmg"

echo "DMG创建完成: dist/${{DMG_NAME}}.dmg"

# 清理临时目录
rm -rf dist/dmg
'''
        
        dmg_script_file = self.project_root / "create_dmg.sh"
        dmg_script_file.write_text(dmg_script)
        dmg_script_file.chmod(0o755)
        
        print(f"✅ DMG脚本创建完成: {dmg_script_file}")
        print("💡 要创建DMG，请运行: ./create_dmg.sh")
    
    def build_linux(self):
        """构建Linux版本"""
        print("🐧 构建Linux版本...")
        
        # 创建图标
        self.create_default_icon()
        
        # 创建规格文件
        spec_file = self.create_pyinstaller_spec('linux')
        
        # 运行PyInstaller
        cmd = [sys.executable, "-m", "PyInstaller", str(spec_file), "--clean"]
        subprocess.run(cmd, check=True)
        
        # 创建AppImage和DEB脚本
        self.create_appimage_script()
        self.create_deb_package()
        
        print("✅ Linux版本构建完成")
    
    def create_appimage_script(self):
        """创建AppImage打包脚本"""
        print("📦 创建Linux AppImage打包脚本...")
        
        # 创建.desktop文件
        desktop_content = f'''[Desktop Entry]
Type=Application
Name={self.app_name}
Comment={self.app_description}
Exec={self.app_name}
Icon={self.app_name.lower()}
Categories=Utility;
'''
        
        desktop_file = self.project_root / f"{self.app_name}.desktop"
        desktop_file.write_text(desktop_content)
        
        appimage_script = f'''#!/bin/bash

APP_NAME="{self.app_name}"
APP_VERSION="{self.app_version}"

echo "创建AppImage包..."

# 创建AppDir结构
mkdir -p dist/AppDir/usr/bin
mkdir -p dist/AppDir/usr/share/applications
mkdir -p dist/AppDir/usr/share/icons/hicolor/256x256/apps

# 复制文件
cp -r dist/${{APP_NAME}}/* dist/AppDir/usr/bin/
cp {self.app_name}.desktop dist/AppDir/usr/share/applications/
cp assets/icon.png dist/AppDir/usr/share/icons/hicolor/256x256/apps/${{APP_NAME}}.png
cp {self.app_name}.desktop dist/AppDir/
cp assets/icon.png dist/AppDir/${{APP_NAME}}.png

# 创建AppRun
cat > dist/AppDir/AppRun << 'EOF'
#!/bin/bash
SELF=$(readlink -f "$0")
HERE=${{SELF%/*}}
exec "${{HERE}}/usr/bin/{self.app_name}" "$@"
EOF
chmod +x dist/AppDir/AppRun

# 下载appimagetool (如果需要)
if [ ! -f "appimagetool" ]; then
    echo "下载appimagetool..."
    wget https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage
    chmod +x appimagetool-x86_64.AppImage
    mv appimagetool-x86_64.AppImage appimagetool
fi

# 创建AppImage
./appimagetool dist/AppDir "dist/${{APP_NAME}}-${{APP_VERSION}}-x86_64.AppImage"

echo "AppImage创建完成: dist/${{APP_NAME}}-${{APP_VERSION}}-x86_64.AppImage"
'''
        
        appimage_script_file = self.project_root / "create_appimage.sh"
        appimage_script_file.write_text(appimage_script)
        appimage_script_file.chmod(0o755)
        
        print(f"✅ AppImage脚本创建完成: {appimage_script_file}")
    
    def create_deb_package(self):
        """创建DEB包"""
        print("📦 创建DEB包...")
        
        deb_dir = self.project_root / "dist" / "deb"
        deb_dir.mkdir(parents=True, exist_ok=True)
        
        # 创建目录结构
        (deb_dir / "DEBIAN").mkdir(exist_ok=True)
        (deb_dir / "usr" / "bin").mkdir(parents=True, exist_ok=True)
        (deb_dir / "usr" / "share" / "applications").mkdir(parents=True, exist_ok=True)
        (deb_dir / "usr" / "share" / "icons" / "hicolor" / "256x256" / "apps").mkdir(parents=True, exist_ok=True)
        
        # 创建control文件
        control_content = f'''Package: {self.app_name.lower()}
Version: {self.app_version}
Section: utils
Priority: optional
Architecture: amd64
Maintainer: {self.app_author} <support@galaxyspace.com>
Description: {self.app_description}
 卫星通信载荷测试人员专用的升级包制作工具，支持多种格式的
 文件处理和自动化配置生成。
'''
        
        (deb_dir / "DEBIAN" / "control").write_text(control_content)
        
        # 复制文件
        dist_app_dir = self.dist_dir / self.app_name
        if dist_app_dir.exists():
            shutil.copytree(dist_app_dir, deb_dir / "usr" / "share" / self.app_name.lower())
            
            # 创建启动脚本
            launcher_script = f'''#!/bin/bash
exec /usr/share/{self.app_name.lower()}/{self.app_name} "$@"
'''
            launcher_file = deb_dir / "usr" / "bin" / self.app_name.lower()
            launcher_file.write_text(launcher_script)
            launcher_file.chmod(0o755)
        
        # 复制desktop文件和图标
        desktop_file = self.project_root / f"{self.app_name}.desktop"
        if desktop_file.exists():
            shutil.copy2(desktop_file, deb_dir / "usr" / "share" / "applications")
        
        icon_file = self.assets_dir / "icon.png"
        if icon_file.exists():
            shutil.copy2(icon_file, deb_dir / "usr" / "share" / "icons" / "hicolor" / "256x256" / "apps" / f"{self.app_name.lower()}.png")
        
        print(f"✅ DEB包结构创建完成: {deb_dir}")
        print("💡 要构建DEB包，请运行: dpkg-deb --build dist/deb")
    
    def build_all(self):
        """构建所有平台版本"""
        print("🌍 构建所有平台版本...")
        
        current_platform = platform.system().lower()
        
        if current_platform == "windows":
            self.build_windows()
        elif current_platform == "darwin":
            self.build_macos()
        elif current_platform == "linux":
            self.build_linux()
        else:
            print(f"⚠️  未知平台: {current_platform}")
            return
        
        print("✅ 所有支持平台构建完成")
    
    def show_build_info(self):
        """显示构建信息"""
        print("📊 构建信息:")
        print(f"   应用名称: {self.app_name}")
        print(f"   应用版本: {self.app_version}")
        print(f"   应用描述: {self.app_description}")
        print(f"   当前平台: {platform.system()}")
        print(f"   Python版本: {sys.version}")
        print(f"   项目目录: {self.project_root}")
        print(f"   输出目录: {self.dist_dir}")

def main():
    parser = argparse.ArgumentParser(
        description="GalaxySpace Tester Agent 多平台发布脚本",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
使用示例:
  python build.py --platform windows     # 构建Windows版本
  python build.py --platform macos       # 构建macOS版本  
  python build.py --platform linux       # 构建Linux版本
  python build.py --platform all         # 构建当前平台版本
  python build.py --clean                # 仅清理构建文件
  python build.py --info                 # 显示构建信息
        '''
    )
    
    parser.add_argument(
        '--platform', 
        choices=['windows', 'macos', 'linux', 'all'],
        help='指定构建平台'
    )
    parser.add_argument(
        '--clean', 
        action='store_true',
        help='清理构建文件'
    )
    parser.add_argument(
        '--info', 
        action='store_true',
        help='显示构建信息'
    )
    parser.add_argument(
        '--no-setup', 
        action='store_true',
        help='跳过环境设置'
    )
    
    args = parser.parse_args()
    
    builder = MultiPlatformBuilder()
    
    if args.info:
        builder.show_build_info()
        return
    
    if args.clean:
        builder.clean_build_files()
        return
    
    if not args.platform:
        parser.print_help()
        return
    
    try:
        print(f"🚀 开始构建 {args.platform} 平台版本...")
        
        if not args.no_setup:
            builder.setup_environment()
        
        builder.clean_build_files()
        
        if args.platform == 'windows':
            builder.build_windows()
        elif args.platform == 'macos':
            builder.build_macos()
        elif args.platform == 'linux':
            builder.build_linux()
        elif args.platform == 'all':
            builder.build_all()
        
        print(f"🎉 {args.platform} 平台构建完成！")
        print(f"📁 输出目录: {builder.dist_dir}")
        
    except subprocess.CalledProcessError as e:
        print(f"❌ 构建失败: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ 未知错误: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 