// API 基础配置
const API_BASE = '/api';
const PACKAGES_API = `${API_BASE}/packages`;
const UPLOAD_API = `${API_BASE}/upload`;
const DOWNLOAD_API = `${API_BASE}/download`;

// 全局状态
let currentPage = 1;
let totalPages = 1;
let currentPackages = [];
let selectedPackageId = null;

// 页面初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
});

// 初始化应用
function initializeApp() {
    loadStats();
    loadPackages();
    showPackages();
}

// 设置事件监听器
function setupEventListeners() {
    // 搜索输入框事件
    document.getElementById('searchInput').addEventListener('input', debounce(searchPackages, 300));
    
    // 筛选器事件
    document.getElementById('typeFilter').addEventListener('change', searchPackages);
    document.getElementById('versionFilter').addEventListener('input', debounce(searchPackages, 300));
    document.getElementById('dateFromFilter').addEventListener('change', searchPackages);
    document.getElementById('dateToFilter').addEventListener('change', searchPackages);
    
    // 文件上传事件
    const fileInput = document.getElementById('fileInput');
    const uploadZone = document.getElementById('uploadZone');
    
    fileInput.addEventListener('change', handleFileSelect);
    
    // 拖拽上传事件
    uploadZone.addEventListener('dragover', handleDragOver);
    uploadZone.addEventListener('dragleave', handleDragLeave);
    uploadZone.addEventListener('drop', handleDrop);
    uploadZone.addEventListener('click', () => fileInput.click());
}

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 显示提示信息
function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    const alertId = 'alert-' + Date.now();
    
    const alertHtml = `
        <div id="${alertId}" class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    alertContainer.insertAdjacentHTML('beforeend', alertHtml);
    
    // 自动移除提示
    setTimeout(() => {
        const alert = document.getElementById(alertId);
        if (alert) {
            alert.remove();
        }
    }, 5000);
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 格式化日期
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 获取包类型显示名称
function getPackageTypeDisplay(type) {
    const typeMap = {
        'lingxi-10': 'LingXi-10',
        'lingxi-07a': 'LingXi-07A',
        'config': '配置包',
        'lingxi-06-thrid': 'LingXi-06-TRD',
        'unknown': '未知类型'
    };
    return typeMap[type] || type;
}

// 获取包类型颜色
function getPackageTypeColor(type) {
    const colorMap = {
        'lingxi-10': 'primary',
        'lingxi-07a': 'success',
        'config': 'warning',
        'lingxi-06-thrid': 'info',
        'unknown': 'secondary'
    };
    return colorMap[type] || 'secondary';
}

// 加载统计信息
async function loadStats() {
    try {
        const response = await fetch(`${PACKAGES_API}/stats/overview`);
        if (!response.ok) throw new Error('获取统计信息失败');
        
        const result = await response.json();
        
        if (result.success && result.data) {
            const stats = result.data;
            document.getElementById('totalPackages').textContent = stats.totalPackages || 0;
            document.getElementById('totalSize').textContent = formatFileSize(stats.totalSize || 0);
            document.getElementById('recentUploads').textContent = stats.recentPackages ? stats.recentPackages.length : 0;
            document.getElementById('packageTypes').textContent = Object.keys(stats.packagesByType || {}).length;
        } else {
            throw new Error(result.message || '获取统计信息失败');
        }
    } catch (error) {
        console.error('加载统计信息失败:', error);
        showAlert('加载统计信息失败', 'warning');
    }
}

// 加载包列表
async function loadPackages(page = 1) {
    try {
        showLoading(true);
        
        const params = new URLSearchParams({
            page: page,
            limit: 10,
            search: document.getElementById('searchInput').value || '',
            type: document.getElementById('typeFilter').value || '',
            version: document.getElementById('versionFilter').value || '',
            dateFrom: document.getElementById('dateFromFilter').value || '',
            dateTo: document.getElementById('dateToFilter').value || ''
        });
        
        const response = await fetch(`${PACKAGES_API}?${params}`);
        if (!response.ok) throw new Error('获取包列表失败');
        
        const result = await response.json();
        
        if (result.success && result.data) {
            currentPackages = result.data.packages || [];
            currentPage = result.data.pagination?.currentPage || 1;
            totalPages = result.data.pagination?.totalPages || 1;
        } else {
            throw new Error(result.message || '获取包列表失败');
        }
        
        renderPackageList();
        renderPagination();
        
    } catch (error) {
        console.error('加载包列表失败:', error);
        showAlert('加载包列表失败', 'danger');
    } finally {
        showLoading(false);
    }
}

// 渲染包列表
function renderPackageList() {
    const packageList = document.getElementById('packageList');
    
    if (currentPackages.length === 0) {
        packageList.innerHTML = `
            <div class="text-center py-5">
                <i class="bi bi-inbox fs-1 text-muted mb-3"></i>
                <h5 class="text-muted">暂无包文件</h5>
                <p class="text-muted">点击上传按钮添加新的包文件</p>
            </div>
        `;
        return;
    }
    
    const packagesHtml = currentPackages.map(pkg => `
        <div class="package-item card mb-3" onclick="showPackageDetail('${pkg.id}')" style="cursor: pointer;">
            <div class="card-body">
                <div class="row align-items-center">
                    <div class="col-md-6">
                        <h6 class="mb-1">
                            <i class="bi bi-box-seam me-2 text-primary"></i>
                            ${pkg.name}
                        </h6>
                        <p class="mb-1 text-muted small">${pkg.path}</p>
                        <div class="d-flex align-items-center">
                            <span class="badge bg-${getPackageTypeColor(pkg.packageType)} package-type-badge me-2">
                                ${getPackageTypeDisplay(pkg.packageType)}
                            </span>
                            <span class="badge bg-light text-dark package-type-badge">
                                v${pkg.version}
                            </span>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <small class="text-muted d-block">
                            <i class="bi bi-calendar3 me-1"></i>
                            ${formatDate(pkg.createdAt)}
                        </small>
                        <small class="file-size d-block">
                            <i class="bi bi-hdd me-1"></i>
                            ${formatFileSize(pkg.size)}
                        </small>
                    </div>
                    <div class="col-md-3 text-end">
                        <div class="btn-group" role="group">
                            <button class="btn btn-outline-primary btn-sm" onclick="event.stopPropagation(); downloadPackage('${pkg.id}')">
                                <i class="bi bi-download"></i>
                            </button>
                            <button class="btn btn-outline-info btn-sm" onclick="event.stopPropagation(); showPackageDetail('${pkg.id}')">
                                <i class="bi bi-eye"></i>
                            </button>
                            <button class="btn btn-outline-danger btn-sm" onclick="event.stopPropagation(); confirmDeletePackage('${pkg.id}', '${pkg.name}')">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    packageList.innerHTML = packagesHtml;
}

// 渲染分页
function renderPagination() {
    const pagination = document.getElementById('pagination');
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let paginationHtml = '<ul class="pagination">';
    
    // 上一页
    paginationHtml += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="loadPackages(${currentPage - 1})">
                <i class="bi bi-chevron-left"></i>
            </a>
        </li>
    `;
    
    // 页码
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHtml += `
            <li class="page-item ${i === currentPage ? 'active' : ''}">
                <a class="page-link" href="#" onclick="loadPackages(${i})">${i}</a>
            </li>
        `;
    }
    
    // 下一页
    paginationHtml += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="loadPackages(${currentPage + 1})">
                <i class="bi bi-chevron-right"></i>
            </a>
        </li>
    `;
    
    paginationHtml += '</ul>';
    pagination.innerHTML = paginationHtml;
}

// 显示/隐藏加载状态
function showLoading(show) {
    const loadingSpinner = document.getElementById('loadingSpinner');
    const packageList = document.getElementById('packageList');
    
    if (show) {
        loadingSpinner.style.display = 'block';
        packageList.style.display = 'none';
    } else {
        loadingSpinner.style.display = 'none';
        packageList.style.display = 'block';
    }
}

// 搜索包
function searchPackages() {
    currentPage = 1;
    loadPackages(1);
}

// 清除筛选条件
function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('typeFilter').value = '';
    document.getElementById('versionFilter').value = '';
    document.getElementById('dateFromFilter').value = '';
    document.getElementById('dateToFilter').value = '';
    searchPackages();
}

// 刷新包列表
function refreshPackages() {
    loadPackages(currentPage);
    loadStats();
}

// 显示包列表页面
function showPackages() {
    document.getElementById('packageListSection').style.display = 'block';
    document.getElementById('uploadSection').style.display = 'none';
    document.getElementById('searchSection').style.display = 'block';
    document.getElementById('statsSection').style.display = 'flex';
}

// 显示上传页面
function showUpload() {
    document.getElementById('packageListSection').style.display = 'none';
    document.getElementById('uploadSection').style.display = 'block';
    document.getElementById('searchSection').style.display = 'none';
    document.getElementById('statsSection').style.display = 'none';
}

// 显示统计页面
function showStats() {
    showPackages();
    loadStats();
}

// 文件选择处理
function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    uploadFiles(files);
}

// 拖拽处理
function handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('dragover');
}

function handleDragLeave(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
}

function handleDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
    
    const files = Array.from(event.dataTransfer.files);
    uploadFiles(files);
}

// 上传文件
async function uploadFiles(files) {
    if (files.length === 0) return;
    
    // 验证文件类型
    const validFiles = files.filter(file => {
        const isValid = file.name.endsWith('.tgz') || file.name.endsWith('.tar.gz');
        if (!isValid) {
            showAlert(`文件 ${file.name} 格式不支持，仅支持 .tgz 和 .tar.gz 格式`, 'warning');
        }
        return isValid;
    });
    
    if (validFiles.length === 0) return;
    
    const formData = new FormData();
    validFiles.forEach(file => {
        formData.append('packages', file);
    });
    
    try {
        showUploadProgress(true);
        
        const response = await fetch(validFiles.length === 1 ? UPLOAD_API : `${UPLOAD_API}/batch`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || '上传失败');
        }
        
        const result = await response.json();
        showAlert(`成功上传 ${validFiles.length} 个文件`, 'success');
        
        // 清空文件输入
        document.getElementById('fileInput').value = '';
        
        // 刷新列表
        refreshPackages();
        
        // 返回包列表页面
        setTimeout(() => {
            showPackages();
        }, 1000);
        
    } catch (error) {
        console.error('上传失败:', error);
        showAlert(`上传失败: ${error.message}`, 'danger');
    } finally {
        showUploadProgress(false);
    }
}

// 显示/隐藏上传进度
function showUploadProgress(show) {
    const uploadProgress = document.getElementById('uploadProgress');
    const uploadZone = document.getElementById('uploadZone');
    
    if (show) {
        uploadProgress.style.display = 'block';
        uploadZone.style.pointerEvents = 'none';
        uploadZone.style.opacity = '0.6';
    } else {
        uploadProgress.style.display = 'none';
        uploadZone.style.pointerEvents = 'auto';
        uploadZone.style.opacity = '1';
    }
}

// 显示包详情
async function showPackageDetail(packageId) {
    try {
        const response = await fetch(`${PACKAGES_API}/${packageId}`);
        if (!response.ok) throw new Error('获取包详情失败');
        
        const pkg = await response.json();
        selectedPackageId = packageId;
        
        const detailContent = document.getElementById('packageDetailContent');
        detailContent.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <h6>基本信息</h6>
                    <table class="table table-sm">
                        <tr><td><strong>包名称:</strong></td><td>${pkg.name}</td></tr>
                        <tr><td><strong>版本:</strong></td><td>v${pkg.version}</td></tr>
                        <tr><td><strong>类型:</strong></td><td><span class="badge bg-${getPackageTypeColor(pkg.packageType)}">${getPackageTypeDisplay(pkg.packageType)}</span></td></tr>
                        <tr><td><strong>大小:</strong></td><td>${formatFileSize(pkg.size)}</td></tr>
                        <tr><td><strong>路径:</strong></td><td><code>${pkg.path}</code></td></tr>
                        <tr><td><strong>创建时间:</strong></td><td>${formatDate(pkg.createdAt)}</td></tr>
                    </table>
                </div>
                <div class="col-md-6">
                    <h6>元数据</h6>
                    <table class="table table-sm">
                        <tr><td><strong>是否补丁:</strong></td><td>${pkg.metadata?.isPatch ? '是' : '否'}</td></tr>
                        <tr><td><strong>组件数量:</strong></td><td>${pkg.metadata?.components?.length || 0}</td></tr>
                        <tr><td><strong>描述:</strong></td><td>${pkg.metadata?.description || '无描述'}</td></tr>
                    </table>
                    
                    ${pkg.metadata?.components && pkg.metadata.components.length > 0 ? `
                        <h6 class="mt-3">包含组件</h6>
                        <div class="d-flex flex-wrap gap-1">
                            ${pkg.metadata.components.map(comp => `
                                <span class="badge bg-light text-dark">${comp}</span>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    ${pkg.metadata?.tags && pkg.metadata.tags.length > 0 ? `
                        <h6 class="mt-3">标签</h6>
                        <div class="d-flex flex-wrap gap-1">
                            ${pkg.metadata.tags.map(tag => `
                                <span class="badge bg-primary">${tag}</span>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        // 设置下载和删除按钮事件
        document.getElementById('downloadPackageBtn').onclick = () => downloadPackage(packageId);
        document.getElementById('deletePackageBtn').onclick = () => confirmDeletePackage(packageId, pkg.name);
        
        // 显示模态框
        const modal = new window.bootstrap.Modal(document.getElementById('packageDetailModal'));
        modal.show();
        
    } catch (error) {
        console.error('获取包详情失败:', error);
        showAlert('获取包详情失败', 'danger');
    }
}

// 下载包
async function downloadPackage(packageId) {
    try {
        const response = await fetch(`${DOWNLOAD_API}/${packageId}`);
        if (!response.ok) throw new Error('下载失败');
        
        // 获取文件名
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'package.tgz';
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="(.+)"/);                
            if (filenameMatch) {
                filename = filenameMatch[1];
            }
        }
        
        // 创建下载链接
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showAlert('下载开始', 'success');
        
    } catch (error) {
        console.error('下载失败:', error);
        showAlert('下载失败', 'danger');
    }
}

// 确认删除包
function confirmDeletePackage(packageId, packageName) {
    if (confirm(`确定要删除包 "${packageName}" 吗？此操作不可撤销。`)) {
        deletePackage(packageId);
    }
}

// 删除包
async function deletePackage(packageId) {
    try {
        const response = await fetch(`${PACKAGES_API}/${packageId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('删除失败');
        
        showAlert('包删除成功', 'success');
        
        // 关闭模态框
        const modal = window.bootstrap.Modal.getInstance(document.getElementById('packageDetailModal'));
        if (modal) {
            modal.hide();
        }
        
        // 刷新列表
        refreshPackages();
        
    } catch (error) {
        console.error('删除失败:', error);
        showAlert('删除失败', 'danger');
    }
}

// 阻止默认的拖拽行为
document.addEventListener('dragover', function(e) {
    e.preventDefault();
});

document.addEventListener('drop', function(e) {
    e.preventDefault();
});