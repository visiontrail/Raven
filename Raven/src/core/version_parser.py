"""
版本号解析工具
"""

import re
from typing import Optional
from pathlib import Path
from utils.constants import VERSION_PATTERNS, FILENAME_PATTERNS

class VersionParser:
    """版本号解析器"""
    
    @staticmethod
    def parse_version_from_filename(filename: str) -> Optional[str]:
        """从文件名解析版本号"""
        # 尝试匹配组件文件名模式
        for pattern_name, pattern in FILENAME_PATTERNS.items():
            match = re.search(pattern, filename)
            if match and pattern_name == 'component':
                # 提取版本号部分
                version_part = match.group(2)
                return VersionParser._convert_version_format(version_part)
        
        # 尝试直接从文件名中提取版本号
        for pattern in VERSION_PATTERNS:
            match = re.search(pattern, filename)
            if match:
                groups = match.groups()
                if len(groups) == 4 and pattern == r'v(\d)(\d)(\d)(\d)':
                    # v1001 格式 (单个数字)
                    major, minor, patch, build = groups
                    return f"{major}.{minor}.{patch}.{build}"
                elif len(groups) == 4:
                    # 4段标准格式: v1.0.0.1, V1.0.0.1, 1.0.0.1
                    return f"{groups[0]}.{groups[1]}.{groups[2]}.{groups[3]}"
                elif len(groups) == 3:
                    # 3段格式: v1.0.0, V1.0.0, 1.0.0 - 自动补充build号为0
                    return f"{groups[0]}.{groups[1]}.{groups[2]}.0"
        
        return None
    
    @staticmethod
    def _convert_version_format(version_str: str) -> str:
        """转换版本格式 v1001 -> 1.0.0.1"""
        if len(version_str) == 4 and version_str.isdigit():
            major = version_str[0]
            minor = version_str[1]
            patch = version_str[2]
            build = version_str[3]
            return f"{major}.{minor}.{patch}.{build}"
        return version_str
    
    @staticmethod
    def validate_version(version: str) -> bool:
        """验证版本号格式"""
        # 移除可能的V前缀
        clean_version = version.lstrip('V')
        pattern = r'^\d+\.\d+\.\d+\.\d+$'
        return bool(re.match(pattern, clean_version))
    
    @staticmethod
    def format_version(version: str) -> str:
        """格式化版本号，确保以V开头"""
        if not version.startswith('V'):
            return f"V{version}"
        return version
    
    @staticmethod
    def version_to_numeric(version: str) -> str:
        """将版本号转换为数字格式，用于文件名"""
        # 移除V前缀并将点替换为空
        clean_version = version.lstrip('V').replace('.', '')
        return clean_version 