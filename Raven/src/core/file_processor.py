"""
文件处理器
"""

import os
import shutil
import tarfile
import zipfile
import subprocess
from pathlib import Path
from typing import List, Optional, Tuple
import logging

try:
    import rarfile
    RARFILE_AVAILABLE = True
except ImportError:
    RARFILE_AVAILABLE = False
    logging.warning("rarfile not available, RAR files will not be supported")

from src.utils.constants import SUPPORTED_ARCHIVES

class FileProcessor:
    """文件处理器"""
    
    def __init__(self, temp_dir: Optional[Path] = None):
        self.temp_dir = temp_dir or Path.cwd() / 'temp'
        self.temp_dir.mkdir(exist_ok=True)
        self.logger = logging.getLogger(__name__)
    
    def extract_archive(self, archive_path: Path) -> Optional[Path]:
        """解压缩文件"""
        self.logger.info(f"[文件解压] 开始解压文件: {archive_path}")
        
        if not archive_path.exists():
            self.logger.error(f"[文件解压] 错误: 压缩文件不存在: {archive_path}")
            return None
        
        self.logger.info(f"[文件解压] 文件大小: {archive_path.stat().st_size / 1024 / 1024:.2f} MB")
        
        # 确定压缩类型
        archive_type = self._get_archive_type(archive_path)
        if not archive_type:
            self.logger.error(f"[文件解压] 错误: 不支持的压缩格式: {archive_path}")
            return None
        
        self.logger.info(f"[文件解压] 检测到压缩格式: {archive_type}")
        
        # 创建解压目录
        extract_dir = self.temp_dir / f"extract_{archive_path.stem}_{os.getpid()}"
        extract_dir.mkdir(exist_ok=True)
        self.logger.info(f"[文件解压] 创建解压目录: {extract_dir}")
        
        try:
            if archive_type == 'zip':
                self._extract_zip(archive_path, extract_dir)
            elif archive_type == 'rar':
                self._extract_rar(archive_path, extract_dir)
            elif archive_type == 'tgz':
                self._extract_tgz(archive_path, extract_dir)
            
            # 列出解压后的文件
            extracted_files = list(extract_dir.rglob('*'))
            self.logger.info(f"[文件解压] 解压完成，共解压 {len(extracted_files)} 个文件/目录")
            
            # 详细列出解压的文件
            files_only = [f for f in extracted_files if f.is_file()]
            self.logger.info(f"[文件解压] 解压的文件列表 (共{len(files_only)}个文件):")
            for file_path in files_only:
                relative_path = file_path.relative_to(extract_dir)
                file_size = file_path.stat().st_size
                self.logger.info(f"[文件解压]   - {relative_path} ({file_size} bytes)")
            
            self.logger.info(f"[文件解压] ✓ 成功解压 {archive_path} 到 {extract_dir}")
            return extract_dir
            
        except Exception as e:
            self.logger.error(f"[文件解压] ✗ 解压失败 {archive_path}: {e}")
            return None
    
    def _get_archive_type(self, file_path: Path) -> Optional[str]:
        """获取压缩文件类型"""
        file_str = str(file_path).lower()
        self.logger.debug(f"[文件类型检测] 检测文件: {file_str}")
        
        for ext, archive_type in SUPPORTED_ARCHIVES.items():
            if file_str.endswith(ext):
                self.logger.debug(f"[文件类型检测] 匹配到扩展名 '{ext}' -> 类型 '{archive_type}'")
                return archive_type
        
        self.logger.debug(f"[文件类型检测] 未匹配到任何支持的压缩格式")
        return None
    
    def _extract_zip(self, archive_path: Path, extract_dir: Path):
        """解压ZIP文件"""
        self.logger.info(f"[ZIP解压] 开始解压ZIP文件...")
        
        with zipfile.ZipFile(archive_path, 'r') as zip_ref:
            # 先列出ZIP中的文件
            file_list = zip_ref.namelist()
            self.logger.info(f"[ZIP解压] ZIP包含 {len(file_list)} 个条目:")
            for file_name in file_list:
                try:
                    file_info = zip_ref.getinfo(file_name)
                    self.logger.info(f"[ZIP解压]   - {file_name} (压缩前: {file_info.file_size} bytes, 压缩后: {file_info.compress_size} bytes)")
                except Exception as e:
                    self.logger.warning(f"[ZIP解压]   - {file_name} (无法获取详细信息: {e})")
            
            # 解压文件
            self.logger.info(f"[ZIP解压] 开始解压到 {extract_dir}...")
            zip_ref.extractall(extract_dir)
            self.logger.info(f"[ZIP解压] ✓ ZIP解压完成")
    
    def _extract_rar(self, archive_path: Path, extract_dir: Path):
        """解压RAR文件"""
        self.logger.info(f"[RAR解压] 开始解压RAR文件...")
        
        if not RARFILE_AVAILABLE:
            self.logger.error("[RAR解压] rarfile库不可用，无法解压RAR文件")
            raise ImportError("rarfile library is required for RAR support")
        
        try:
            with rarfile.RarFile(archive_path, 'r') as rar_ref:
                # 检查RAR文件的详细信息
                self.logger.info(f"[RAR解压] RAR文件版本信息:")
                try:
                    self.logger.info(f"[RAR解压]   - 需要密码: {rar_ref.needs_password()}")
                    self.logger.info(f"[RAR解压]   - 卷数: {rar_ref.volumecount()}")
                except Exception as e:
                    self.logger.warning(f"[RAR解压]   - 无法获取详细信息: {e}")
                
                # 先列出RAR中的文件
                file_list = rar_ref.namelist()
                self.logger.info(f"[RAR解压] RAR包含 {len(file_list)} 个条目:")
                
                # 获取每个文件的详细信息
                for file_name in file_list:
                    try:
                        info = rar_ref.getinfo(file_name)
                        self.logger.info(f"[RAR解压]   - {file_name}")
                        self.logger.info(f"[RAR解压]     大小: {info.file_size} bytes")
                        self.logger.info(f"[RAR解压]     压缩大小: {info.compress_size} bytes")
                        self.logger.info(f"[RAR解压]     是否目录: {info.is_dir()}")
                    except Exception as e:
                        self.logger.warning(f"[RAR解压]   - {file_name} (获取信息失败: {e})")
                
                # 尝试逐个文件解压
                self.logger.info(f"[RAR解压] 开始逐个文件解压到 {extract_dir}...")
                success_count = 0
                failed_files = []
                
                for file_name in file_list:
                    try:
                        if not rar_ref.getinfo(file_name).is_dir():
                            self.logger.info(f"[RAR解压] 正在解压文件: {file_name}")
                            # 确保目标目录存在
                            target_file = extract_dir / file_name
                            target_file.parent.mkdir(parents=True, exist_ok=True)
                            
                            # 解压单个文件
                            with rar_ref.open(file_name) as src_file:
                                with open(target_file, 'wb') as dest_file:
                                    shutil.copyfileobj(src_file, dest_file)
                            
                            # 验证文件大小
                            if target_file.exists():
                                actual_size = target_file.stat().st_size
                                expected_size = rar_ref.getinfo(file_name).file_size
                                if actual_size == expected_size:
                                    self.logger.info(f"[RAR解压] ✓ {file_name} 解压成功 ({actual_size} bytes)")
                                    success_count += 1
                                else:
                                    self.logger.error(f"[RAR解压] ✗ {file_name} 文件大小不匹配 (期望:{expected_size}, 实际:{actual_size})")
                                    failed_files.append(file_name)
                            else:
                                self.logger.error(f"[RAR解压] ✗ {file_name} 文件创建失败")
                                failed_files.append(file_name)
                        else:
                            # 创建目录
                            dir_path = extract_dir / file_name
                            dir_path.mkdir(parents=True, exist_ok=True)
                            self.logger.info(f"[RAR解压] ✓ 创建目录: {file_name}")
                            success_count += 1
                            
                    except Exception as e:
                        self.logger.error(f"[RAR解压] ✗ 解压文件 {file_name} 失败: {e}")
                        failed_files.append(file_name)
                
                if failed_files:
                    self.logger.warning(f"[RAR解压] 部分文件解压失败，尝试使用备用方法...")
                    self._extract_rar_fallback(archive_path, extract_dir, failed_files)
                
                self.logger.info(f"[RAR解压] ✓ RAR解压完成，成功: {success_count}, 失败: {len(failed_files)}")
                
        except Exception as e:
            self.logger.error(f"[RAR解压] rarfile库解压失败: {e}")
            self.logger.info(f"[RAR解压] 尝试使用系统unrar命令...")
            self._extract_rar_fallback(archive_path, extract_dir)
    
    def _extract_rar_fallback(self, archive_path: Path, extract_dir: Path, specific_files: List[str] = None):
        """使用系统RAR解压命令作为备用解压方法"""
        self.logger.info(f"[RAR备用解压] 尝试使用系统RAR解压命令...")
        
        # 检查系统是否有RAR解压命令
        rar_cmd = self._find_unrar_command()
        if not rar_cmd:
            self.logger.error(f"[RAR备用解压] 系统未找到RAR解压命令，请安装unar或unrar")
            raise RuntimeError("系统未安装RAR解压命令，无法解压RAR文件")
        
        self.logger.info(f"[RAR备用解压] 找到RAR解压命令: {rar_cmd}")
        
        # 判断使用的是哪种命令
        is_unar = 'unar' in rar_cmd
        
        try:
            if is_unar:
                # 使用unar命令
                if specific_files:
                    # unar不支持选择性解压，先解压所有文件，然后删除不需要的
                    self.logger.warning(f"[RAR备用解压] unar不支持选择性解压，将解压所有文件")
                
                # unar解压所有文件
                cmd = [rar_cmd, '-output-directory', str(extract_dir), '-force-overwrite', str(archive_path)]
                self.logger.info(f"[RAR备用解压] 执行unar命令: {' '.join(cmd)}")
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
                
                if result.returncode == 0:
                    self.logger.info(f"[RAR备用解压] ✓ unar解压成功")
                    self.logger.info(f"[RAR备用解压] stdout: {result.stdout}")
                else:
                    self.logger.error(f"[RAR备用解压] ✗ unar解压失败:")
                    self.logger.error(f"[RAR备用解压] stdout: {result.stdout}")
                    self.logger.error(f"[RAR备用解压] stderr: {result.stderr}")
                    raise RuntimeError(f"unar命令执行失败: {result.stderr}")
            else:
                # 使用unrar命令
                if specific_files:
                    # 解压特定文件
                    for file_name in specific_files:
                        cmd = [rar_cmd, 'e', '-o+', str(archive_path), file_name, str(extract_dir)]
                        self.logger.info(f"[RAR备用解压] 执行unrar命令: {' '.join(cmd)}")
                        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
                        
                        if result.returncode == 0:
                            self.logger.info(f"[RAR备用解压] ✓ {file_name} 解压成功")
                        else:
                            self.logger.error(f"[RAR备用解压] ✗ {file_name} 解压失败:")
                            self.logger.error(f"[RAR备用解压] stdout: {result.stdout}")
                            self.logger.error(f"[RAR备用解压] stderr: {result.stderr}")
                else:
                    # 解压所有文件
                    cmd = [rar_cmd, 'x', '-o+', str(archive_path), str(extract_dir)]
                    self.logger.info(f"[RAR备用解压] 执行unrar命令: {' '.join(cmd)}")
                    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
                    
                    if result.returncode == 0:
                        self.logger.info(f"[RAR备用解压] ✓ unrar解压成功")
                        self.logger.info(f"[RAR备用解压] stdout: {result.stdout}")
                    else:
                        self.logger.error(f"[RAR备用解压] ✗ unrar解压失败:")
                        self.logger.error(f"[RAR备用解压] stdout: {result.stdout}")
                        self.logger.error(f"[RAR备用解压] stderr: {result.stderr}")
                        raise RuntimeError(f"unrar命令执行失败: {result.stderr}")
                    
        except subprocess.TimeoutExpired:
            self.logger.error(f"[RAR备用解压] ✗ 解压超时（300秒）")
            raise RuntimeError("RAR解压超时")
        except Exception as e:
            self.logger.error(f"[RAR备用解压] ✗ 执行RAR解压命令失败: {e}")
            raise
    
    def _find_unrar_command(self) -> Optional[str]:
        """查找系统中的RAR解压命令"""
        # 优先查找unar命令（macOS通过Homebrew安装）
        possible_commands = [
            'unar', '/opt/homebrew/bin/unar',  # macOS Homebrew
            'unrar', 'unrar-free', '/usr/local/bin/unrar', '/opt/homebrew/bin/unrar'  # 传统unrar
        ]
        
        for cmd in possible_commands:
            try:
                result = subprocess.run([cmd, '--help'], capture_output=True, timeout=5)
                if result.returncode == 0:
                    # 检查是否是unar或unrar
                    output = result.stdout.decode() + result.stderr.decode()
                    if 'unar' in cmd or 'unar' in output.lower():
                        self.logger.info(f"[RAR备用解压] 找到unar命令: {cmd}")
                        return cmd
                    elif 'unrar' in cmd or 'unrar' in output.lower():
                        self.logger.info(f"[RAR备用解压] 找到unrar命令: {cmd}")
                        return cmd
            except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
                continue
        
        # 尝试使用which命令查找
        for cmd_name in ['unar', 'unrar']:
            try:
                result = subprocess.run(['which', cmd_name], capture_output=True, text=True, timeout=5)
                if result.returncode == 0 and result.stdout.strip():
                    cmd = result.stdout.strip()
                    self.logger.info(f"[RAR备用解压] 通过which找到{cmd_name}: {cmd}")
                    return cmd
            except:
                continue
            
        self.logger.warning(f"[RAR备用解压] 未找到系统RAR解压命令")
        return None
    
    def _extract_tgz(self, archive_path: Path, extract_dir: Path):
        """解压TGZ文件"""
        self.logger.info(f"[TGZ解压] 开始解压TGZ文件...")
        
        with tarfile.open(archive_path, 'r:gz') as tar_ref:
            # 先列出TGZ中的文件
            member_list = tar_ref.getmembers()
            self.logger.info(f"[TGZ解压] TGZ包含 {len(member_list)} 个条目:")
            for member in member_list:
                if member.isfile():
                    self.logger.info(f"[TGZ解压]   - {member.name} ({member.size} bytes)")
                else:
                    self.logger.info(f"[TGZ解压]   - {member.name} (目录)")
            
            # 解压文件
            self.logger.info(f"[TGZ解压] 开始解压到 {extract_dir}...")
            tar_ref.extractall(extract_dir)
            self.logger.info(f"[TGZ解压] ✓ TGZ解压完成")
    
    def find_files_by_type(self, directory: Path, file_types: List[str], target_filename: Optional[str] = None) -> List[Path]:
        """在目录中查找指定类型的文件"""
        self.logger.info(f"[文件查找] 开始在目录中查找文件...")
        self.logger.info(f"[文件查找] 搜索目录: {directory}")
        self.logger.info(f"[文件查找] 目标文件类型: {file_types}")
        if target_filename:
            self.logger.info(f"[文件查找] 目标文件名: {target_filename}")
        
        found_files = []
        
        for file_type in file_types:
            self.logger.info(f"[文件查找] 正在查找类型: {file_type}")
            
            if file_type.startswith('.'):
                # 按扩展名查找
                pattern = f"*{file_type}"
                self.logger.info(f"[文件查找] 使用扩展名模式: {pattern}")
                
                # 在当前目录查找
                current_matches = list(directory.glob(pattern))
                self.logger.info(f"[文件查找] 当前目录找到 {len(current_matches)} 个匹配文件:")
                for match in current_matches:
                    self.logger.info(f"[文件查找]   - {match.relative_to(directory)}")
                found_files.extend(current_matches)
                
                # 递归查找
                recursive_matches = list(directory.rglob(pattern))
                self.logger.info(f"[文件查找] 递归查找找到 {len(recursive_matches)} 个匹配文件:")
                for match in recursive_matches:
                    self.logger.info(f"[文件查找]   - {match.relative_to(directory)}")
                found_files.extend(recursive_matches)
            else:
                # 按文件名包含查找
                self.logger.info(f"[文件查找] 使用文件名包含模式: {file_type}")
                matches_count = 0
                for file_path in directory.rglob('*'):
                    if file_path.is_file() and file_type.lower() in file_path.name.lower():
                        self.logger.info(f"[文件查找]   找到匹配: {file_path.relative_to(directory)}")
                        found_files.append(file_path)
                        matches_count += 1
                self.logger.info(f"[文件查找] 通过文件名包含查找到 {matches_count} 个文件")
        
        # 去重
        unique_files = list(set(found_files))
        self.logger.info(f"[文件查找] 去重后共找到 {len(unique_files)} 个唯一文件:")
        for file_path in unique_files:
            relative_path = file_path.relative_to(directory)
            file_size = file_path.stat().st_size
            self.logger.info(f"[文件查找]   ✓ {relative_path} ({file_size} bytes)")
        
        # 如果有目标文件名，则优先选择匹配的文件
        if target_filename and unique_files:
            self.logger.info(f"[文件查找] 🎯 开始优先选择匹配目标文件名的文件...")
            
            # 首先查找完全匹配的文件名（不区分大小写）
            exact_matches = []
            stem_matches = []
            base_name_without_ext = target_filename
            if '.' in target_filename:
                base_name_without_ext = target_filename.rsplit('.', 1)[0]
            
            for file_path in unique_files:
                file_name = file_path.name
                file_stem = file_path.stem
                
                # 完全匹配文件名（忽略大小写）
                if file_name.lower() == target_filename.lower():
                    exact_matches.append(file_path)
                    self.logger.info(f"[文件查找]   🎯 完全匹配: {file_path.relative_to(directory)}")
                # 匹配文件主名（不包括扩展名）
                elif file_stem.lower() == base_name_without_ext.lower():
                    stem_matches.append(file_path)
                    self.logger.info(f"[文件查找]   📌 主名匹配: {file_path.relative_to(directory)}")
            
            # 按优先级返回文件
            if exact_matches:
                self.logger.info(f"[文件查找] ✓ 找到 {len(exact_matches)} 个完全匹配的文件，优先使用")
                unique_files = exact_matches + [f for f in unique_files if f not in exact_matches]
            elif stem_matches:
                self.logger.info(f"[文件查找] ✓ 找到 {len(stem_matches)} 个主名匹配的文件，优先使用")
                unique_files = stem_matches + [f for f in unique_files if f not in stem_matches]
            else:
                self.logger.info(f"[文件查找] ⚠️ 未找到与目标文件名匹配的文件，使用原顺序")
        
        if not unique_files:
            self.logger.warning(f"[文件查找] ⚠️ 未找到任何匹配的文件！")
            self.logger.info(f"[文件查找] 目录中所有文件:")
            all_files = list(directory.rglob('*'))
            for file_path in all_files:
                if file_path.is_file():
                    relative_path = file_path.relative_to(directory)
                    self.logger.info(f"[文件查找]     - {relative_path}")
        else:
            self.logger.info(f"[文件查找] 最终文件列表（按优先级排序）:")
            for i, file_path in enumerate(unique_files):
                relative_path = file_path.relative_to(directory)
                file_size = file_path.stat().st_size
                priority_mark = "🥇" if i == 0 else f"{i+1}."
                self.logger.info(f"[文件查找]   {priority_mark} {relative_path} ({file_size} bytes)")
        
        return unique_files
    
    def copy_and_rename_file(self, src_file: Path, dest_dir: Path, new_name: str) -> Path:
        """复制并重命名文件"""
        self.logger.info(f"[文件复制] 开始复制文件...")
        self.logger.info(f"[文件复制] 源文件: {src_file}")
        self.logger.info(f"[文件复制] 目标目录: {dest_dir}")
        self.logger.info(f"[文件复制] 新文件名: {new_name}")
        
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest_file = dest_dir / new_name
        
        # 检查源文件信息
        if src_file.exists():
            file_size = src_file.stat().st_size
            self.logger.info(f"[文件复制] 源文件大小: {file_size} bytes ({file_size / 1024:.2f} KB)")
        else:
            self.logger.error(f"[文件复制] ✗ 源文件不存在: {src_file}")
            raise FileNotFoundError(f"Source file not found: {src_file}")
        
        try:
            shutil.copy2(src_file, dest_file)
            
            # 验证复制结果
            if dest_file.exists():
                dest_size = dest_file.stat().st_size
                self.logger.info(f"[文件复制] 目标文件大小: {dest_size} bytes ({dest_size / 1024:.2f} KB)")
                if dest_size == file_size:
                    self.logger.info(f"[文件复制] ✓ 文件复制成功: {src_file} -> {dest_file}")
                else:
                    self.logger.warning(f"[文件复制] ⚠️ 文件大小不匹配！源:{file_size}, 目标:{dest_size}")
            else:
                self.logger.error(f"[文件复制] ✗ 目标文件创建失败: {dest_file}")
                
        except Exception as e:
            self.logger.error(f"[文件复制] ✗ 复制失败: {e}")
            raise
        
        return dest_file
    
    def create_tgz_package(self, source_dir: Path, output_file: Path) -> bool:
        """创建TGZ压缩包"""
        try:
            # 确保输出目录存在
            output_file.parent.mkdir(parents=True, exist_ok=True)
            
            with tarfile.open(output_file, 'w:gz') as tar:
                for file_path in source_dir.iterdir():
                    if file_path.is_file():
                        tar.add(file_path, arcname=file_path.name)
            
            self.logger.info(f"Successfully created package: {output_file}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to create package {output_file}: {e}")
            return False
    
    def cleanup_temp_files(self):
        """清理临时文件"""
        if self.temp_dir.exists():
            try:
                shutil.rmtree(self.temp_dir)
                self.logger.info("Cleaned up temporary files")
            except Exception as e:
                self.logger.warning(f"Failed to cleanup temp files: {e}")
    
    def is_archive_file(self, file_path: Path) -> bool:
        """判断是否为压缩文件"""
        is_archive = self._get_archive_type(file_path) is not None
        self.logger.debug(f"[文件类型检查] {file_path.name} 是否为压缩文件: {is_archive}")
        return is_archive 