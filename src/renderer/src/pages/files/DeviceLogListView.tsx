import {
  DeleteOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SettingOutlined,
  UploadOutlined
} from '@ant-design/icons'
import { Button, Empty, Flex, InputNumber, message, Popconfirm, Progress, Switch, Table, Tag, Tooltip } from 'antd'
import { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { FileText } from 'lucide-react'
import { FC, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import DownloadProgressDialog from '../../components/DownloadProgressDialog'
import { deviceLogMonitorService } from '../../services/DeviceLogMonitorService'
import FtpService from '../../services/FtpService'
import { ipAddressService } from '../../services/IPAddressService'
import { formatFileSize } from '../../utils'

// 设备日志文件接口
interface DeviceLogFile {
  id: string
  name: string
  size: number
  modifiedTime: Date
  type: 'protocol' | 'oam_antenna' | 'full' // 协议栈日志 | OAM与天线日志 | 完整日志
  path: string
  uploadProgress?: number // 上传进度 0-100，undefined表示未上传
}

// FTP配置
const getFTPConfig = () => {
  // 使用动态IP地址服务获取FTP配置
  const dynamicFTPConfig = ipAddressService.getFTPConfig()
  return {
    host: dynamicFTPConfig.host, // 使用动态获取的IP地址
    port: 10002,
    username: 'anonymous',
    password: 'anonymous',
    remotePath: '/logs'
  }
}

// 日志服务器配置
const LOG_SERVER_URL = 'http://172.16.9.224:8085/api/v1/logs/upload'

interface DeviceLogListViewProps {}

const DeviceLogListView: FC<DeviceLogListViewProps> = () => {
  const { t } = useTranslation()
  const [files, setFiles] = useState<DeviceLogFile[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])
  const [uploadingFileIds, setUploadingFileIds] = useState<Set<string>>(new Set())
  const [downloadingFileIds, setDownloadingFileIds] = useState<Set<string>>(new Set())
  const [downloadProgress, setDownloadProgress] = useState<{
    visible: boolean
    fileName: string
    progress: {
      bytesTransferred: number
      totalBytes: number
      percentage: number
    }
  }>({ visible: false, fileName: '', progress: { bytesTransferred: 0, totalBytes: 0, percentage: 0 } })

  // 自动监控相关状态 - 使用全局服务
  const [monitorConfig, setMonitorConfig] = useState(() => deviceLogMonitorService.getConfig())
  const [isMonitoring, setIsMonitoring] = useState(() => deviceLogMonitorService.isRunning())

  // 确保初始化动态IP服务
  useEffect(() => {
    ipAddressService.initialize()
  }, [])

  // 根据文件名判断日志类型
  const getLogType = useCallback((fileName: string): 'protocol' | 'oam_antenna' | 'full' => {
    const lowerName = fileName.toLowerCase()

    // 检查是否包含stack关键字
    const hasStack = lowerName.includes('stack')

    // 检查是否包含om或oam关键字
    const hasOam = lowerName.includes('om') || lowerName.includes('oam')

    // 根据包含的关键字判断类型
    if (hasStack && hasOam) {
      return 'full' // 既包含stack又包含om/oam
    } else if (hasStack) {
      return 'protocol' // 只包含stack，映射为protocol类型
    } else if (hasOam) {
      return 'oam_antenna' // 只包含om/oam
    }

    // 默认情况：如果都不包含，则根据原有逻辑判断
    if (lowerName.includes('protocol') || lowerName.includes('协议栈')) {
      return 'protocol'
    }
    return 'oam_antenna'
  }, [])

  // 获取日志类型标签颜色
  const getLogTypeColor = (type: 'protocol' | 'oam_antenna' | 'full'): string => {
    switch (type) {
      case 'protocol':
        return 'blue'
      case 'oam_antenna':
        return 'green'
      case 'full':
        return 'purple'
      default:
        return 'default'
    }
  }

  // 获取日志类型标签文本
  const getLogTypeText = (type: 'protocol' | 'oam_antenna' | 'full'): string => {
    switch (type) {
      case 'protocol':
        return '协议栈日志'
      case 'oam_antenna':
        return 'OAM与天线日志'
      case 'full':
        return '完整日志'
      default:
        return '未知类型'
    }
  }

  // FTP连接和获取文件列表
  const fetchFileList = useCallback(
    async (silent = false) => {
      console.log('[DeviceLogListView] 开始获取文件列表...')
      if (!silent) {
        setLoading(true)
      }
      try {
        const ftpConfig = getFTPConfig()
        console.log('[DeviceLogListView] FTP配置:', ftpConfig)
        const ftpService = new FtpService(ftpConfig)
        console.log('[DeviceLogListView] 调用FTP服务listFiles...')
        const ftpFiles = await ftpService.listFiles()
        console.log('[DeviceLogListView] FTP返回的文件列表:', ftpFiles)

        // 转换为DeviceLogFile格式
        const deviceLogFiles: DeviceLogFile[] = ftpFiles.map((file, index) => {
          const deviceFile = {
            id: `${index + 1}`,
            name: file.name,
            size: file.size,
            modifiedTime: file.modifiedTime,
            type: getLogType(file.name),
            path: file.path
          }
          console.log('[DeviceLogListView] 转换文件:', file, '->', deviceFile)
          return deviceFile
        })

        console.log('[DeviceLogListView] 最终设备日志文件列表:', deviceLogFiles)
        setFiles(deviceLogFiles)
        if (!silent) {
          message.success(`设备日志列表刷新成功，共 ${deviceLogFiles.length} 个文件`)
        }

        // 返回新文件列表供监控使用
        return deviceLogFiles
      } catch (error) {
        console.error('[DeviceLogListView] 获取设备日志列表失败:', error)
        if (!silent) {
          message.error(`获取设备日志列表失败: ${error instanceof Error ? error.message : String(error)}`)
        }
        return []
      } finally {
        if (!silent) {
          setLoading(false)
        }
      }
    },
    [getLogType]
  )

  // 删除日志文件
  const handleDelete = async (file: DeviceLogFile) => {
    try {
      const ftpService = new FtpService(getFTPConfig())
      await ftpService.deleteFile(file.path)

      setFiles((prev) => prev.filter((f) => f.id !== file.id))
      message.success(`删除日志文件 ${file.name} 成功`)
    } catch (error) {
      console.error('删除日志文件失败:', error)
      message.error('删除日志文件失败')
    }
  }

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的文件')
      return
    }

    try {
      const selectedFiles = files.filter((f) => selectedRowKeys.includes(f.id))
      const remotePaths = selectedFiles.map((f) => f.path)

      const ftpService = new FtpService(getFTPConfig())
      await ftpService.deleteFiles(remotePaths)

      setFiles((prev) => prev.filter((f) => !selectedRowKeys.includes(f.id)))
      setSelectedRowKeys([])
      message.success(`批量删除 ${selectedRowKeys.length} 个文件成功`)
    } catch (error) {
      console.error('批量删除失败:', error)
      message.error('批量删除失败')
    }
  }

  // 文件验证函数
  const validateLogFile = (fileName: string, fileSize: number) => {
    // 检查文件扩展名
    const allowedExtensions = ['.tgz', '.tar.gz']
    const fileExtension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
    if (!allowedExtensions.includes(fileExtension)) {
      throw new Error(`不支持的文件格式: ${fileExtension}。支持的格式: ${allowedExtensions.join(', ')}`)
    }

    // 检查文件大小 (1GB = 1024 * 1024 * 1024 bytes)
    const maxSize = 1024 * 1024 * 1024
    if (fileSize > maxSize) {
      throw new Error(`文件大小超过限制。最大支持 1GB，当前文件大小: ${(fileSize / 1024 / 1024).toFixed(2)} MB`)
    }

    // 检查文件名是否包含路径分隔符
    if (fileName.includes('/') || fileName.includes('\\')) {
      throw new Error('文件名不能包含路径分隔符')
    }
  }

  // 上传文件到日志服务器
  const uploadToLogServer = async (
    fileBlob: Blob,
    fileName: string,
    logType: 'protocol' | 'oam_antenna' | 'full' = 'protocol',
    onProgress?: (progress: number) => void
  ) => {
    console.log(`[DeviceLogUpload] 开始上传到日志服务器: ${fileName}`)
    console.log(`[DeviceLogUpload] 目标URL: ${LOG_SERVER_URL}`)
    console.log(`[DeviceLogUpload] 文件大小: ${fileBlob.size} bytes (${(fileBlob.size / 1024 / 1024).toFixed(2)} MB)`)
    console.log(`[DeviceLogUpload] 文件类型: ${fileBlob.type || 'unknown'}`)

    return new Promise<Response>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const startTime = Date.now()

      // 监听上传进度
      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100)
            const elapsed = Date.now() - startTime
            const speed = event.loaded / (elapsed / 1000) // bytes per second
            const speedMB = (speed / 1024 / 1024).toFixed(2) // MB/s
            console.log(
              `[DeviceLogUpload] 上传进度: ${progress}% (${event.loaded}/${event.total} bytes) 速度: ${speedMB} MB/s`
            )
            onProgress(progress)
          }
        })
      }

      // 监听请求完成
      xhr.addEventListener('load', () => {
        const elapsed = Date.now() - startTime
        console.log(`[DeviceLogUpload] HTTP响应状态: ${xhr.status} ${xhr.statusText}`)
        console.log(`[DeviceLogUpload] 上传耗时: ${(elapsed / 1000).toFixed(2)} 秒`)
        console.log(`[DeviceLogUpload] 响应头 Content-Type: ${xhr.getResponseHeader('Content-Type')}`)
        console.log(`[DeviceLogUpload] 响应内容: ${xhr.responseText}`)

        // 根据新接口规范，成功状态码应该是201
        if (xhr.status === 201) {
          try {
            // 解析JSON响应
            const response = JSON.parse(xhr.responseText)
            console.log(`[DeviceLogUpload] 解析后的响应数据:`, response)

            if (response.success === true) {
              console.log(`[DeviceLogUpload] 上传成功: ${fileName}`)
              console.log(`[DeviceLogUpload] 服务器返回消息: ${response.message}`)
              if (response.data) {
                console.log(`[DeviceLogUpload] 文件ID: ${response.data.id}`)
                console.log(`[DeviceLogUpload] 存储文件名: ${response.data.filename}`)
                console.log(`[DeviceLogUpload] 文件状态: ${response.data.status}`)
                console.log(`[DeviceLogUpload] 下载URL: ${response.data.download_url}`)
              }
              resolve(
                new Response(xhr.responseText, {
                  status: xhr.status,
                  statusText: xhr.statusText
                })
              )
            } else {
              console.error(`[DeviceLogUpload] 服务器返回失败状态: success=${response.success}`)
              console.error(`[DeviceLogUpload] 错误消息: ${response.message || '未知错误'}`)
              reject(new Error(`上传失败: ${response.message || '服务器返回失败状态'}`))
            }
          } catch (parseError) {
            console.error(`[DeviceLogUpload] 解析响应JSON失败:`, parseError)
            console.error(`[DeviceLogUpload] 原始响应内容: ${xhr.responseText}`)
            reject(
              new Error(`解析服务器响应失败: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
            )
          }
        } else {
          console.error(`[DeviceLogUpload] 上传失败，HTTP状态码: ${xhr.status} ${xhr.statusText}`)
          console.error(`[DeviceLogUpload] 期望状态码: 201，实际状态码: ${xhr.status}`)

          // 尝试解析错误响应
          try {
            const errorResponse = JSON.parse(xhr.responseText)
            console.error(`[DeviceLogUpload] 错误响应详情:`, errorResponse)
            reject(new Error(`上传失败 (${xhr.status}): ${errorResponse.message || xhr.statusText}`))
          } catch {
            reject(new Error(`上传失败: ${xhr.status} ${xhr.statusText}`))
          }
        }
      })

      // 监听请求错误
      xhr.addEventListener('error', () => {
        console.error(`[DeviceLogUpload] 网络错误，上传失败`)
        console.error(`[DeviceLogUpload] 可能的原因: 网络连接中断、服务器不可达、CORS问题等`)
        reject(new Error('网络错误，上传失败'))
      })

      // 监听请求超时
      xhr.addEventListener('timeout', () => {
        console.error(`[DeviceLogUpload] 上传超时 (${xhr.timeout}ms)`)
        console.error(`[DeviceLogUpload] 建议: 检查网络连接或增加超时时间`)
        reject(new Error('上传超时'))
      })

      // 设置超时时间 (5分钟)
      xhr.timeout = 5 * 60 * 1000

      // 准备表单数据
      const formData = new FormData()
      formData.append('file', fileBlob, fileName)

      // 根据文件类型设置log_type参数
      let apiLogType: string
      switch (logType) {
        case 'protocol':
          apiLogType = 'stack'
          break
        case 'oam_antenna':
          apiLogType = 'oam_antenna'
          break
        case 'full':
          apiLogType = 'full'
          break
        default:
          apiLogType = 'stack'
      }
      formData.append('log_type', apiLogType)

      // 设置默认的log_level
      formData.append('log_level', 'info')

      // 添加问题描述字段（可为空）
      formData.append('issue_description', '')

      console.log(`[DeviceLogUpload] 准备发送请求:`)
      console.log(`[DeviceLogUpload] - 方法: POST`)
      console.log(`[DeviceLogUpload] - URL: ${LOG_SERVER_URL}`)
      console.log(`[DeviceLogUpload] - Content-Type: multipart/form-data (自动设置)`)
      console.log(`[DeviceLogUpload] - 文件参数名: file`)
      console.log(`[DeviceLogUpload] - 文件名: ${fileName}`)
      console.log(`[DeviceLogUpload] - 日志类型: ${apiLogType}`)
      console.log(`[DeviceLogUpload] - 日志级别: info`)
      console.log(`[DeviceLogUpload] - 问题描述: (空)`)
      console.log(`[DeviceLogUpload] - 超时时间: ${xhr.timeout}ms`)

      // 发送请求
      xhr.open('POST', LOG_SERVER_URL)
      xhr.send(formData)

      console.log(`[DeviceLogUpload] HTTP请求已发送，等待服务器响应...`)
    })
  }

  // 上传并处理日志文件
  const handleUploadAndProcess = async (file: DeviceLogFile) => {
    setUploadingFileIds((prev) => new Set(prev).add(file.id))

    // 初始化进度为0
    setFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, uploadProgress: 0 } : f)))

    try {
      const ftpService = new FtpService(getFTPConfig())

      // 1. 从FTP下载文件到本地临时目录
      message.info(`正在从FTP下载 ${file.name}...`)
      const tempDir = await window.api.file.createTempFile('device_logs')
      const localPath = `${tempDir}/${file.name}`
      await ftpService.downloadFile(file.path, localPath)

      // 2. 读取文件并准备上传
      message.info(`正在准备上传 ${file.name} 到日志服务器...`)
      console.log(`[DeviceLogUpload] 开始读取本地文件: ${localPath}`)

      // 使用Electron API读取文件
      const fileBuffer = await window.api.fs.read(localPath)
      const fileBlob = new Blob([fileBuffer])

      console.log(`[DeviceLogUpload] 文件读取成功，大小: ${fileBlob.size} bytes`)

      // 验证文件
      validateLogFile(file.name, fileBlob.size)
      console.log(`[DeviceLogUpload] 文件验证通过: ${file.name}`)

      console.log(`[DeviceLogUpload] 开始HTTP上传: ${file.name}`)
      // 根据文件名自动判断日志类型
      const autoDetectedLogType = getLogType(file.name)
      console.log(`[DeviceLogUpload] 自动检测的日志类型: ${autoDetectedLogType}`)
      const response = await uploadToLogServer(fileBlob, file.name, autoDetectedLogType, (progress) => {
        // 更新文件列表中的进度
        setFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, uploadProgress: progress } : f)))
        console.log(`[DeviceLogUpload] 进度更新: ${progress}%`)
      })

      // 4. 检查响应
      console.log(`[DeviceLogUpload] 检查HTTP响应状态`)
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[DeviceLogUpload] HTTP响应错误: ${response.status} ${response.statusText} - ${errorText}`)
        throw new Error(`上传失败: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`)
      }

      // 5. 解析响应结果
      console.log(`[DeviceLogUpload] 解析服务器响应`)
      const result = await response.json().catch(() => ({}))
      console.log(`[DeviceLogUpload] 服务器响应解析成功:`, result)

      // 6. 删除本地临时文件
      console.log(`[DeviceLogUpload] 清理本地临时文件: ${localPath}`)
      message.info(`正在清理本地临时文件...`)
      await window.api.file.delete(localPath)
      console.log(`[DeviceLogUpload] 临时文件删除成功`)

      // 标记上传完成
      setFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, uploadProgress: 100 } : f)))

      console.log(`[DeviceLogUpload] 整个上传流程完成: ${file.name}`)
      message.success(`${file.name} 上传完成`)
    } catch (error) {
      console.error('上传并处理日志文件失败:', error)
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      message.error(`上传失败: ${errorMessage}`)

      // 清除进度
      setFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, uploadProgress: undefined } : f)))
    } finally {
      setUploadingFileIds((prev) => {
        const newSet = new Set(prev)
        newSet.delete(file.id)
        return newSet
      })
    }
  }

  // 直接下载文件
  const handleDirectDownload = async (file: DeviceLogFile) => {
    const ftpConfig = getFTPConfig()
    console.log('[DeviceLogListView] Starting direct download:', {
      fileId: file.id,
      fileName: file.name,
      filePath: file.path,
      fileSize: file.size,
      ftpConfig
    })

    setDownloadingFileIds((prev) => new Set(prev).add(file.id))

    try {
      // 弹出文件选择器
      console.log('[DeviceLogListView] Opening file save dialog...')
      const result = await window.api.file.save('', '', {
        defaultPath: file.name,
        filters: [
          { name: 'Tar.gz Files', extensions: ['tar.gz'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      console.log('[DeviceLogListView] File save dialog result:', result)

      if (!result) {
        console.log('[DeviceLogListView] Download canceled by user')
        return
      }

      const savePath = result // result is already the file path string

      // 显示下载进度对话框
      setDownloadProgress({
        visible: true,
        fileName: file.name,
        progress: { bytesTransferred: 0, totalBytes: file.size, percentage: 0 }
      })

      // 从FTP下载文件
      console.log('[DeviceLogListView] Starting FTP download...', {
        remotePath: file.path,
        localPath: savePath
      })

      const ftpService = new FtpService(ftpConfig)
      await ftpService.downloadFile(file.path, savePath, (progress) => {
        setDownloadProgress((prev) => ({
          ...prev,
          progress: {
            bytesTransferred: progress.bytesTransferred,
            totalBytes: progress.totalBytes,
            percentage: progress.percentage
          }
        }))
      })

      console.log('[DeviceLogListView] Download completed successfully')
      message.success(`${file.name} 下载完成`)

      // 隐藏进度对话框
      setDownloadProgress((prev) => ({ ...prev, visible: false }))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('[DeviceLogListView] 下载文件失败:', {
        error: errorMessage,
        fileId: file.id,
        fileName: file.name,
        filePath: file.path,
        ftpConfig,
        originalError: error
      })

      // 显示更详细的错误信息
      const userMessage = errorMessage.includes('FTP download failed')
        ? `下载失败: ${errorMessage}`
        : `下载文件失败: ${errorMessage}`

      message.error(userMessage)
      // 隐藏进度对话框
      setDownloadProgress((prev) => ({ ...prev, visible: false }))
    } finally {
      setDownloadingFileIds((prev) => {
        const newSet = new Set(prev)
        newSet.delete(file.id)
        return newSet
      })
      console.log('[DeviceLogListView] Download process finished for file:', file.id)
    }
  }

  // 批量上传并处理
  const handleBatchUploadAndProcess = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要处理的文件')
      return
    }

    const selectedFiles = files.filter((f) => selectedRowKeys.includes(f.id))

    for (const file of selectedFiles) {
      await handleUploadAndProcess(file)
    }

    setSelectedRowKeys([])
  }

  // 批量下载
  const handleBatchDownload = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要下载的文件')
      return
    }

    const selectedFiles = files.filter((f) => selectedRowKeys.includes(f.id))

    for (const file of selectedFiles) {
      await handleDirectDownload(file)
    }

    setSelectedRowKeys([])
  }

  // 更新监控配置
  const updateMonitorConfig = useCallback((updates: Partial<typeof monitorConfig>) => {
    deviceLogMonitorService.updateConfig(updates)
    setMonitorConfig(deviceLogMonitorService.getConfig())
    setIsMonitoring(deviceLogMonitorService.isRunning())
  }, [])

  // 切换监控启用状态
  const toggleMonitoring = useCallback(() => {
    updateMonitorConfig({ enabled: !monitorConfig.enabled })
  }, [monitorConfig.enabled, updateMonitorConfig])

  // 同步监控状态（用于页面显示）
  useEffect(() => {
    const interval = setInterval(() => {
      const running = deviceLogMonitorService.isRunning()
      if (running !== isMonitoring) {
        setIsMonitoring(running)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [isMonitoring])

  // 组件挂载时获取文件列表和配置
  useEffect(() => {
    fetchFileList()
    // 同步最新配置
    setMonitorConfig(deviceLogMonitorService.getConfig())
    setIsMonitoring(deviceLogMonitorService.isRunning())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 表格列配置
  const columns: ColumnsType<DeviceLogFile> = [
    {
      title: t('files.name'),
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: DeviceLogFile) => (
        <Flex align="center" gap={8}>
          <FileText size={16} />
          <Tooltip title={record.path}>
            <span>{name}</span>
          </Tooltip>
        </Flex>
      )
    },
    {
      title: '日志类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: 'protocol' | 'oam_antenna' | 'full') => (
        <Tag color={getLogTypeColor(type)}>{getLogTypeText(type)}</Tag>
      )
    },
    {
      title: t('files.size'),
      dataIndex: 'size',
      key: 'size',
      render: (size: number) => formatFileSize(size)
    },
    {
      title: '修改时间',
      dataIndex: 'modifiedTime',
      key: 'modifiedTime',
      render: (modifiedTime: Date) => dayjs(modifiedTime).format('MM-DD HH:mm')
    },
    {
      title: '上传进度',
      dataIndex: 'uploadProgress',
      key: 'uploadProgress',
      width: 120,
      render: (progress: number | undefined, record: DeviceLogFile) => {
        if (uploadingFileIds.has(record.id)) {
          return (
            <Progress
              percent={progress || 0}
              size="small"
              status={progress === 100 ? 'success' : 'active'}
              showInfo={true}
            />
          )
        }
        if (progress === 100) {
          return <Tag color="success">已上传</Tag>
        }
        return <span style={{ color: '#999' }}>-</span>
      }
    },
    {
      title: t('files.actions'),
      key: 'actions',
      render: (_, record: DeviceLogFile) => (
        <Flex align="center" gap={4}>
          <Tooltip title="上传并处理">
            <Button
              type="text"
              size="small"
              icon={<UploadOutlined />}
              loading={uploadingFileIds.has(record.id)}
              onClick={() => handleUploadAndProcess(record)}
            />
          </Tooltip>
          <Tooltip title="直接下载">
            <Button
              type="text"
              size="small"
              icon={<DownloadOutlined />}
              loading={downloadingFileIds.has(record.id)}
              onClick={() => handleDirectDownload(record)}
            />
          </Tooltip>
          <Popconfirm
            title={t('files.delete.title')}
            description={t('files.delete.content')}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
            onConfirm={() => handleDelete(record)}
            icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}>
            <Tooltip title={t('common.delete')}>
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Flex>
      )
    }
  ]

  return (
    <Container>
      <HeaderContainer>
        <Flex justify="space-between" align="center">
          <Flex align="center" gap={8}>
            <FileText size={16} />
            <span>设备日志 ({files.length})</span>
          </Flex>
          <Flex gap={8}>
            {selectedRowKeys.length > 0 && (
              <>
                <Button type="primary" size="small" icon={<UploadOutlined />} onClick={handleBatchUploadAndProcess}>
                  批量处理 ({selectedRowKeys.length})
                </Button>
                <Button size="small" icon={<DownloadOutlined />} onClick={handleBatchDownload}>
                  批量下载 ({selectedRowKeys.length})
                </Button>
                <Popconfirm
                  title="确认批量删除"
                  description={`确定要删除选中的 ${selectedRowKeys.length} 个文件吗？`}
                  okText={t('common.confirm')}
                  cancelText={t('common.cancel')}
                  onConfirm={handleBatchDelete}
                  icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}>
                  <Button danger size="small" icon={<DeleteOutlined />}>
                    批量删除 ({selectedRowKeys.length})
                  </Button>
                </Popconfirm>
              </>
            )}
            <Button type="text" icon={<ReloadOutlined />} onClick={() => fetchFileList()} loading={loading}>
              {t('common.refresh')}
            </Button>
          </Flex>
        </Flex>
      </HeaderContainer>

      {/* 自动监控控制面板 */}
      <MonitoringPanel>
        <Flex justify="space-between" align="center">
          <Flex align="center" gap={16}>
            <Flex align="center" gap={8}>
              <SettingOutlined />
              <span style={{ fontWeight: 500 }}>全局自动监控</span>
            </Flex>
            <Tooltip title={monitorConfig.enabled ? '点击禁用监控' : '点击启用监控'}>
              <Button
                type={monitorConfig.enabled ? 'primary' : 'default'}
                size="small"
                icon={monitorConfig.enabled ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                onClick={toggleMonitoring}
                danger={monitorConfig.enabled}>
                {monitorConfig.enabled ? '禁用监控' : '启用监控'}
              </Button>
            </Tooltip>
            {isMonitoring && (
              <Tag color="processing" icon={<PlayCircleOutlined />}>
                后台监控中
              </Tag>
            )}
            {!isMonitoring && monitorConfig.enabled && <Tag color="warning">正在启动...</Tag>}
          </Flex>
          <Flex align="center" gap={16}>
            <Flex align="center" gap={8}>
              <span style={{ fontSize: '12px', color: '#666' }}>检查间隔(秒):</span>
              <InputNumber
                size="small"
                min={5}
                max={300}
                value={monitorConfig.interval}
                onChange={(value) => updateMonitorConfig({ interval: value || 30 })}
                style={{ width: 80 }}
              />
            </Flex>
            <Flex align="center" gap={8}>
              <span style={{ fontSize: '12px', color: '#666' }}>自动上传:</span>
              <Switch
                checked={monitorConfig.autoUpload}
                onChange={(checked) => updateMonitorConfig({ autoUpload: checked })}
                size="small"
              />
            </Flex>
          </Flex>
        </Flex>
        <Flex style={{ marginTop: 8, fontSize: '12px', color: '#999' }}>
          <span>💡 提示：监控服务在后台全局运行，不受页面切换影响。配置更改会立即保存并应用。</span>
        </Flex>
      </MonitoringPanel>

      {files.length > 0 ? (
        <Table
          columns={columns}
          dataSource={files}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 50,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} files`
          }}
          rowSelection={{
            selectedRowKeys,
            onChange: (selectedRowKeys: React.Key[]) => setSelectedRowKeys(selectedRowKeys as string[]),
            type: 'checkbox'
          }}
          size="small"
        />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无设备日志文件" style={{ marginTop: 40 }}>
          <Button onClick={() => fetchFileList()} icon={<ReloadOutlined />}>
            刷新列表
          </Button>
        </Empty>
      )}

      <DownloadProgressDialog
        visible={downloadProgress.visible}
        fileName={downloadProgress.fileName}
        progress={downloadProgress.progress}
        onCancel={() => setDownloadProgress((prev) => ({ ...prev, visible: false }))}
      />
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`

const HeaderContainer = styled.div`
  padding: 12px 16px;
  border-bottom: 0.5px solid var(--color-border);
  background-color: var(--color-background);
`

const MonitoringPanel = styled.div`
  padding: 12px 16px;
  border-bottom: 0.5px solid var(--color-border);
  background-color: var(--color-background-soft);
`

export default DeviceLogListView
