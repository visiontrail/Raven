"""
组件数据模型
"""

from dataclasses import dataclass, field
from typing import Optional, List
from pathlib import Path

@dataclass
class Component:
    """组件信息"""
    name: str
    file_attr: int
    file_name: str
    file_types: List[str]
    description: str
    direct_include: bool = False  # 是否直接打包而不解压处理
    
    # 用户选择的文件信息
    selected_file: Optional[Path] = None
    version: Optional[str] = None
    auto_version: Optional[str] = None  # 从文件名自动解析的版本
    
    def is_selected(self) -> bool:
        """是否已选择文件"""
        return self.selected_file is not None
    
    def get_version(self) -> str:
        """获取版本号，优先使用用户输入的版本"""
        return self.version or self.auto_version or "V1.0.0.0"
    
    def validate_file_type(self, file_path: Path) -> bool:
        """验证文件类型是否符合要求"""
        file_ext = file_path.suffix.lower()
        file_name = file_path.name.lower()
        
        for file_type in self.file_types:
            if file_type.startswith('.'):
                # 扩展名匹配
                if file_ext == file_type.lower():
                    return True
            else:
                # 文件名匹配
                if file_type.lower() in file_name:
                    return True
        return False

@dataclass
class PackageConfig:
    """打包配置"""
    package_type: str  # 'lx07a_upgrade', 'lx07a_config', etc.
    package_version: str
    is_patch: bool = False
    output_dir: Optional[Path] = None
    selected_components: List[Component] = field(default_factory=list)
    
    def get_selected_components(self) -> List[Component]:
        """获取已选择的组件"""
        return [comp for comp in self.selected_components if comp.is_selected()]
    
    def is_complete_package(self) -> bool:
        """是否为完整包（所有组件都已选择）"""
        return len(self.get_selected_components()) == len(self.selected_components)
    
    def get_selected_count(self) -> int:
        """获取已选择组件数量"""
        return len(self.get_selected_components())
    
    def get_total_count(self) -> int:
        """获取总组件数量"""
        return len(self.selected_components) 