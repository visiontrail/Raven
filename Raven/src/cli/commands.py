"""
CLI命令接口
"""

import click
import sys
from pathlib import Path
from typing import List

from models.component import Component, PackageConfig
from core.package_maker import PackageMaker
from core.version_parser import VersionParser
from utils.constants import COMPONENT_CONFIGS
from src import __version__

@click.group()
@click.version_option(version=__version__)
def cli():
    """Raven-锐测 - CLI模式"""
    pass

@cli.command()
@click.option('--package-type', '-t', 
              type=click.Choice(['lx07a_upgrade', 'lx07a_config']),
              required=True,
              help='包类型')
@click.option('--version', '-v', required=True, help='包版本号 (例如: 1.0.0.7)')
@click.option('--output-dir', '-o', default='output', help='输出目录')
@click.option('--patch', is_flag=True, help='是否为Patch包 (仅适用于升级包)')
@click.option('--component', '-c', multiple=True, 
              help='组件文件，格式: 组件名:文件路径[:版本号]')
def package(package_type, version, output_dir, patch, component):
    """创建升级包或配置文件包"""
    
    try:
        # 验证版本号
        if not VersionParser.validate_version(version):
            click.echo(f"错误: 版本号格式错误 '{version}'，请使用 V1.0.0.1 格式", err=True)
            sys.exit(1)
        
        # 创建包制作器
        package_maker = PackageMaker(output_dir=Path(output_dir))
        
        # 获取组件模板
        components = package_maker.get_component_template(package_type)
        
        # 解析组件参数
        component_map = {}
        for comp_str in component:
            parts = comp_str.split(':')
            if len(parts) < 2:
                click.echo(f"错误: 组件参数格式错误 '{comp_str}'", err=True)
                click.echo("格式: 组件名:文件路径[:版本号]", err=True)
                sys.exit(1)
            
            comp_name = parts[0]
            file_path = Path(parts[1])
            comp_version = parts[2] if len(parts) > 2 else None
            
            if not file_path.exists():
                click.echo(f"错误: 文件不存在 '{file_path}'", err=True)
                sys.exit(1)
            
            component_map[comp_name] = (file_path, comp_version)
        
        # 设置组件文件
        selected_components = []
        for comp in components:
            if comp.name in component_map:
                file_path, comp_version = component_map[comp.name]
                comp.selected_file = file_path
                comp.version = comp_version
                selected_components.append(comp)
        
        if not selected_components:
            click.echo("错误: 没有选择任何组件", err=True)
            sys.exit(1)
        
        # 创建包配置
        config = PackageConfig(
            package_type=package_type,
            package_version=VersionParser.format_version(version),
            is_patch=patch,
            output_dir=Path(output_dir),
            selected_components=components
        )
        
        # 开始打包
        click.echo(f"开始创建 {COMPONENT_CONFIGS[package_type]['name']}...")
        click.echo(f"版本: {config.package_version}")
        click.echo(f"组件数量: {len(selected_components)}")
        if patch:
            click.echo("模式: Patch包")
        
        result = package_maker.create_package(config)
        
        if result[0]:
            click.echo(f"✓ 成功: {result[1]}")
            if result[2]:
                click.echo(f"输出文件: {result[2]}")
        else:
            click.echo(f"✗ 失败: {result[1]}", err=True)
            sys.exit(1)
            
    except Exception as e:
        click.echo(f"错误: {str(e)}", err=True)
        sys.exit(1)

@cli.command()
@click.option('--package-type', '-t',
              type=click.Choice(['lx07a_upgrade', 'lx07a_config']),
              help='包类型，如果不指定则显示所有类型')
def list_components(package_type):
    """列出可用的组件"""
    
    package_maker = PackageMaker()
    
    if package_type:
        types_to_show = [package_type]
    else:
        types_to_show = ['lx07a_upgrade', 'lx07a_config']
    
    for pkg_type in types_to_show:
        try:
            config_info = COMPONENT_CONFIGS[pkg_type]
            click.echo(f"\n{config_info['name']} ({pkg_type}):")
            click.echo("=" * 50)
            
            components = package_maker.get_component_template(pkg_type)
            for comp in components:
                click.echo(f"  {comp.name:15} - {comp.description}")
                click.echo(f"                  文件名: {comp.file_name}")
                click.echo(f"                  文件类型: {', '.join(comp.file_types)}")
                click.echo()
                
        except Exception as e:
            click.echo(f"错误: 无法获取 {pkg_type} 的组件信息: {str(e)}", err=True)

@cli.command()
@click.argument('filename')
def parse_version(filename):
    """从文件名解析版本号"""
    
    version = VersionParser.parse_version_from_filename(filename)
    if version:
        click.echo(f"解析结果: {version}")
        formatted = VersionParser.format_version(version)
        click.echo(f"格式化版本: {formatted}")
    else:
        click.echo("无法从文件名中解析版本号", err=True)

@cli.command()
def cleanup():
    """清理临时文件"""
    
    try:
        temp_dir = Path('temp')
        if temp_dir.exists():
            import shutil
            shutil.rmtree(temp_dir)
            click.echo("临时文件已清理")
        else:
            click.echo("没有找到临时文件")
    except Exception as e:
        click.echo(f"清理失败: {str(e)}", err=True)

def run_cli():
    """运行CLI应用"""
    cli() 