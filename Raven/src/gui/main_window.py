"""
主GUI窗口
"""

import sys
import logging
from pathlib import Path
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QTabWidget, QVBoxLayout, 
    QWidget, QMessageBox, QStatusBar, QMenuBar, QMenu
)
from PyQt6.QtCore import Qt, QThread, pyqtSignal
from PyQt6.QtGui import QAction, QIcon

from gui.upgrade_tab import UpgradeTab
from gui.config_tab import ConfigTab
from gui.chatbot_tab import ChatBotTab

class MainWindow(QMainWindow):
    """主窗口"""
    
    def __init__(self, debug=False):
        super().__init__()
        self.debug = debug
        self.init_ui()
        
    def init_ui(self):
        """初始化界面"""
        self.setWindowTitle("Raven-锐测")
        self.setGeometry(100, 100, 1200, 800)
        
        # 创建菜单栏
        self.create_menu_bar()
        
        # 创建中央部件
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        # 创建布局
        layout = QVBoxLayout(central_widget)
        
        # 创建选项卡
        self.tab_widget = QTabWidget()
        layout.addWidget(self.tab_widget)
        
        # 添加选项卡
        self.upgrade_tab_lx07a = UpgradeTab("lx07a_upgrade")
        self.upgrade_tab_lx10 = UpgradeTab("lx10_upgrade")
        self.upgrade_tab_sbd = UpgradeTab("sbd_upgrade")    # 预留
        self.config_tab = ConfigTab("lx07a_config")
        self.chatbot_tab = ChatBotTab()  # 预留的ChatBot
        
        self.tab_widget.addTab(self.upgrade_tab_lx07a, "灵犀07A升级包")
        self.tab_widget.addTab(self.upgrade_tab_lx10, "灵犀10升级包")
        self.tab_widget.addTab(self.upgrade_tab_sbd, "三标段升级包")
        self.tab_widget.addTab(self.config_tab, "灵犀07A|10配置文件包")
        self.tab_widget.addTab(self.chatbot_tab, "AI助手")
        
        # 创建状态栏
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        self.status_bar.showMessage("就绪")
        
        # 禁用暂未实现的选项卡
        self.tab_widget.setTabEnabled(2, False)  # 三标段
        self.tab_widget.setTabText(2, "三标段升级包 (暂未开放)")
        
        # 连接信号
        self._connect_signals()
        
    def create_menu_bar(self):
        """创建菜单栏"""
        menubar = self.menuBar()
        
        # 文件菜单
        file_menu = menubar.addMenu('文件')
        
        exit_action = QAction('退出', self)
        exit_action.setShortcut('Ctrl+Q')
        exit_action.triggered.connect(self.close)
        file_menu.addAction(exit_action)
        
        # 工具菜单
        tools_menu = menubar.addMenu('工具')
        
        clean_temp_action = QAction('清理临时文件', self)
        clean_temp_action.triggered.connect(self.clean_temp_files)
        tools_menu.addAction(clean_temp_action)
        
        open_output_action = QAction('打开输出目录', self)
        open_output_action.triggered.connect(self.open_output_dir)
        tools_menu.addAction(open_output_action)
        
        # 帮助菜单
        help_menu = menubar.addMenu('帮助')
        
        about_action = QAction('关于', self)
        about_action.triggered.connect(self.show_about)
        help_menu.addAction(about_action)
    
    def _connect_signals(self):
        """连接信号"""
        # 连接选项卡的状态更新信号
        if hasattr(self.upgrade_tab_lx07a, 'status_updated'):
            self.upgrade_tab_lx07a.status_updated.connect(self.update_status)
        if hasattr(self.config_tab, 'status_updated'):
            self.config_tab.status_updated.connect(self.update_status)
    
    def update_status(self, message: str):
        """更新状态栏"""
        self.status_bar.showMessage(message, 5000)
    
    def clean_temp_files(self):
        """清理临时文件"""
        try:
            temp_dir = Path('temp')
            if temp_dir.exists():
                import shutil
                shutil.rmtree(temp_dir)
                self.status_bar.showMessage("临时文件已清理", 3000)
                QMessageBox.information(self, "成功", "临时文件已清理")
        except Exception as e:
            QMessageBox.warning(self, "错误", f"清理临时文件失败: {str(e)}")
    
    def open_output_dir(self):
        """打开输出目录"""
        output_dir = Path('output')
        output_dir.mkdir(exist_ok=True)
        
        try:
            import os
            import platform
            
            if platform.system() == "Windows":
                os.startfile(output_dir)
            elif platform.system() == "Darwin":  # macOS
                os.system(f"open {output_dir}")
            else:  # Linux
                os.system(f"xdg-open {output_dir}")
                
        except Exception as e:
            QMessageBox.information(self, "输出目录", f"输出目录位置: {output_dir.absolute()}")
    
    def show_about(self):
        """显示关于对话框"""
        from src import __version__, __author__
        
        QMessageBox.about(
            self, 
            "关于", 
            f"Raven-锐测\n\n"
            f"版本: {__version__}\n"
            f"开发: {__author__}\n\n"
            "用于卫星通信载荷的升级包制作和测试辅助\n\n"
            "功能:\n"
            "• 灵犀07A升级包制作\n"
            "• 灵犀07A配置文件包制作\n"
            "• 支持多种压缩格式\n"
            "• 自动版本号识别\n"
            "• AI助手（预留）"
        )
    
    def closeEvent(self, event):
        """关闭事件"""
        reply = QMessageBox.question(
            self, 
            '确认退出', 
            "确定要退出程序吗？",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.No
        )
        
        if reply == QMessageBox.StandardButton.Yes:
            # 清理资源
            try:
                if hasattr(self, 'upgrade_tab_lx07a'):
                    self.upgrade_tab_lx07a.cleanup()
                if hasattr(self, 'config_tab'):
                    self.config_tab.cleanup()
            except Exception as e:
                logging.warning(f"Cleanup error: {e}")
            
            event.accept()
        else:
            event.ignore()

def run_gui(debug=False):
    """启动GUI应用"""
    from src import __version__
    
    app = QApplication(sys.argv)
    
    # 设置应用信息
    app.setApplicationName("GalaxySpace TestAgent")
    app.setApplicationVersion(__version__)
    app.setOrganizationName("GalaxySpace")
    
    # 设置样式
    app.setStyle('Fusion')
    
    # 创建主窗口
    window = MainWindow(debug)
    window.show()
    
    sys.exit(app.exec()) 