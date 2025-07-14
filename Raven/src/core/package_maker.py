"""
升级包制作核心逻辑
"""

import shutil
from pathlib import Path
from typing import List, Optional, Tuple
from datetime import datetime
import logging

from models.component import Component, PackageConfig
from core.file_processor import FileProcessor
from core.config_generator import ConfigGenerator
from core.version_parser import VersionParser
from utils.constants import COMPONENT_CONFIGS, MONTH_ABBR

class PackageMaker:
    """升级包制作器"""
    
    def __init__(self, temp_dir: Optional[Path] = None, output_dir: Optional[Path] = None):
        self.temp_dir = temp_dir or Path.cwd() / 'temp'
        self.output_dir = output_dir or Path.cwd() / 'output'
        self.temp_dir.mkdir(exist_ok=True)
        self.output_dir.mkdir(exist_ok=True)
        
        self.file_processor = FileProcessor(self.temp_dir)
        self.config_generator = ConfigGenerator()
        self.logger = logging.getLogger(__name__)
    
    def create_package(self, package_config: PackageConfig) -> Tuple[bool, str, Optional[Path]]:
        """
        创建升级包
        
        Returns:
            (success, message, output_file_path)
        """
        try:
            self.logger.info(f"[打包流程] ################################################")
            self.logger.info(f"[打包流程] 开始创建升级包")
            self.logger.info(f"[打包流程] 包类型: {package_config.package_type}")
            self.logger.info(f"[打包流程] 包版本: {package_config.package_version}")
            self.logger.info(f"[打包流程] 是否为Patch包: {package_config.is_patch}")
            
            # 验证配置
            self.logger.info(f"[打包流程] 🔍 开始验证配置...")
            validation_result = self._validate_package_config(package_config)
            if not validation_result[0]:
                self.logger.error(f"[打包流程] ✗ 配置验证失败: {validation_result[1]}")
                return validation_result[0], validation_result[1], None
            self.logger.info(f"[打包流程] ✓ 配置验证通过")
            
            # 创建临时工作目录
            work_dir = self.temp_dir / f"package_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            work_dir.mkdir(exist_ok=True)
            self.logger.info(f"[打包流程] 📁 创建工作目录: {work_dir}")
            
            # 统计选择的组件
            selected_components = package_config.get_selected_components()
            self.logger.info(f"[打包流程] 📦 将处理 {len(selected_components)} 个组件:")
            for i, component in enumerate(selected_components):
                self.logger.info(f"[打包流程]   {i+1}. {component.description} ({component.name})")
            
            # 处理组件文件
            self.logger.info(f"[打包流程] 🔧 开始处理组件文件...")
            processed_components = []
            for i, component in enumerate(selected_components):
                self.logger.info(f"[打包流程] 处理进度: {i+1}/{len(selected_components)}")
                result = self._process_component(component, work_dir)
                if not result[0]:
                    self.logger.error(f"[打包流程] ✗ 组件处理失败: {component.description}")
                    self.logger.error(f"[打包流程] 失败原因: {result[1]}")
                    return False, f"Failed to process component {component.description}: {result[1]}", None
                processed_components.append(result[2])
                self.logger.info(f"[打包流程] ✓ 组件处理成功: {component.description}")
            
            self.logger.info(f"[打包流程] ✓ 所有组件处理完成")
            
            # 生成si.ini
            self.logger.info(f"[打包流程] 📝 生成配置文件 si.ini...")
            si_ini_content = self.config_generator.generate_si_ini(package_config)
            si_ini_path = self.config_generator.save_si_ini(si_ini_content, work_dir)
            self.logger.info(f"[打包流程] ✓ si.ini 文件生成完成: {si_ini_path}")
            
            # 生成输出文件名
            output_filename = self._generate_output_filename(package_config)
            output_path = self.output_dir / output_filename
            self.logger.info(f"[打包流程] 📄 生成输出文件名: {output_filename}")
            self.logger.info(f"[打包流程] 完整输出路径: {output_path}")
            
            # 显示工作目录中的所有文件
            work_files = list(work_dir.iterdir())
            self.logger.info(f"[打包流程] 工作目录中的文件 (共{len(work_files)}个):")
            for file_path in work_files:
                if file_path.is_file():
                    file_size = file_path.stat().st_size
                    self.logger.info(f"[打包流程]   - {file_path.name} ({file_size} bytes)")
                else:
                    self.logger.info(f"[打包流程]   - {file_path.name} (目录)")
            
            # 创建最终压缩包
            self.logger.info(f"[打包流程] 🗜️ 开始创建最终压缩包...")
            success = self.file_processor.create_tgz_package(work_dir, output_path)
            if not success:
                self.logger.error(f"[打包流程] ✗ 创建压缩包失败")
                return False, "Failed to create final package", None
            
            # 验证输出文件
            if output_path.exists():
                final_size = output_path.stat().st_size
                self.logger.info(f"[打包流程] ✓ 最终压缩包创建成功")
                self.logger.info(f"[打包流程] 文件大小: {final_size} bytes ({final_size / 1024 / 1024:.2f} MB)")
            else:
                self.logger.error(f"[打包流程] ✗ 输出文件不存在: {output_path}")
                return False, "Output file was not created", None
            
            # 清理临时文件
            self.logger.info(f"[打包流程] 🧹 清理临时文件...")
            shutil.rmtree(work_dir)
            self.logger.info(f"[打包流程] ✓ 临时文件清理完成")
            
            self.logger.info(f"[打包流程] 🎉 升级包创建成功!")
            self.logger.info(f"[打包流程] 输出文件: {output_filename}")
            self.logger.info(f"[打包流程] ################################################")
            return True, f"Package created successfully: {output_filename}", output_path
            
        except Exception as e:
            self.logger.error(f"[打包流程] ✗ 创建升级包时发生严重错误: {e}")
            self.logger.error(f"[打包流程] ################################################")
            return False, f"Error creating package: {str(e)}", None
    
    def _validate_package_config(self, package_config: PackageConfig) -> Tuple[bool, str]:
        """验证包配置"""
        if not package_config.package_version:
            return False, "Package version is required"
        
        if not VersionParser.validate_version(package_config.package_version):
            return False, "Invalid package version format (expected: V1.0.0.1)"
        
        selected_components = package_config.get_selected_components()
        if not selected_components:
            return False, "No components selected"
        
        # 验证组件文件
        for component in selected_components:
            if not component.selected_file or not component.selected_file.exists():
                return False, f"File not found for component: {component.description}"
        
        return True, "Validation passed"
    
    def _process_component(self, component: Component, work_dir: Path) -> Tuple[bool, str, Optional[Path]]:
        """
        处理单个组件
        
        Returns:
            (success, message, processed_file_path)
        """
        try:
            self.logger.info(f"[组件处理] ================================================")
            self.logger.info(f"[组件处理] 开始处理组件: {component.description}")
            self.logger.info(f"[组件处理] 组件名称: {component.name}")
            self.logger.info(f"[组件处理] 组件属性: {component.file_attr}")
            self.logger.info(f"[组件处理] 期望文件名: {component.file_name}")
            self.logger.info(f"[组件处理] 支持的文件类型: {component.file_types}")
            
            source_file = component.selected_file
            self.logger.info(f"[组件处理] 选择的文件: {source_file}")
            
            if not source_file or not source_file.exists():
                self.logger.error(f"[组件处理] ✗ 源文件不存在或未选择")
                return False, f"Source file not found: {source_file}", None
            
            # 显示文件基本信息
            file_size = source_file.stat().st_size
            self.logger.info(f"[组件处理] 文件大小: {file_size} bytes ({file_size / 1024 / 1024:.2f} MB)")
            self.logger.info(f"[组件处理] 文件扩展名: {source_file.suffix}")
            
            # 检查是否为压缩文件
            is_archive = self.file_processor.is_archive_file(source_file)
            self.logger.info(f"[组件处理] 是否为压缩文件: {is_archive}")
            
            # 检查是否为直接打包模式
            if hasattr(component, 'direct_include') and component.direct_include:
                self.logger.info(f"[组件处理] 🔧 检测到直接打包模式，跳过解压处理")
                # 直接复制文件，不进行解压
                final_file = self.file_processor.copy_and_rename_file(
                    source_file, work_dir, component.file_name
                )
                
                self.logger.info(f"[组件处理] ✓ 直接复制完成: {final_file}")
                self.logger.info(f"[组件处理] ================================================")
                return True, "Component processed successfully (direct include)", final_file
            
            # 如果是压缩文件，先解压
            elif is_archive:
                self.logger.info(f"[组件处理] 📦 检测到压缩文件，开始解压...")
                extract_dir = self.file_processor.extract_archive(source_file)
                if not extract_dir:
                    self.logger.error(f"[组件处理] ✗ 解压失败")
                    return False, f"Failed to extract archive: {source_file}", None
                
                self.logger.info(f"[组件处理] ✓ 解压成功，解压目录: {extract_dir}")
                
                # 在解压目录中查找目标文件
                self.logger.info(f"[组件处理] 🔍 开始在解压目录中查找目标文件...")
                target_files = self.file_processor.find_files_by_type(extract_dir, component.file_types, component.file_name)
                
                if not target_files:
                    self.logger.error(f"[组件处理] ✗ 在解压的文件中未找到匹配的目标文件")
                    self.logger.error(f"[组件处理] 期望的文件类型: {component.file_types}")
                    
                    # 列出解压目录中的所有文件以便调试
                    all_files = list(extract_dir.rglob('*'))
                    files_only = [f for f in all_files if f.is_file()]
                    self.logger.error(f"[组件处理] 解压目录中实际包含的文件:")
                    for file_path in files_only:
                        relative_path = file_path.relative_to(extract_dir)
                        self.logger.error(f"[组件处理]   - {relative_path}")
                    
                    return False, f"No suitable files found in archive for component: {component.description}", None
                
                self.logger.info(f"[组件处理] ✓ 找到 {len(target_files)} 个匹配的文件:")
                for i, file_path in enumerate(target_files):
                    relative_path = file_path.relative_to(extract_dir)
                    file_size = file_path.stat().st_size
                    self.logger.info(f"[组件处理]   {i+1}. {relative_path} ({file_size} bytes)")
                
                # 选择第一个匹配的文件
                source_file = target_files[0]
                selected_relative = source_file.relative_to(extract_dir)
                self.logger.info(f"[组件处理] 🎯 选择使用文件: {selected_relative}")
                
            else:
                self.logger.info(f"[组件处理] 📄 直接使用原始文件（非压缩文件）")
            
            # 验证最终选择的文件
            if not source_file.exists():
                self.logger.error(f"[组件处理] ✗ 最终选择的文件不存在: {source_file}")
                return False, f"Selected file not found: {source_file}", None
            
            final_file_size = source_file.stat().st_size
            self.logger.info(f"[组件处理] 最终文件信息:")
            self.logger.info(f"[组件处理]   - 文件路径: {source_file}")
            self.logger.info(f"[组件处理]   - 文件大小: {final_file_size} bytes ({final_file_size / 1024:.2f} KB)")
            self.logger.info(f"[组件处理]   - 文件名: {source_file.name}")
            
            # 复制文件到工作目录，并重命名为标准名称
            self.logger.info(f"[组件处理] 📋 开始复制文件到工作目录...")
            self.logger.info(f"[组件处理] 目标文件名: {component.file_name}")
            
            final_file = self.file_processor.copy_and_rename_file(
                source_file, work_dir, component.file_name
            )
            
            # 自动解析版本号（如果用户没有手动输入）
            if not component.version:
                self.logger.info(f"[组件处理] 🏷️ 尝试自动解析版本号...")
                auto_version = VersionParser.parse_version_from_filename(source_file.name)
                if auto_version:
                    formatted_version = VersionParser.format_version(auto_version)
                    component.auto_version = formatted_version
                    self.logger.info(f"[组件处理] ✓ 自动识别版本号: {formatted_version}")
                else:
                    self.logger.info(f"[组件处理] ⚠️ 无法从文件名自动识别版本号")
            else:
                self.logger.info(f"[组件处理] 使用用户指定的版本号: {component.version}")
            
            self.logger.info(f"[组件处理] ✓ 组件处理完成: {component.description}")
            self.logger.info(f"[组件处理] 最终输出文件: {final_file}")
            self.logger.info(f"[组件处理] ================================================")
            
            return True, "Component processed successfully", final_file
            
        except Exception as e:
            self.logger.error(f"[组件处理] ✗ 处理组件时发生错误: {component.description}")
            self.logger.error(f"[组件处理] 错误详情: {e}")
            self.logger.error(f"[组件处理] ================================================")
            return False, str(e), None
    
    def _generate_output_filename(self, package_config: PackageConfig) -> str:
        """生成输出文件名"""
        now = datetime.now()
        date_str = now.strftime(f"%Y{MONTH_ABBR[now.month]}%d-%H%M")  # 2025Mar20-1143
        
        # 获取配置信息
        config_info = COMPONENT_CONFIGS.get(package_config.package_type)
        if not config_info:
            raise ValueError(f"Unknown package type: {package_config.package_type}")
        
        # 基础名称
        base_name = config_info.get('prefix', 'GalaxySpace-Unknown')
        
        # 后缀
        suffix = ""
        if package_config.is_patch:
            suffix = "-Patch"
        elif 'suffix' in config_info:
            suffix = f"-{config_info['suffix']}"
        
        # 清理版本号格式
        version = VersionParser.version_to_numeric(package_config.package_version)
        
        filename = f"{base_name}-{date_str}-V{version}{suffix}.tgz"
        return filename
    
    def get_component_template(self, package_type: str) -> List[Component]:
        """获取指定包类型的组件模板"""
        config_info = COMPONENT_CONFIGS.get(package_type)
        if not config_info:
            raise ValueError(f"Unknown package type: {package_type}")
    
        components = []
        for comp_key, comp_info in config_info['components'].items():
            component = Component(
                name=comp_key,
                file_attr=comp_info['file_attr'],
                file_name=comp_info['file_name'],
                file_types=comp_info['file_types'],
                description=comp_info['description'],
                direct_include=comp_info['direct_include']
            )
            components.append(component)
        
        return components
    
    def auto_detect_patch_mode(self, package_config: PackageConfig) -> bool:
        """自动检测是否应该为patch模式"""
        total_components = len(COMPONENT_CONFIGS[package_config.package_type]['components'])
        selected_count = len(package_config.get_selected_components())
        
        # 如果选择的组件数量少于总数，建议使用patch模式
        return selected_count < total_components
    
    def cleanup(self):
        """清理资源"""
        self.file_processor.cleanup_temp_files() 