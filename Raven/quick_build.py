#!/usr/bin/env python3
"""
快速构建脚本 - 用于本地测试

使用方法：
    python quick_build.py           # 使用现有版本构建
    python quick_build.py 1.0.1     # 设置新版本并构建
"""

import argparse
import subprocess
import sys
import os
import re
from pathlib import Path

class VersionManager:
    """版本管理器 - 从version_manager.py复用的简化版"""
    
    def __init__(self):
        self.project_root = Path(__file__).parent
        self.version_file = self.project_root / "src" / "__init__.py"
    
    def get_current_version(self) -> str:
        """获取当前版本号"""
        try:
            if not self.version_file.exists():
                return "1.0.0"  # 备用版本
            
            content = self.version_file.read_text(encoding='utf-8')
            for line in content.split('\n'):
                if line.strip().startswith('__version__'):
                    # 提取版本号
                    match = re.search(r'__version__\s*=\s*["\']([^"\']+)["\']', line)
                    if match:
                        return match.group(1)
            
            return "1.0.0"  # 备用版本
        except Exception:
            return "1.0.0"  # 备用版本
    
    def set_version(self, new_version: str) -> bool:
        """设置新版本号"""
        try:
            # 验证版本号格式
            if not re.match(r'^\d+\.\d+\.\d+$', new_version):
                print(f"❌ 版本号格式错误: {new_version}")
                print("请使用 major.minor.patch 格式，例如: 1.0.0")
                return False
            
            # 读取当前文件内容
            if not self.version_file.exists():
                print(f"❌ 版本文件不存在: {self.version_file}")
                return False
            
            content = self.version_file.read_text(encoding='utf-8')
            
            # 替换版本号
            new_content = re.sub(
                r'__version__\s*=\s*["\'][^"\']+["\']',
                f'__version__ = "{new_version}"',
                content
            )
            
            # 更新VERSION_INFO中的版本信息
            parts = new_version.split('.')
            major, minor, patch = int(parts[0]), int(parts[1]), int(parts[2])
            
            new_content = re.sub(
                r"'major':\s*\d+",
                f"'major': {major}",
                new_content
            )
            new_content = re.sub(
                r"'minor':\s*\d+", 
                f"'minor': {minor}",
                new_content
            )
            new_content = re.sub(
                r"'patch':\s*\d+",
                f"'patch': {patch}",
                new_content
            )
            
            # 写入文件
            self.version_file.write_text(new_content, encoding='utf-8')
            
            print(f"✅ 版本号已更新为: {new_version}")
            return True
            
        except Exception as e:
            print(f"❌ 设置版本失败: {e}")
            return False

def quick_build(target_version: str = None):
    """快速构建当前平台的可执行文件"""
    
    # 初始化版本管理器
    version_manager = VersionManager()
    
    # 处理版本号
    if target_version:
        print(f"🔧 设置版本号为: {target_version}")
        if not version_manager.set_version(target_version):
            print("❌ 版本号设置失败，终止构建")
            return False
        current_version = target_version
    else:
        current_version = version_manager.get_current_version()
        print(f"📋 使用当前版本: {current_version}")
    
    print(f"🚀 开始快速构建 Raven v{current_version}...")
    
    # 安装PyInstaller
    print("📦 安装PyInstaller...")
    try:
        subprocess.run([sys.executable, "-m", "pip", "install", "pyinstaller"], 
                      check=True, capture_output=True)
    except subprocess.CalledProcessError:
        print("⚠️  PyInstaller安装失败，尝试继续...")
    
    # 创建简单的spec文件
    project_root = Path(__file__).parent
    
    spec_content = f'''# -*- mode: python ; coding: utf-8 -*-
# Quick build spec for Raven v{current_version}

a = Analysis(
    ['src/main.py'],
    pathex=[r'{project_root}'],
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
        'cli',
        'cli.commands',
        'gui',
        'gui.main_window',
        'core',
        'core.package_maker',
        'core.file_processor',
        'core.config_generator',
        'core.version_parser',
        'data',
        'data.models',
    ],
    hookspath=[],
    hooksconfig={{}},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=None,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=None)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='Raven',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='Raven',
)
'''
    
    spec_file = project_root / "quick.spec"
    spec_file.write_text(spec_content)
    
    # 运行PyInstaller
    print("🔨 运行PyInstaller...")
    cmd = [sys.executable, "-m", "PyInstaller", str(spec_file), "--clean", "--noconfirm"]
    
    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        print("✅ 构建完成！")
        print(f"📁 输出目录: {project_root / 'dist'}")
        
        # 显示输出文件信息
        dist_dir = project_root / 'dist'
        if dist_dir.exists():
            exe_files = list(dist_dir.rglob('*.exe')) + list(dist_dir.rglob('Raven'))
            if exe_files:
                print("📄 生成的文件:")
                for exe_file in exe_files:
                    size = exe_file.stat().st_size / (1024*1024)  # MB
                    print(f"   {exe_file.relative_to(project_root)} ({size:.1f} MB)")
        
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"❌ PyInstaller执行失败:")
        if e.stderr:
            print(f"错误信息: {e.stderr}")
        return False
    
    finally:
        # 清理spec文件
        if spec_file.exists():
            spec_file.unlink()

def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description="快速构建脚本 - 用于本地测试",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
使用示例:
  python quick_build.py           # 使用现有版本构建
  python quick_build.py 1.0.1     # 设置新版本并构建
  python quick_build.py 1.2.0     # 设置新版本并构建
        '''
    )
    
    parser.add_argument(
        'version', 
        nargs='?',  # 可选参数
        help='要设置的版本号 (格式: major.minor.patch，例如: 1.0.1)'
    )
    
    args = parser.parse_args()
    
    try:
        success = quick_build(args.version)
        if success:
            print("\n🎉 快速构建流程完成！")
            print("💡 提示:")
            print("   • 可执行文件在 dist/ 目录中")
            print("   • 这是开发版本，仅用于本地测试")
            print("   • 要创建发布版本，请使用: python build.py --platform all")
        else:
            print("\n❌ 快速构建失败！")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n⏹️  构建被用户中断")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 未知错误: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 