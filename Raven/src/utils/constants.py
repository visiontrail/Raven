"""
常量定义
"""

# 支持的组件配置
COMPONENT_CONFIGS = {
    'lx07a_upgrade': {
        'name': '灵犀07A升级包',
        'packet_attr': 1001,
        'patch_packet_attr': 1002,
        'prefix': 'GalaxySpace-Lx07A',
        'components': {
            'oam': {
                'file_name': 'gnb-oam-lx07a',
                'file_attr': 301,
                'file_types': ['gnb-oam-lx07a'],
                'description': 'OAM软件',
                'direct_include': False  # 需要解压处理
            },
            'sct_fpga': {
                'file_name': 'sct.bin',
                'file_attr': 303,
                'file_types': ['.bin'],
                'description': '主控板FPGA',
                'direct_include': False  # 需要解压处理
            },
            'bposc_fpga': {
                'file_name': 'bposc.bin',
                'file_attr': 310,
                'file_types': ['.bin'],
                'description': '基带板FPGA',
                'direct_include': False  # 需要解压处理
            },
            'bpoqv_fpga': {
                'file_name': 'bpoqv.bin',
                'file_attr': 315,
                'file_types': ['.bin'],
                'description': 'QV基带FPGA',
                'direct_include': False  # 需要解压处理
            },
            'cucp': {
                'file_name': 'cucp.deb',
                'file_attr': 302,
                'file_types': ['.deb'],
                'description': '协议栈CUCP',
                'direct_include': False  # 需要解压处理
            },
            'cuup': {
                'file_name': 'cuup.deb',
                'file_attr': 307,
                'file_types': ['.deb'],
                'description': '协议栈CUUP',
                'direct_include': False  # 需要解压处理
            },
            'du': {
                'file_name': 'du.deb',
                'file_attr': 308,
                'file_types': ['.deb'],
                'description': '协议栈DU',
                'direct_include': False  # 需要解压处理
            }
        }
    },
    'lx07a_config': {
        'name': '配置文件包',
        'packet_attr': 1300,
        'prefix': 'GalaxySpace',
        'suffix': 'Config',
        'components': {
            'cwmp_data': {
                'file_name': 'cwmp_data.xml',
                'file_attr': 316,
                'file_types': ['.xml'],
                'description': 'CWMP数据文件',
                'direct_include': False  # 需要解压处理
            },
            'cucp_gnb': {
                'file_name': 'conf.gnb_cucp.gnb.json',
                'file_attr': 317,
                'file_types': ['.json'],
                'description': 'CUCP GNB配置',
                'direct_include': False  # 需要解压处理
            },
            'cucp_stack': {
                'file_name': 'conf.gnb_cucp.stack.json',
                'file_attr': 318,
                'file_types': ['.json'],
                'description': 'CUCP Stack配置',
                'direct_include': False  # 需要解压处理
            },
            'cuup_gnb': {
                'file_name': 'conf.gnb_cuup.gnb.json',
                'file_attr': 319,
                'file_types': ['.json'],
                'description': 'CUUP GNB配置',
                'direct_include': False  # 需要解压处理
            },
            'cuup_stack': {
                'file_name': 'conf.gnb_cuup.stack.json',
                'file_attr': 320,
                'file_types': ['.json'],
                'description': 'CUUP Stack配置',
                'direct_include': False  # 需要解压处理
            },
            'du_gnb': {
                'file_name': 'conf.gnb_du.gnb.json',
                'file_attr': 321,
                'file_types': ['.json'],
                'description': 'DU GNB配置',
                'direct_include': False  # 需要解压处理
            },
            'du_stack': {
                'file_name': 'conf.gnb_du.stack.json',
                'file_attr': 322,
                'file_types': ['.json'],
                'description': 'DU Stack配置',
                'direct_include': False  # 需要解压处理
            }
        }
    },
    # 灵犀10升级包配置
    'lx10_upgrade': {
        'name': '灵犀10升级包',
        'packet_attr': 1001,
        'patch_packet_attr': 1002,
        'prefix': 'GalaxySpace-Lx10',
        'components': {
            'oam': {
                'file_name': 'gnb-oam-lx10',
                'file_attr': 301,
                'file_types': ['gnb-oam-lx10'],
                'description': 'OAM软件',
                'direct_include': False  # 需要解压处理
            },
            'sct_fpga': {
                'file_name': 'sct.bin',
                'file_attr': 303,
                'file_types': ['.bin'],
                'description': '主控板FPGA',
                'direct_include': False  # 需要解压处理
            },
            'bposc_fpga': {
                'file_name': 'bposc.bin',
                'file_attr': 310,
                'file_types': ['.bin'],
                'description': '基带板FPGA',
                'direct_include': False  # 需要解压处理
            },
            'bpodvb_fpga': {
                'file_name': 'bpodvb.bin',
                'file_attr': 315,
                'file_types': ['.bin'],
                'description': 'DVB基带FPGA',
                'direct_include': False  # 需要解压处理
            },
            'cucp': {
                'file_name': 'cucp.deb',
                'file_attr': 302,
                'file_types': ['.deb'],
                'description': '协议栈CUCP',
                'direct_include': False  # 需要解压处理
            },
            'cuup': {
                'file_name': 'cuup.deb',
                'file_attr': 307,
                'file_types': ['.deb'],
                'description': '协议栈CUUP',
                'direct_include': False  # 需要解压处理
            },
            'du': {
                'file_name': 'du.deb',
                'file_attr': 308,
                'file_types': ['.deb'],
                'description': '协议栈DU',
                'direct_include': False  # 需要解压处理
            },
            'galaxy_core_network': {
                'file_name': 'galaxy_core_network.tgz',
                'file_attr': 401,
                'file_types': ['.tgz', '.tar.gz'],
                'description': '银河自研核心网',
                'direct_include': True  # 标识为直接打包，不解压处理
            },
            # 'xw_core_network': {
            #     'file_name': 'xw_core_network.tgz',
            #     'file_attr': 402,
            #     'file_types': ['.tgz', '.tar.gz'],
            #     'description': 'XW上海院核心网',
            #     'direct_include': True  # 标识为直接打包，不解压处理
            # },
            'satellite_app_server': {
                'file_name': 'satellite_app_server.tgz',
                'file_attr': 403,
                'file_types': ['.tgz', '.tar.gz'],
                'description': '星载应用服务器',
                'direct_include': True  # 标识为直接打包，不解压处理
            }
        }
    },
    # 预留三标段升级包配置
    'sbd_upgrade': {
        'name': '三标段升级包',
        'packet_attr': 3001,
        'patch_packet_attr': 3002,
        'prefix': 'GalaxySpace-TRD',
        'components': {
            # TODO: 后续扩展
        }
    }
}

# 支持的压缩格式
SUPPORTED_ARCHIVES = {
    '.zip': 'zip',
    '.rar': 'rar',
    '.tgz': 'tgz',
    '.tar.gz': 'tgz'
}

# 版本号解析正则表达式
VERSION_PATTERNS = [
    r'v(\d)(\d)(\d)(\d)',  # v1001 -> 1.0.0.1
    r'V(\d+)\.(\d+)\.(\d+)\.(\d+)',  # V1.0.0.1
    r'(\d+)\.(\d+)\.(\d+)\.(\d+)',   # 1.0.0.1
    r'v(\d+)\.(\d+)\.(\d+)\.(\d+)',  # v1.0.0.1 (小写v + 4段)
    r'v(\d+)\.(\d+)\.(\d+)',         # v1.0.0 (小写v + 3段)
    r'V(\d+)\.(\d+)\.(\d+)',         # V1.0.0 (大写V + 3段)
    r'(\d+)\.(\d+)\.(\d+)',          # 1.0.0 (无前缀 + 3段)
]

# 文件名模式
FILENAME_PATTERNS = {
    'component': r'(.+)_v(\d+)_([a-f0-9]+)_(\d{8}-\d{4})\.(tgz|zip|rar)',
    'package': r'GalaxySpace-(.+)-(\d{4}[A-Za-z]{3}\d{2})-(\d{4})-V(\d+)(-\w+)?\.tgz'
}

# 月份缩写映射
MONTH_ABBR = {
    1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr', 5: 'May', 6: 'Jun',
    7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec'
}

# 默认配置
DEFAULT_CONFIG = {
    'temp_dir': 'temp',
    'output_dir': 'output',
    'log_dir': 'logs',
    'publisher': 'yinhe'
} 