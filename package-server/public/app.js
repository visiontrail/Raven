// API 基础配置
const API_BASE = '/api'
const PACKAGES_API = `${API_BASE}/packages`
const UPLOAD_API = `${API_BASE}/upload`
// const DOWNLOAD_API = `${API_BASE}/download` // 暂时注释掉未使用的常量

// 全局状态
let currentPage = 1
let totalPages = 1
let currentPackages = []

// 页面初始化
document.addEventListener('DOMContentLoaded', function () {
  initializeApp()
  setupEventListeners()
})

// 初始化应用
function initializeApp() {
  console.log('🚀 初始化应用开始')

  // 检查关键DOM元素是否存在
  const packageListSection = document.getElementById('packageListSection')
  const packageList = document.getElementById('packageList')
  const searchSection = document.getElementById('searchSection')
  const statsSection = document.getElementById('statsSection')

  console.log('📋 DOM元素检查:')
  console.log('- packageListSection:', packageListSection ? '存在' : '不存在')
  console.log('- packageList:', packageList ? '存在' : '不存在')
  console.log('- searchSection:', searchSection ? '存在' : '不存在')
  console.log('- statsSection:', statsSection ? '存在' : '不存在')

  loadStats()
  loadPackages()
  showPackages()

  console.log('✅ 初始化应用完成')
}

// 设置事件监听器
function setupEventListeners() {
  // 搜索输入框事件
  document.getElementById('searchInput').addEventListener('input', debounce(searchPackages, 300))

  // 筛选器事件
  document.getElementById('typeFilter').addEventListener('change', searchPackages)
  document.getElementById('versionFilter').addEventListener('input', debounce(searchPackages, 300))
  document.getElementById('tagsFilter').addEventListener('input', debounce(searchPackages, 300))
  document.getElementById('patchFilter').addEventListener('change', searchPackages)

  // 文件上传事件
  const fileInput = document.getElementById('fileInput')
  const uploadZone = document.getElementById('uploadZone')

  fileInput.addEventListener('change', handleFileSelect)

  // 拖拽上传事件
  uploadZone.addEventListener('dragover', handleDragOver)
  uploadZone.addEventListener('dragleave', handleDragLeave)
  uploadZone.addEventListener('drop', handleDrop)
  uploadZone.addEventListener('click', () => fileInput.click())
}

// 防抖函数
function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

// 显示提示信息
function showAlert(message, type = 'info') {
  const alertContainer = document.getElementById('alertContainer')
  const alertId = 'alert-' + Date.now()

  const alertHtml = `
        <div id="${alertId}" class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `

  alertContainer.insertAdjacentHTML('beforeend', alertHtml)

  // 自动移除提示
  setTimeout(() => {
    const alert = document.getElementById(alertId)
    if (alert) {
      alert.remove()
    }
  }, 5000)
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 格式化日期
function formatDate(dateString) {
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 获取包类型显示名称
function getPackageTypeDisplay(type) {
  const typeMap = {
    'lingxi-10': 'LingXi-10',
    'lingxi-07a': 'LingXi-07A',
    config: '配置包',
    'lingxi-06-thrid': 'LingXi-06-TRD',
    unknown: '未知类型'
  }
  return typeMap[type] || type
}

// 获取包类型颜色
function getPackageTypeColor(type) {
  const colorMap = {
    'lingxi-10': 'primary',
    'lingxi-07a': 'success',
    config: 'warning',
    'lingxi-06-thrid': 'info',
    unknown: 'secondary'
  }
  return colorMap[type] || 'secondary'
}

// 加载统计信息
async function loadStats() {
  try {
    const response = await fetch(`${PACKAGES_API}/stats/overview`)
    if (!response.ok) throw new Error('获取统计信息失败')

    const result = await response.json()

    if (result.success && result.data) {
      const stats = result.data
      document.getElementById('totalPackages').textContent = stats.totalPackages || 0
      document.getElementById('totalSize').textContent = formatFileSize(stats.totalSize || 0)
      document.getElementById('recentUploads').textContent = stats.recentPackages ? stats.recentPackages.length : 0
      document.getElementById('packageTypes').textContent = Object.keys(stats.packagesByType || {}).length
    } else {
      throw new Error(result.message || '获取统计信息失败')
    }
  } catch (error) {
    console.error('加载统计信息失败:', error)
    showAlert('加载统计信息失败', 'warning')
  }
}

// 加载包列表
async function loadPackages(page = 1) {
  try {
    console.log('📦 loadPackages called with page:', page)
    showLoading(true)

    // 安全获取DOM元素值
    const searchInput = document.getElementById('searchInput')
    const typeFilter = document.getElementById('typeFilter')
    const versionFilter = document.getElementById('versionFilter')
    const dateFromFilter = document.getElementById('dateFromFilter')
    const dateToFilter = document.getElementById('dateToFilter')

    console.log('🔍 表单元素检查:')
    console.log('- searchInput:', searchInput ? '存在' : '不存在')
    console.log('- typeFilter:', typeFilter ? '存在' : '不存在')
    console.log('- versionFilter:', versionFilter ? '存在' : '不存在')
    console.log('- dateFromFilter:', dateFromFilter ? '存在' : '不存在')
    console.log('- dateToFilter:', dateToFilter ? '存在' : '不存在')

    const params = new URLSearchParams({
      page: page,
      limit: 10,
      search: searchInput ? searchInput.value || '' : '',
      type: typeFilter ? typeFilter.value || '' : '',
      version: versionFilter ? versionFilter.value || '' : '',
      dateFrom: dateFromFilter ? dateFromFilter.value || '' : '',
      dateTo: dateToFilter ? dateToFilter.value || '' : ''
    })

    console.log('Fetching packages with params:', params.toString())
    const response = await fetch(`${PACKAGES_API}?${params}`)
    if (!response.ok) throw new Error('获取包列表失败')

    const result = await response.json()
    console.log('API response:', result)

    if (result.success && result.data) {
      currentPackages = result.data.packages || []
      currentPage = result.data.pagination?.currentPage || 1
      totalPages = result.data.pagination?.totalPages || 1
      console.log('Set currentPackages to:', currentPackages)
    } else {
      throw new Error(result.message || '获取包列表失败')
    }

    renderPackageList()
    renderPagination()
  } catch (error) {
    console.error('加载包列表失败:', error)
    showAlert('加载包列表失败', 'danger')
  } finally {
    showLoading(false)
  }
}

// 渲染包列表
function renderPackageList() {
  console.log('🎨 renderPackageList called with currentPackages:', currentPackages)
  const packageList = document.getElementById('packageList')

  if (!packageList) {
    console.error('❌ packageList 元素不存在')
    return
  }

  console.log('📦 当前包数量:', currentPackages ? currentPackages.length : 0)

  if (!currentPackages || currentPackages.length === 0) {
    console.log('📭 显示空状态')
    packageList.innerHTML = `
            <div class="text-center py-5">
                <i class="bi bi-inbox fs-1 text-muted mb-3"></i>
                <h5 class="text-muted">暂无包文件</h5>
                <p class="text-muted">点击上传按钮添加新的包文件</p>
            </div>
        `
    return
  }

  console.log('🎯 开始渲染包列表')

  const packagesHtml = currentPackages
    .map((pkg) => {
      // 安全地转义字符串以防止HTML注入和JavaScript错误
      const escapedId = pkg.id.replace(/'/g, "\\'")
      const escapedName = pkg.name.replace(/'/g, "\\'").replace(/"/g, '&quot;')
      const escapedPath = pkg.path.replace(/'/g, "\\'").replace(/"/g, '&quot;')

      return `
        <div class="package-item card mb-3" onclick="showPackageDetail('${escapedId}')" style="cursor: pointer;">
            <div class="card-body">
                <div class="row align-items-center">
                    <div class="col-md-6">
                        <h6 class="mb-1">
                            <i class="bi bi-box-seam me-2 text-primary"></i>
                            ${escapedName}
                        </h6>
                        <p class="mb-1 text-muted small">${escapedPath}</p>
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
                            <button class="btn btn-outline-primary btn-sm" onclick="event.stopPropagation(); downloadPackage('${escapedId}')">
                                <i class="bi bi-download"></i>
                            </button>
                            <button class="btn btn-outline-info btn-sm" onclick="event.stopPropagation(); showPackageDetail('${escapedId}')">
                                <i class="bi bi-eye"></i>
                            </button>
                            <button class="btn btn-outline-danger btn-sm" onclick="event.stopPropagation(); confirmDeletePackage('${escapedId}', '${escapedName}')">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `
    })
    .join('')

  packageList.innerHTML = packagesHtml
}

// 渲染分页
function renderPagination() {
  const pagination = document.getElementById('pagination')

  if (totalPages <= 1) {
    pagination.innerHTML = ''
    return
  }

  let paginationHtml = '<ul class="pagination">'

  // 上一页
  paginationHtml += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="loadPackages(${currentPage - 1})">
                <i class="bi bi-chevron-left"></i>
            </a>
        </li>
    `

  // 页码
  const startPage = Math.max(1, currentPage - 2)
  const endPage = Math.min(totalPages, currentPage + 2)

  for (let i = startPage; i <= endPage; i++) {
    paginationHtml += `
            <li class="page-item ${i === currentPage ? 'active' : ''}">
                <a class="page-link" href="#" onclick="loadPackages(${i})">${i}</a>
            </li>
        `
  }

  // 下一页
  paginationHtml += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="loadPackages(${currentPage + 1})">
                <i class="bi bi-chevron-right"></i>
            </a>
        </li>
    `

  paginationHtml += '</ul>'
  pagination.innerHTML = paginationHtml
}

// 显示/隐藏加载状态
function showLoading(show) {
  const loadingSpinner = document.getElementById('loadingSpinner')
  const packageList = document.getElementById('packageList')

  if (show) {
    loadingSpinner.style.display = 'block'
    packageList.style.display = 'none'
  } else {
    loadingSpinner.style.display = 'none'
    packageList.style.display = 'block'
  }
}

// 搜索包
function searchPackages() {
  currentPage = 1
  loadPackages(1)
}

// 清除筛选条件 - 暂时注释掉未使用的函数
// function clearFilters() {
//   document.getElementById('searchInput').value = ''
//   document.getElementById('typeFilter').value = ''
//   document.getElementById('versionFilter').value = ''
//   document.getElementById('tagsFilter').value = ''
//   document.getElementById('patchFilter').value = ''
//   searchPackages()
// }

// 刷新包列表
function refreshPackages() {
  loadPackages(currentPage)
  loadStats()
}

// 显示包列表页面
function showPackages() {
  console.log('📦 显示包列表页面')

  const packageListSection = document.getElementById('packageListSection')
  const uploadSection = document.getElementById('uploadSection')
  const searchSection = document.getElementById('searchSection')
  const statsSection = document.getElementById('statsSection')

  if (packageListSection) {
    packageListSection.style.display = 'block'
    console.log('✅ packageListSection 设置为显示')
  } else {
    console.error('❌ packageListSection 元素不存在')
  }

  if (uploadSection) {
    uploadSection.style.display = 'none'
  }

  if (searchSection) {
    searchSection.style.display = 'block'
    console.log('✅ searchSection 设置为显示')
  }

  if (statsSection) {
    statsSection.style.display = 'flex'
    console.log('✅ statsSection 设置为显示')
  }

  console.log('📦 包列表页面显示完成')
}

// 显示上传页面 - 暂时注释掉未使用的函数
// function showUpload() {
//   document.getElementById('packageListSection').style.display = 'none'
//   document.getElementById('uploadSection').style.display = 'block'
//   document.getElementById('searchSection').style.display = 'none'
//   document.getElementById('statsSection').style.display = 'none'
// }

// 显示统计页面 - 暂时注释掉未使用的函数
// function showStats() {
//   showPackages()
//   loadStats()
// }

// 文件选择处理
function handleFileSelect(event) {
  const files = Array.from(event.target.files)
  uploadFiles(files)
}

// 拖拽处理
function handleDragOver(event) {
  event.preventDefault()
  event.currentTarget.classList.add('dragover')
}

function handleDragLeave(event) {
  event.preventDefault()
  event.currentTarget.classList.remove('dragover')
}

function handleDrop(event) {
  event.preventDefault()
  event.currentTarget.classList.remove('dragover')

  const files = Array.from(event.dataTransfer.files)
  uploadFiles(files)
}

// 上传文件
async function uploadFiles(files) {
  if (files.length === 0) return

  // 验证文件类型
  const validFiles = files.filter((file) => {
    const isValid = file.name.endsWith('.tgz') || file.name.endsWith('.tar.gz')
    if (!isValid) {
      showAlert(`文件 ${file.name} 格式不支持，仅支持 .tgz 和 .tar.gz 格式`, 'warning')
    }
    return isValid
  })

  if (validFiles.length === 0) return

  const formData = new FormData()
  validFiles.forEach((file) => {
    formData.append('file', file)
  })

  try {
    showUploadProgress(true)

    const response = await fetch(validFiles.length === 1 ? UPLOAD_API : `${UPLOAD_API}/batch`, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || '上传失败')
    }

    await response.json() // 不需要使用返回结果
    showAlert(`成功上传 ${validFiles.length} 个文件`, 'success')

    // 清空文件输入
    document.getElementById('fileInput').value = ''

    // 刷新列表
    refreshPackages()

    // 返回包列表页面
    setTimeout(() => {
      showPackages()
    }, 1000)
  } catch (error) {
    console.error('上传失败:', error)
    showAlert(`上传失败: ${error.message}`, 'danger')
  } finally {
    showUploadProgress(false)
  }
}

// 显示/隐藏上传进度
function showUploadProgress(show) {
  const uploadProgress = document.getElementById('uploadProgress')
  const uploadZone = document.getElementById('uploadZone')

  if (show) {
    uploadProgress.style.display = 'block'
    uploadZone.style.pointerEvents = 'none'
    uploadZone.style.opacity = '0.6'
  } else {
    uploadProgress.style.display = 'none'
    uploadZone.style.pointerEvents = 'auto'
    uploadZone.style.opacity = '1'
  }
}

// 显示包详情 - 暂时注释掉未使用的函数
// async function showPackageDetail(packageId) {
//   try {
//     const response = await fetch(`${PACKAGES_API}/${packageId}`)
//     if (!response.ok) throw new Error('获取包详情失败')
//
//     const result = await response.json()
//     if (!result.success || !result.data) {
//       throw new Error(result.message || '获取包详情失败')
//     }
//
//     const pkg = result.data
//     const detailContent = document.getElementById('packageDetailContent')
//     detailContent.innerHTML = `...` // 省略HTML内容
//
//     // 设置下载和删除按钮事件
//     document.getElementById('downloadPackageBtn').onclick = () => downloadPackage(packageId)
//     document.getElementById('deletePackageBtn').onclick = () => confirmDeletePackage(packageId, pkg.name)
//
//     // 显示模态框
//     const modal = new window.bootstrap.Modal(document.getElementById('packageDetailModal'))
//     modal.show()
//   } catch (error) {
//     console.error('获取包详情失败:', error)
//     showAlert('获取包详情失败', 'danger')
//   }
// }

// 下载包 - 暂时注释掉未使用的函数
// async function downloadPackage(packageId) {
//   try {
//     const response = await fetch(`${DOWNLOAD_API}/${packageId}`)
//     if (!response.ok) throw new Error('下载失败')
//
//     // 获取文件名
//     const contentDisposition = response.headers.get('Content-Disposition')
//     let filename = 'package.tgz'
//     if (contentDisposition) {
//       const filenameMatch = contentDisposition.match(/filename="(.+)"/)
//       if (filenameMatch) {
//         filename = filenameMatch[1]
//       }
//     }
//
//     // 创建下载链接
//     const blob = await response.blob()
//     const url = window.URL.createObjectURL(blob)
//     const a = document.createElement('a')
//     a.href = url
//     a.download = filename
//     document.body.appendChild(a)
//     a.click()
//     document.body.removeChild(a)
//     window.URL.revokeObjectURL(url)
//
//     showAlert('下载开始', 'success')
//   } catch (error) {
//     console.error('下载失败:', error)
//     showAlert('下载失败', 'danger')
//   }
// }

// 确认删除包 - 暂时注释掉未使用的函数
// function confirmDeletePackage(packageId, packageName) {
//   if (confirm(`确定要删除包 "${packageName}" 吗？此操作不可撤销。`)) {
//     deletePackage(packageId)
//   }
// }

// 删除包 - 暂时注释掉未使用的函数
// async function deletePackage(packageId) {
//   try {
//     const response = await fetch(`${PACKAGES_API}/${packageId}`, {
//       method: 'DELETE'
//     })
//
//     if (!response.ok) throw new Error('删除失败')
//
//     showAlert('包删除成功', 'success')
//
//     // 关闭模态框
//     const modal = window.bootstrap.Modal.getInstance(document.getElementById('packageDetailModal'))
//     if (modal) {
//       modal.hide()
//     }
//
//     // 刷新列表
//     refreshPackages()
//   } catch (error) {
//     console.error('删除失败:', error)
//     showAlert('删除失败', 'danger')
//   }
// }

// 阻止默认的拖拽行为
document.addEventListener('dragover', function (e) {
  e.preventDefault()
})

document.addEventListener('drop', function (e) {
  e.preventDefault()
})
