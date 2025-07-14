#!/usr/bin/env python3
"""
GalaxySpace TestAgent 启动脚本
"""

import sys
import os
from pathlib import Path

# 添加src目录到Python路径
src_path = Path(__file__).parent / 'src'
sys.path.insert(0, str(src_path))

if __name__ == '__main__':
    from main import main
    main() 