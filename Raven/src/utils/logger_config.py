"""
日志配置工具
专门处理Windows下中文编码问题
"""

import sys
import logging
import os
from pathlib import Path


class UTF8StreamHandler(logging.StreamHandler):
    """支持UTF-8编码的控制台日志处理器"""
    
    def __init__(self, stream=None):
        super().__init__(stream)
        
    def emit(self, record):
        try:
            msg = self.format(record)
            stream = self.stream
            
            # 在Windows下，优先尝试使用UTF-8编码输出
            if sys.platform == 'win32':
                try:
                    # 方法1：直接使用buffer写入UTF-8字节
                    if hasattr(stream, 'buffer'):
                        stream.buffer.write((msg + self.terminator).encode('utf-8'))
                        stream.buffer.flush()
                        return
                except (AttributeError, UnicodeEncodeError, OSError):
                    pass
                
                try:
                    # 方法2：尝试设置流的编码
                    if hasattr(stream, 'reconfigure'):
                        stream.reconfigure(encoding='utf-8')
                except:
                    pass
            
            # 标准方式输出
            stream.write(msg + self.terminator)
            if hasattr(stream, 'flush'):
                stream.flush()
                
        except Exception:
            self.handleError(record)


class LoggerConfig:
    """日志配置管理器"""
    
    @staticmethod
    def setup_windows_console_encoding():
        """设置Windows控制台编码"""
        if sys.platform == 'win32':
            # 设置环境变量
            os.environ['PYTHONIOENCODING'] = 'utf-8'
            
            # 尝试设置控制台代码页为UTF-8 (CP65001)
            try:
                import subprocess
                result = subprocess.run(['chcp', '65001'], 
                                      shell=True, 
                                      capture_output=True, 
                                      text=True)
                if result.returncode == 0:
                    print(f"[编码设置] 控制台代码页已设置为UTF-8")
                else:
                    print(f"[编码设置] 控制台代码页设置失败: {result.stderr}")
            except Exception as e:
                print(f"[编码设置] 设置控制台代码页时出错: {e}")
            
            # 设置标准输出编码
            try:
                if hasattr(sys.stdout, 'reconfigure'):
                    sys.stdout.reconfigure(encoding='utf-8')
                if hasattr(sys.stderr, 'reconfigure'):
                    sys.stderr.reconfigure(encoding='utf-8')
            except Exception as e:
                print(f"[编码设置] 重配置标准流编码时出错: {e}")
    
    @staticmethod
    def setup_logging(debug=False, log_dir='logs'):
        """设置日志配置
        
        Args:
            debug: 是否启用调试模式
            log_dir: 日志目录
        """
        # 设置Windows控制台编码
        LoggerConfig.setup_windows_console_encoding()
        
        level = logging.DEBUG if debug else logging.INFO
        
        # 确保日志目录存在
        log_path = Path(log_dir)
        log_path.mkdir(exist_ok=True)
        
        # 创建自定义格式器
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        
        # 创建处理器列表
        handlers = []
        
        # 文件处理器 - 明确指定UTF-8编码
        try:
            file_handler = logging.FileHandler(
                log_path / 'tester_agent.log', 
                encoding='utf-8',
                mode='a'
            )
            file_handler.setFormatter(formatter)
            file_handler.setLevel(level)
            handlers.append(file_handler)
        except Exception as e:
            print(f"[日志配置] 创建文件处理器失败: {e}")
        
        # 控制台处理器 - 使用自定义的UTF8StreamHandler
        try:
            console_handler = UTF8StreamHandler()
            console_handler.setFormatter(formatter)
            console_handler.setLevel(level)
            handlers.append(console_handler)
        except Exception as e:
            print(f"[日志配置] 创建控制台处理器失败: {e}")
            # 如果自定义处理器失败，降级到标准处理器
            try:
                fallback_handler = logging.StreamHandler()
                fallback_handler.setFormatter(formatter)
                fallback_handler.setLevel(level)
                handlers.append(fallback_handler)
            except Exception as e2:
                print(f"[日志配置] 创建备用控制台处理器也失败: {e2}")
        
        # 配置根日志器
        if handlers:
            logging.basicConfig(
                level=level,
                format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
                handlers=handlers,
                force=True  # 强制重新配置
            )
            
            # 测试日志输出
            logger = logging.getLogger(__name__)
            logger.info("日志系统初始化完成 - 中文编码测试: 测试消息")
            
        else:
            print("[日志配置] 错误: 无法创建任何日志处理器")
    
    @staticmethod
    def get_logger(name):
        """获取配置好的日志器"""
        return logging.getLogger(name) 