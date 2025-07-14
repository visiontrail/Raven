#!/usr/bin/env python3
"""
版本管理工具

用于统一管理项目版本号，确保所有文件中的版本号保持一致。

使用方法：
    python version_manager.py                   # 显示当前版本
    python version_manager.py --set 1.0.1      # 设置新版本
    python version_manager.py --check          # 检查版本一致性
"""

import argparse
import re
import sys
from pathlib import Path
from typing import List, Tuple

class VersionManager:
    """版本管理器"""
    
    def __init__(self):
        self.project_root = Path(__file__).parent
        self.version_file = self.project_root / "src" / "__init__.py"
    
    def get_current_version(self) -> str:
        """获取当前版本号"""
        try:
            if not self.version_file.exists():
                return "未找到版本文件"
            
            content = self.version_file.read_text(encoding='utf-8')
            for line in content.split('\n'):
                if line.strip().startswith('__version__'):
                    # 提取版本号
                    match = re.search(r'__version__\s*=\s*["\']([^"\']+)["\']', line)
                    if match:
                        return match.group(1)
            
            return "未找到版本号"
        except Exception as e:
            return f"读取版本失败: {e}"
    
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
    
    def check_version_consistency(self) -> List[Tuple[str, str, bool]]:
        """检查版本一致性"""
        current_version = self.get_current_version()
        if "失败" in current_version or "未找到" in current_version:
            print(f"❌ 无法获取当前版本: {current_version}")
            return []
        
        print(f"🔍 当前版本: {current_version}")
        print("检查文件中的版本一致性...")
        
        results = []
        
        # 检查的文件列表
        files_to_check = [
            ("setup.py", r'version\s*=\s*["\']([^"\']+)["\']'),
            ("README.md", r'Raven-(\d+\.\d+\.\d+)'),
            ("PROJECT_STATUS.md", None),  # 这个文件可能包含示例版本号，不强制检查
        ]
        
        for file_path, pattern in files_to_check:
            file_full_path = self.project_root / file_path
            if file_full_path.exists():
                try:
                    content = file_full_path.read_text(encoding='utf-8')
                    if pattern:
                        matches = re.findall(pattern, content)
                        for match in matches:
                            is_consistent = match == current_version
                            status = "✅" if is_consistent else "❌"
                            print(f"  {status} {file_path}: {match}")
                            results.append((file_path, match, is_consistent))
                    else:
                        print(f"  ℹ️  {file_path}: 跳过检查（示例文件）")
                except Exception as e:
                    print(f"  ❌ {file_path}: 读取失败 - {e}")
                    results.append((file_path, f"读取失败: {e}", False))
            else:
                print(f"  ⚠️  {file_path}: 文件不存在")
        
        return results
    
    def show_help(self):
        """显示帮助信息"""
        print("""
🔧 版本管理工具

功能：
  📋 查看当前版本号
  ✏️  设置新版本号  
  🔍 检查版本一致性

使用方法：
  python version_manager.py                 # 显示当前版本
  python version_manager.py --set 1.0.1    # 设置新版本
  python version_manager.py --check        # 检查版本一致性
  python version_manager.py --help         # 显示帮助

注意：
  • 版本号必须使用 major.minor.patch 格式（如：1.0.0）
  • 设置新版本后，构建脚本会自动使用新版本号
  • 建议在发布前检查版本一致性
        """)

def main():
    parser = argparse.ArgumentParser(
        description="版本管理工具 - 统一管理项目版本号",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    parser.add_argument(
        '--set', 
        metavar='VERSION',
        help='设置新版本号 (格式: major.minor.patch)'
    )
    parser.add_argument(
        '--check', 
        action='store_true',
        help='检查版本一致性'
    )
    parser.add_argument(
        '--help-tool', 
        action='store_true',
        help='显示工具帮助信息'
    )
    
    args = parser.parse_args()
    
    manager = VersionManager()
    
    if args.help_tool:
        manager.show_help()
        return
    
    if args.set:
        if manager.set_version(args.set):
            print(f"\n💡 版本更新完成！现在可以运行构建脚本:")
            print(f"   python build.py --platform all")
        return
    
    if args.check:
        results = manager.check_version_consistency()
        inconsistent = [r for r in results if not r[2]]
        if inconsistent:
            print(f"\n⚠️  发现 {len(inconsistent)} 个版本不一致的文件")
            print("建议检查这些文件并手动更新版本号")
        else:
            print("\n✅ 所有检查的文件版本号都一致")
        return
    
    # 默认显示当前版本
    current_version = manager.get_current_version()
    print(f"📋 当前版本: {current_version}")
    print(f"💡 要设置新版本，请运行: python version_manager.py --set <版本号>")
    print(f"💡 要检查版本一致性，请运行: python version_manager.py --check")

if __name__ == "__main__":
    main() 