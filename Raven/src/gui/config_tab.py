"""
配置文件包制作选项卡
"""

from pathlib import Path
from typing import Dict, List
import logging
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QGridLayout,
    QLabel, QLineEdit, QPushButton, QFileDialog,
    QMessageBox, QProgressBar, QGroupBox, QTextEdit, QSplitter
)
from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtGui import QFont

from models.component import Component, PackageConfig
from core.package_maker import PackageMaker
from core.version_parser import VersionParser
from gui.upgrade_tab import PackageWorker

class ConfigTab(QWidget):
    """配置文件包制作选项卡"""
    
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
        
        version_layout.addWidget(QLabel("配置包版本号:"))
        self.version_input = QLineEdit()
        self.version_input.setPlaceholderText("例如: 1.0.0.0")
        self.version_input.setText("V1.0.0.0")  # 配置文件包默认版本
        self.version_input.textChanged.connect(self.update_preview)
        version_layout.addWidget(self.version_input)
        
        layout.addWidget(version_group)
        
        # 组件选择组
        self.components_group = QGroupBox("配置文件选择")
        self.components_layout = QGridLayout(self.components_group)
        layout.addWidget(self.components_group)
        
        # 说明
        info_label = QLabel("提示: 可以选择部分配置文件进行打包，未选择的文件将不包含在最终包中。")
        info_label.setStyleSheet("color: #666; font-size: 11px;")
        info_label.setWordWrap(True)
        layout.addWidget(info_label)
        
        # 按钮区域
        button_layout = QHBoxLayout()
        
        self.package_button = QPushButton("开始打包")
        self.package_button.clicked.connect(self.start_packaging)
        button_layout.addWidget(self.package_button)
        
        self.clear_button = QPushButton("清空选择")
        self.clear_button.clicked.connect(self.clear_selections)
        button_layout.addWidget(self.clear_button)
        
        self.select_all_button = QPushButton("全选")
        self.select_all_button.clicked.connect(self.select_all_files)
        button_layout.addWidget(self.select_all_button)
        
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
        desc_label.setFixedWidth(150)
        self.components_layout.addWidget(desc_label, row, 0)
        widgets['desc_label'] = desc_label
        
        # 文件名显示
        filename_label = QLabel(component.file_name)
        filename_label.setStyleSheet("color: #666; font-family: monospace; font-size: 10px;")
        filename_label.setFixedWidth(200)
        self.components_layout.addWidget(filename_label, row, 1)
        widgets['filename_label'] = filename_label
        
        # 文件选择
        file_layout = QHBoxLayout()
        
        file_input = QLineEdit()
        file_input.setPlaceholderText("请选择配置文件...")
        file_input.setReadOnly(True)
        file_layout.addWidget(file_input)
        widgets['file_input'] = file_input
        
        file_button = QPushButton("浏览")
        file_button.clicked.connect(lambda checked, comp=component: self.select_file(comp))
        file_layout.addWidget(file_button)
        widgets['file_button'] = file_button
        
        file_widget = QWidget()
        file_widget.setLayout(file_layout)
        self.components_layout.addWidget(file_widget, row, 2)
        widgets['file_widget'] = file_widget
        
        return widgets
    
    def select_file(self, component: Component):
        """选择文件"""
        # 根据组件类型设置文件过滤器
        if component.file_types[0] == '.xml':
            file_filter = "XML文件 (*.xml);;所有文件 (*)"
        elif component.file_types[0] == '.json':
            file_filter = "JSON文件 (*.json);;所有文件 (*)"
        else:
            file_filter = "所有文件 (*)"
        
        file_path, _ = QFileDialog.getOpenFileName(
            self,
            f"选择 {component.description} 文件",
            "",
            file_filter
        )
        
        if file_path:
            file_path = Path(file_path)
            
            # 验证文件类型
            if not component.validate_file_type(file_path):
                QMessageBox.warning(
                    self, 
                    "文件类型错误", 
                    f"所选文件类型不符合要求。\n"
                    f"期望的文件类型: {', '.join(component.file_types)}\n"
                    f"实际文件: {file_path.name}"
                )
                return
            
            component.selected_file = file_path
            
            # 更新UI
            widgets = self.component_widgets[component.name]
            widgets['file_input'].setText(str(file_path))
            
            # 配置文件使用默认版本号
            component.version = "V1.0.0.0"
            
            self.log_message(f"已选择文件: {component.description} -> {file_path.name}")
            self.update_preview()
    
    def select_all_files(self):
        """选择所有文件"""
        # 打开目录选择对话框
        dir_path = QFileDialog.getExistingDirectory(self, "选择配置文件目录")
        if not dir_path:
            return
            
        dir_path = Path(dir_path)
        found_files = 0
        
        # 在目录中查找匹配的文件
        for component in self.components.values():
            # 查找匹配的文件
            matching_files = []
            for file_path in dir_path.glob("*"):
                if file_path.is_file() and component.validate_file_type(file_path):
                    # 进一步检查文件名是否匹配
                    if component.file_name.lower() in file_path.name.lower():
                        matching_files.append(file_path)
            
            if matching_files:
                # 选择第一个匹配的文件
                selected_file = matching_files[0]
                component.selected_file = selected_file
                component.version = "V1.0.0.0"
                
                # 更新UI
                widgets = self.component_widgets[component.name]
                widgets['file_input'].setText(str(selected_file))
                
                found_files += 1
                self.log_message(f"自动匹配: {component.description} -> {selected_file.name}")
        
        if found_files > 0:
            self.log_message(f"共找到 {found_files} 个匹配的配置文件")
            self.update_preview()
        else:
            QMessageBox.information(self, "提示", "在选择的目录中未找到匹配的配置文件")
    
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
                is_patch=False,  # 配置文件包不使用patch模式
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
                QMessageBox.warning(self, "错误", "请输入配置包版本号")
                return
            
            if not VersionParser.validate_version(version):
                QMessageBox.warning(self, "错误", "版本号格式错误，请使用 V1.0.0.0 格式")
                return
            
            selected_components = [comp for comp in self.components.values() if comp.is_selected()]
            if not selected_components:
                QMessageBox.warning(self, "错误", "请至少选择一个配置文件")
                return
            
            # 创建配置
            config = PackageConfig(
                package_type=self.package_type,
                package_version=VersionParser.format_version(version),
                is_patch=False,  # 配置文件包不使用patch模式
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
            self.log_message("开始打包配置文件...")
            
        except Exception as e:
            QMessageBox.critical(self, "错误", f"启动打包失败: {str(e)}")
    
    def on_packaging_finished(self, success: bool, message: str, output_path: str):
        """打包完成"""
        self.package_button.setEnabled(True)
        self.progress_bar.setVisible(False)
        
        if success:
            self.log_message(f"✓ 打包成功: {message}")
            QMessageBox.information(self, "成功", f"{message}\n\n输出文件: {output_path}")
            self.status_updated.emit("配置文件打包完成")
        else:
            self.log_message(f"✗ 打包失败: {message}")
            QMessageBox.critical(self, "失败", f"打包失败:\n{message}")
            self.status_updated.emit("配置文件打包失败")
    
    def clear_selections(self):
        """清空所有选择"""
        for component in self.components.values():
            component.selected_file = None
            component.version = None
            component.auto_version = None
            
        for widgets in self.component_widgets.values():
            widgets['file_input'].clear()
        
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