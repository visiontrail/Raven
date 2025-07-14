#!/usr/bin/env python3
"""
Raven-锐测
支持GUI和CLI两种模式
"""

import sys
import argparse
import logging
from pathlib import Path

# 添加项目根目录到Python路径
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

# 对于PyInstaller打包的可执行文件，可能需要添加额外的路径
if getattr(sys, 'frozen', False):
    # 运行在PyInstaller环境中
    bundle_dir = Path(sys._MEIPASS)  # PyInstaller临时目录
    sys.path.insert(0, str(bundle_dir))
    sys.path.insert(0, str(bundle_dir / 'src'))

def setup_logging(debug=False):
    """设置日志"""
    # 使用新的日志配置工具
    from src.utils.logger_config import LoggerConfig
    LoggerConfig.setup_logging(debug=debug)

def main():
    # 设置参数解析器
    parser = argparse.ArgumentParser(description='Raven-锐测')
    parser.add_argument('--debug', action='store_true', help='启用调试模式')
    
    # 创建互斥组，确保只能选择一种模式
    mode_group = parser.add_mutually_exclusive_group()
    mode_group.add_argument('--gui', action='store_true', help='启动图形界面模式（默认）')
    mode_group.add_argument('--cli', action='store_true', help='启动命令行模式')
    
    # 解析已知参数，剩余参数留给CLI处理
    args, remaining_args = parser.parse_known_args()
    
    # 设置日志
    setup_logging(args.debug)
    logger = logging.getLogger(__name__)
    
    # 确定运行模式
    if args.cli:
        # CLI模式
        logger.info("Starting GalaxySpace TestAgent - CLI Mode")
        
        # 重新构建sys.argv，包含剩余参数，但排除已处理的参数
        sys.argv = [sys.argv[0]] + remaining_args
        
        try:
            from cli.commands import run_cli
            run_cli()
        except ImportError as e:
            logger.error(f"CLI module not available: {e}")
            print("CLI功能启动失败，请检查依赖")
            sys.exit(1)
    else:
        # GUI模式（默认或明确指定--gui）
        logger.info("Starting GalaxySpace TestAgent - GUI Mode")
        
        try:
            from gui.main_window import run_gui
            run_gui(debug=args.debug)
        except ImportError as e:
            logger.error(f"GUI module not available: {e}")
            print(f"GUI启动失败: {e}")
            print("请检查PyQt6是否正确安装")
            sys.exit(1)

if __name__ == '__main__':
    main() 