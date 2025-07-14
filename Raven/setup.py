"""
Raven-锐测 安装配置
"""

from setuptools import setup, find_packages
from pathlib import Path
import sys
import os

# 添加src目录到Python路径以便导入版本信息
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

try:
    from src import __version__, __author__
except ImportError:
    # 如果导入失败，使用备用方案
    __version__ = "1.0.0"
    __author__ = "GalaxySpace Team"

# 读取README文件
this_directory = Path(__file__).parent
long_description = (this_directory / "README.md").read_text(encoding='utf-8')

# 读取requirements文件
requirements = []
requirements_file = this_directory / "requirements.txt"
if requirements_file.exists():
    requirements = requirements_file.read_text().splitlines()

setup(
    name="galaxyspace-testagent",
    version=__version__,
    author=__author__,
    author_email="dev@galaxyspace.com",
    description="卫星通信载荷测试工具",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/galaxyspace/testagent",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Topic :: Software Development :: Build Tools",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.8",
    install_requires=requirements,
    extras_require={
        'dev': [
            'pytest>=6.0',
            'pytest-cov>=2.0',
            'black>=21.0',
            'flake8>=3.8',
            'mypy>=0.812',
        ],
        'rar': [
            'rarfile>=4.0',
        ],
    },
    entry_points={
        'console_scripts': [
            'galaxyspace-testagent=main:main',
            'gst=main:main',
        ],
    },
    include_package_data=True,
    package_data={
        '': ['*.txt', '*.md', '*.yml', '*.yaml'],
    },
    zip_safe=False,
) 