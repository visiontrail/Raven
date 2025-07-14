"""
si.ini配置文件生成器
"""

from pathlib import Path
from typing import List
from datetime import datetime
import logging

from models.component import Component, PackageConfig
from utils.constants import COMPONENT_CONFIGS, DEFAULT_CONFIG

class ConfigGenerator:
    """si.ini配置文件生成器"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def generate_si_ini(self, package_config: PackageConfig) -> str:
        """生成si.ini内容"""
        selected_components = package_config.get_selected_components()
        
        if not selected_components:
            raise ValueError("No components selected")
        
        # 获取包配置信息
        config_info = COMPONENT_CONFIGS.get(package_config.package_type)
        if not config_info:
            raise ValueError(f"Unknown package type: {package_config.package_type}")
        
        # 确定PacketAttr
        if package_config.is_patch and 'patch_packet_attr' in config_info:
            packet_attr = config_info['patch_packet_attr']
        else:
            packet_attr = config_info['packet_attr']
        
        # 生成配置内容
        lines = [
            f"Packet_Ver={package_config.package_version};",
            f"PacketAtttir={packet_attr};",
            f"Publisher={DEFAULT_CONFIG['publisher']};",
            f"FileNumInPacket={len(selected_components)};",
            ""
        ]
        
        # 添加文件信息
        for i, component in enumerate(selected_components, 1):
            lines.extend([
                f"FileName_{i}={component.file_name};",
                f"FileAttr_{i}={component.file_attr};",
                f"FileVer_{i}={component.get_version()};",
                ""
            ])
        
        content = "\n".join(lines)
        self.logger.info("Generated si.ini content")
        return content
    
    def save_si_ini(self, content: str, output_dir: Path) -> Path:
        """保存si.ini文件"""
        output_dir.mkdir(parents=True, exist_ok=True)
        si_ini_path = output_dir / "si.ini"
        
        with open(si_ini_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        self.logger.info(f"Saved si.ini to {si_ini_path}")
        return si_ini_path 