"""
ChatBot选项卡（预留功能）
"""

from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QTextEdit, 
    QLineEdit, QPushButton, QLabel, QSplitter, QGroupBox
)
from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtGui import QFont

class ChatBotTab(QWidget):
    """ChatBot选项卡"""
    
    def __init__(self):
        super().__init__()
        self.init_ui()
        
    def init_ui(self):
        """初始化界面"""
        layout = QVBoxLayout(self)
        
        # 标题和说明
        title_label = QLabel("AI助手")
        title_label.setFont(QFont("Arial", 16, QFont.Weight.Bold))
        layout.addWidget(title_label)
        
        info_label = QLabel(
            "AI助手功能正在开发中，计划集成以下功能：\n"
            "• MCP (Model Context Protocol) 集成\n"
            "• RAG (Retrieval-Augmented Generation) 知识库\n"
            "• 卫星通信载荷领域知识问答\n"
            "• 升级包制作智能助手\n"
            "• 故障诊断和解决方案推荐"
        )
        info_label.setStyleSheet("color: #666; margin: 20px; padding: 20px; background-color: #f5f5f5; border-radius: 5px;")
        info_label.setWordWrap(True)
        layout.addWidget(info_label)
        
        # 预留的聊天界面
        chat_group = QGroupBox("聊天界面（预览）")
        chat_layout = QVBoxLayout(chat_group)
        
        # 聊天显示区域
        self.chat_display = QTextEdit()
        self.chat_display.setReadOnly(True)
        self.chat_display.setPlainText(
            "系统: 欢迎使用GalaxySpace AI助手！\n"
            "系统: 当前版本为预览版本，AI功能暂未激活。\n"
            "系统: 预计在后续版本中将提供完整的AI对话功能。\n"
        )
        chat_layout.addWidget(self.chat_display)
        
        # 输入区域
        input_layout = QHBoxLayout()
        
        self.input_field = QLineEdit()
        self.input_field.setPlaceholderText("在此输入您的问题...")
        self.input_field.setEnabled(False)  # 暂时禁用
        input_layout.addWidget(self.input_field)
        
        self.send_button = QPushButton("发送")
        self.send_button.setEnabled(False)  # 暂时禁用
        self.send_button.clicked.connect(self.send_message)
        input_layout.addWidget(self.send_button)
        
        chat_layout.addLayout(input_layout)
        layout.addWidget(chat_group)
        
        # 功能说明
        features_group = QGroupBox("计划功能")
        features_layout = QVBoxLayout(features_group)
        
        features_text = QTextEdit()
        features_text.setReadOnly(True)
        features_text.setMaximumHeight(200)
        features_text.setPlainText(
            "1. MCP集成\n"
            "   - 支持模型上下文协议\n"
            "   - 与外部工具和API集成\n"
            "   - 实时数据获取和处理\n\n"
            "2. RAG知识库\n"
            "   - 卫星通信载荷技术文档\n"
            "   - 故障案例库\n"
            "   - 操作手册和规范\n\n"
            "3. 智能助手功能\n"
            "   - 升级包制作指导\n"
            "   - 配置文件生成建议\n"
            "   - 版本管理最佳实践\n\n"
            "4. 问答和诊断\n"
            "   - 技术问题解答\n"
            "   - 故障诊断辅助\n"
            "   - 解决方案推荐"
        )
        features_layout.addWidget(features_text)
        layout.addWidget(features_group)
        
        layout.addStretch()
    
    def send_message(self):
        """发送消息（预留功能）"""
        message = self.input_field.text().strip()
        if message:
            self.chat_display.append(f"用户: {message}")
            self.chat_display.append("AI: 抱歉，AI功能暂未激活，请等待后续版本更新。")
            self.input_field.clear()
    
    def add_message(self, sender: str, message: str):
        """添加消息到聊天显示区域"""
        self.chat_display.append(f"{sender}: {message}")
        
        # 滚动到底部
        scrollbar = self.chat_display.verticalScrollBar()
        scrollbar.setValue(scrollbar.maximum()) 