"""
Raven-锐测
"""

__version__ = "0.0.1"
__author__ = "GalaxySpace Team"

# 版本信息
VERSION_INFO = {
    'major': 0,
    'minor': 0,
    'patch': 1,
    'version': __version__,
    'author': __author__
}

def get_version():
    """获取版本号"""
    return __version__

def get_version_info():
    """获取版本信息"""
    return VERSION_INFO 