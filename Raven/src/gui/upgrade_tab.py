"""
升级包制作选项卡
"""

import os
from pathlib import Path
from typing import Dict, List, Optional
import logging
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QGridLayout,
    QLabel, QLineEdit, QPushButton, QCheckBox, QFileDialog,
    QMessageBox, QProgressBar, QGroupBox, QTextEdit, QSplitter
)
from PyQt6.QtCore import Qt, QThread, pyqtSignal, QTimer
from PyQt6.QtGui import QFont

from models.component import Component, PackageConfig
from core.package_maker import PackageMaker
from core.version_parser import VersionParser
from utils.constants import COMPONENT_CONFIGS

class GUILogHandler(logging.Handler):
    """GUI日志处理器，将日志消息发送到GUI"""
    
    def __init__(self, log_signal):
        super().__init__()
        self.log_signal = log_signal
        
    def emit(self, record):
        """发送日志记录"""
        try:
            msg = self.format(record)
            # 确保消息是字符串类型，并处理可能的编码问题
            if isinstance(msg, bytes):
                msg = msg.decode('utf-8', errors='replace')
            elif not isinstance(msg, str):
                msg = str(msg)
            
            self.log_signal.emit(msg)
        except Exception as e:
            # 如果日志记录本身失败，至少尝试发送错误信息
            try:
                error_msg = f"日志记录失败: {str(e)}"
                self.log_signal.emit(error_msg)
            except:
                pass  # 如果连错误信息都无法发送，就放弃

class PackageWorker(QThread):
    """打包工作线程"""
    progress_updated = pyqtSignal(int)
    status_updated = pyqtSignal(str)
    log_message = pyqtSignal(str)  # 新增详细日志信号
    finished = pyqtSignal(bool, str, str)  # success, message, output_path
    
    def __init__(self, package_config: PackageConfig):
        super().__init__()
        self.package_config = package_config
        self.package_maker = PackageMaker()
        
        # 设置GUI日志处理器
        self.setup_logging()
    
    def setup_logging(self):
        """设置日志处理器"""
        # 创建GUI日志处理器
        self.gui_handler = GUILogHandler(self.log_message)
        self.gui_handler.setLevel(logging.INFO)
        
        # 设置格式
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        self.gui_handler.setFormatter(formatter)
        
        # 为核心模块添加GUI日志处理器
        core_loggers = [
            'core.package_maker',
            'core.file_processor', 
            'core.config_generator',
            '__main__'
        ]
        
        for logger_name in core_loggers:
            logger = logging.getLogger(logger_name)
            logger.addHandler(self.gui_handler)
            logger.setLevel(logging.INFO)
    
    def run(self):
        """执行打包任务"""
        try:
            self.status_updated.emit("开始打包...")
            self.progress_updated.emit(10)
            
            result = self.package_maker.create_package(self.package_config)
            
            self.progress_updated.emit(100)
            
            if result[0]:
                self.finished.emit(True, result[1], str(result[2]) if result[2] else "")
            else:
                self.finished.emit(False, result[1], "")
                
        except Exception as e:
            self.finished.emit(False, f"打包过程中发生错误: {str(e)}", "")
        finally:
            # 清理日志处理器
            self.cleanup_logging()
    
    def cleanup_logging(self):
        """清理日志处理器"""
        core_loggers = [
            'core.package_maker',
            'core.file_processor', 
            'core.config_generator',
            '__main__'
        ]
        
        for logger_name in core_loggers:
            logger = logging.getLogger(logger_name)
            if hasattr(self, 'gui_handler') and self.gui_handler in logger.handlers:
                logger.removeHandler(self.gui_handler)

class UpgradeTab(QWidget):
    """升级包制作选项卡"""
    
    status_updated = pyqtSignal(str)
    
    def __init__(self, package_type: str):
        super().__init__()
        self.package_type = package_type
        self.components: Dict[str, Component] = {}
        self.component_widgets: Dict[str, Dict] = {}
        self.package_maker = PackageMaker()
        self.worker = None
        
        self.init_ui()
        self.load_components()
        
    def init_ui(self):
        """初始化界面"""
        layout = QVBoxLayout(self)
        
        # 创建分割器
        splitter = QSplitter(Qt.Orientation.Horizontal)
        layout.addWidget(splitter)
        
        # 左侧：控制面板
        control_panel = self.create_control_panel()
        splitter.addWidget(control_panel)
        
        # 右侧：日志面板
        log_panel = self.create_log_panel()
        splitter.addWidget(log_panel)
        
        # 设置分割比例
        splitter.setSizes([800, 400])
        
    def create_control_panel(self) -> QWidget:
        """创建控制面板"""
        panel = QWidget()
        layout = QVBoxLayout(panel)
        
        # 版本信息组
        version_group = QGroupBox("版本信息")
        version_layout = QHBoxLayout(version_group)
        
        version_layout.addWidget(QLabel("整包版本号:"))
        self.version_input = QLineEdit()
        self.version_input.setPlaceholderText("例如: 1.0.0.7")
        self.version_input.textChanged.connect(self.update_preview)
        version_layout.addWidget(self.version_input)
        
        layout.addWidget(version_group)
        
        # 组件选择组
        self.components_group = QGroupBox("组件选择")
        self.components_layout = QGridLayout(self.components_group)
        layout.addWidget(self.components_group)
        
        # Patch模式
        self.patch_checkbox = QCheckBox("是否为PATCH包")
        self.patch_checkbox.stateChanged.connect(self.update_preview)
        layout.addWidget(self.patch_checkbox)
        
        # 按钮区域
        button_layout = QHBoxLayout()
        
        self.package_button = QPushButton("开始打包")
        self.package_button.clicked.connect(self.start_packaging)
        button_layout.addWidget(self.package_button)
        
        self.clear_button = QPushButton("清空选择")
        self.clear_button.clicked.connect(self.clear_selections)
        button_layout.addWidget(self.clear_button)
        
        button_layout.addStretch()
        layout.addLayout(button_layout)
        
        # 进度条
        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        layout.addWidget(self.progress_bar)
        
        layout.addStretch()
        return panel
        
    def create_log_panel(self) -> QWidget:
        """创建日志面板"""
        panel = QWidget()
        layout = QVBoxLayout(panel)
        
        layout.addWidget(QLabel("操作日志:"))
        
        self.log_text = QTextEdit()
        self.log_text.setReadOnly(True)
        self.log_text.setMaximumHeight(200)
        layout.addWidget(self.log_text)
        
        # 预览区域
        layout.addWidget(QLabel("si.ini 预览:"))
        
        self.preview_text = QTextEdit()
        self.preview_text.setReadOnly(True)
        self.preview_text.setFont(QFont("Consolas", 9))
        layout.addWidget(self.preview_text)
        
        return panel
    
    def load_components(self):
        """加载组件配置"""
        try:
            components_list = self.package_maker.get_component_template(self.package_type)
            
            row = 0
            for component in components_list:
                self.components[component.name] = component
                
                # 创建组件UI
                widgets = self.create_component_widgets(component, row)
                self.component_widgets[component.name] = widgets
                
                row += 1
                
        except Exception as e:
            self.log_message(f"加载组件配置失败: {str(e)}")
    
    def create_component_widgets(self, component: Component, row: int) -> Dict:
        """创建单个组件的UI控件"""
        widgets = {}
        
        # 描述标签
        desc_label = QLabel(f"{component.description}:")
        desc_label.setFixedWidth(120)
        self.components_layout.addWidget(desc_label, row, 0)
        widgets['desc_label'] = desc_label
        
        # 文件选择
        file_layout = QHBoxLayout()
        
        file_input = QLineEdit()
        file_input.setPlaceholderText("请选择文件...")
        file_input.setReadOnly(True)
        file_layout.addWidget(file_input)
        widgets['file_input'] = file_input
        
        file_button = QPushButton("浏览")
        file_button.clicked.connect(lambda checked, comp=component: self.select_file(comp))
        file_layout.addWidget(file_button)
        widgets['file_button'] = file_button
        
        file_widget = QWidget()
        file_widget.setLayout(file_layout)
        self.components_layout.addWidget(file_widget, row, 1)
        widgets['file_widget'] = file_widget
        
        # 版本输入
        version_input = QLineEdit()
        version_input.setPlaceholderText("自动识别或手动输入")
        version_input.textChanged.connect(lambda text, comp=component: self.on_version_changed(comp, text))
        self.components_layout.addWidget(version_input, row, 2)
        widgets['version_input'] = version_input
        
        return widgets
    
    def select_file(self, component: Component):
        """选择文件"""
        file_path, _ = QFileDialog.getOpenFileName(
            self,
            f"选择 {component.description} 文件",
            "",
            "所有支持的文件 (*.zip *.rar *.tgz *.tar.gz *.bin *.deb);;所有文件 (*)"
        )
        
        if file_path:
            file_path = Path(file_path)
            
            # 检查是否为rar文件，如果是则弹出警告
            if file_path.suffix.lower() == '.rar':
                QMessageBox.warning(
                    self,
                    "格式兼容性警告",
                    "由于程序对解压rar文件支持能力不足，后续的打包流程大概率会失败，请建议软件发布人员改用zip或tgz格式进行发布"
                )
            
            component.selected_file = file_path
            
            # 更新UI
            widgets = self.component_widgets[component.name]
            widgets['file_input'].setText(str(file_path))
            
            # 尝试自动解析版本号
            auto_version = VersionParser.parse_version_from_filename(file_path.name)
            if auto_version:
                formatted_version = VersionParser.format_version(auto_version)
                component.auto_version = formatted_version
                widgets['version_input'].setPlaceholderText(f"自动识别: {formatted_version}")
            
            self.log_message(f"已选择文件: {component.description} -> {file_path.name}")
            self.update_preview()
    
    def on_version_changed(self, component: Component, version: str):
        """版本号输入变化"""
        component.version = version if version.strip() else None
        self.update_preview()
    

    
    def update_preview(self):
        """更新si.ini预览"""
        try:
            version = self.version_input.text().strip()
            if not version:
                self.preview_text.clear()
                return
                
            # 创建配置对象
            config = PackageConfig(
                package_type=self.package_type,
                package_version=VersionParser.format_version(version),
                is_patch=self.patch_checkbox.isChecked(),
                selected_components=list(self.components.values())
            )
            
            # 生成预览
            from core.config_generator import ConfigGenerator
            generator = ConfigGenerator()
            content = generator.generate_si_ini(config)
            self.preview_text.setPlainText(content)
            
        except Exception as e:
            self.preview_text.setPlainText(f"预览生成失败: {str(e)}")
    
    def start_packaging(self):
        """开始打包"""
        try:
            # 验证输入
            version = self.version_input.text().strip()
            if not version:
                QMessageBox.warning(self, "错误", "请输入整包版本号")
                return
            
            if not VersionParser.validate_version(version):
                QMessageBox.warning(self, "错误", "版本号格式错误，请使用 V1.0.0.1 格式")
                return
            
            selected_components = [comp for comp in self.components.values() if comp.is_selected()]
            if not selected_components:
                QMessageBox.warning(self, "错误", "请至少选择一个组件")
                return
            
            # 检查是否需要启用patch模式
            if not self.patch_checkbox.isChecked():
                selected_count = len(selected_components)
                total_count = len(self.components)
                
                if 0 < selected_count < total_count:
                    # 提示用户是否启用patch模式
                    reply = QMessageBox.question(
                        self,
                        "Patch模式",
                        f"您只选择了 {selected_count}/{total_count} 个组件。\n是否启用Patch模式？",
                        QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
                    )
                    
                    if reply == QMessageBox.StandardButton.Yes:
                        self.patch_checkbox.setChecked(True)
                        self.update_preview()  # 更新预览以反映patch模式的变化
                    else:
                        # 用户选择否，退出打包流程，让用户继续选择文件
                        return
            
            # 创建配置
            config = PackageConfig(
                package_type=self.package_type,
                package_version=VersionParser.format_version(version),
                is_patch=self.patch_checkbox.isChecked(),
                selected_components=list(self.components.values())
            )
            
            # 启动打包线程
            self.worker = PackageWorker(config)
            self.worker.progress_updated.connect(self.progress_bar.setValue)
            self.worker.status_updated.connect(self.log_message)
            self.worker.log_message.connect(self.log_detailed_message)  # 连接详细日志
            self.worker.finished.connect(self.on_packaging_finished)
            
            # UI状态
            self.package_button.setEnabled(False)
            self.progress_bar.setVisible(True)
            self.progress_bar.setValue(0)
            
            self.worker.start()
            self.log_message("开始打包任务...")
            
        except Exception as e:
            QMessageBox.critical(self, "错误", f"启动打包失败: {str(e)}")
    
    def on_packaging_finished(self, success: bool, message: str, output_path: str):
        """打包完成"""
        self.package_button.setEnabled(True)
        self.progress_bar.setVisible(False)
        
        if success:
            self.log_message(f"✓ 打包成功: {message}")
            QMessageBox.information(self, "成功", f"{message}\n\n输出文件: {output_path}")
            self.status_updated.emit("打包完成")
        else:
            self.log_message(f"✗ 打包失败: {message}")
            QMessageBox.critical(self, "失败", f"打包失败:\n{message}")
            self.status_updated.emit("打包失败")
    
    def clear_selections(self):
        """清空所有选择"""
        for component in self.components.values():
            component.selected_file = None
            component.version = None
            component.auto_version = None
            
        for widgets in self.component_widgets.values():
            widgets['file_input'].clear()
            widgets['version_input'].clear()
            widgets['version_input'].setPlaceholderText("自动识别或手动输入")
        
        self.version_input.clear()
        self.patch_checkbox.setChecked(False)
        self.preview_text.clear()
        
        self.log_message("已清空所有选择")
    
    def log_message(self, message: str):
        """添加日志消息"""
        from datetime import datetime
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.log_text.append(f"[{timestamp}] {message}")
        
        # 滚动到底部
        scrollbar = self.log_text.verticalScrollBar()
        scrollbar.setValue(scrollbar.maximum())
    
    def log_detailed_message(self, message: str):
        """添加详细日志消息（来自核心模块）"""
        # 直接添加详细日志，不需要再加时间戳（核心模块的日志已经包含）
        self.log_text.append(message)
        
        # 滚动到底部
        scrollbar = self.log_text.verticalScrollBar()
        scrollbar.setValue(scrollbar.maximum())
    
    def cleanup(self):
        """清理资源"""
        if self.worker and self.worker.isRunning():
            self.worker.terminate()
            self.worker.wait()
        
        if hasattr(self, 'package_maker'):
            self.package_maker.cleanup() 