/**
 * 设备日志自动监控服务
 * 独立于页面生命周期，在应用启动时自动运行
 */

import { message, Progress } from 'antd'
import { createElement } from 'react'
import { EventEmitter } from 'events'

import FtpService, { FtpConfig } from './FtpService'
import { ipAddressService } from './IPAddressService'

export interface DeviceLogFile {
  id: string
  name: string
  size: number
  modifiedTime: Date
  type: 'protocol' | 'oam_antenna' | 'full'
  path: string
}

export type UploadStage = 'discovering' | 'downloading' | 'uploading'

interface MonitorConfig {
  enabled: boolean // 是否启用监控
  interval: number // 检查间隔（秒）
  autoUpload: boolean // 是否自动上传
  logServerUrl: string // 日志服务器地址
}

export interface UploadStatusPayload {
  state: 'idle' | UploadStage
  fileName?: string
  logType?: 'protocol' | 'oam_antenna' | 'full'
  progress?: number
}

// 默认配置
const DEFAULT_CONFIG: MonitorConfig = {
  enabled: true, // 默认启用
  interval: 30,
  autoUpload: true,
  logServerUrl: 'http://172.16.9.224:8085/api/v1/logs/upload'
}

// 配置存储键
const CONFIG_STORAGE_KEY = 'device_log_monitor_config'
const FILES_STATE_STORAGE_KEY = 'device_log_monitor_files_state'

class DeviceLogMonitorService {
  private static instance: DeviceLogMonitorService | null = null
  private monitorTimer: NodeJS.Timeout | null = null
  private previousFiles: Map<string, DeviceLogFile> = new Map()
  private config: MonitorConfig
  private isMonitoring = false
  private uploadingFiles: Set<string> = new Set() // 正在上传的文件集合
  private isFirstScan = true // 首次扫描标识
  private isChecking = false // 避免定时检查并发触发
  private eventEmitter = new EventEmitter()
  private currentUploadXhr: XMLHttpRequest | null = null
  private currentUploadInfo: { fileName: string; logType: 'protocol' | 'oam_antenna' | 'full' } | null = null
  private currentUploadStage: UploadStatusPayload['state'] = 'idle'
  private currentUploadProgress = 0
  private uploadMessageKey = 'device-log-upload'

  private getLogTypeLabel(logType?: 'protocol' | 'oam_antenna' | 'full'): string {
    if (!logType) return '日志'
    switch (logType) {
      case 'protocol':
        return '协议栈'
      case 'oam_antenna':
        return 'OAM/天线'
      case 'full':
        return '完整日志'
      default:
        return '日志'
    }
  }

  private renderUploadToast(options: {
    type: 'loading' | 'success' | 'warning' | 'error' | 'info'
    title: string
    description?: string
    fileName?: string
    logType?: 'protocol' | 'oam_antenna' | 'full'
    progress?: number
    actions?: Array<{ label: string; onClick: () => void; danger?: boolean }>
  }): void {
    const closeToast = () => message.destroy(this.uploadMessageKey)
    const logTypeLabel = this.getLogTypeLabel(options.logType)
    const fullName =
      options.fileName && options.fileName.length > 0
        ? `${options.fileName}${options.logType ? ` (${logTypeLabel})` : ''}`
        : ''

    const actions = [...(options.actions ?? [])]
    // 保证始终有关闭按钮
    actions.push({
      label: '关闭',
      onClick: closeToast
    })

    message.open({
      type: options.type,
      key: this.uploadMessageKey,
      duration: 0,
      style: { maxWidth: 520 },
      content: createElement(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            maxWidth: 520
          }
        },
        createElement(
          'div',
          {
            style: {
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8
            }
          },
          createElement(
            'div',
            { style: { flex: 1, minWidth: 0 } },
            createElement(
              'div',
              { style: { fontWeight: 600, color: 'var(--color-text)' } },
              options.title
            ),
            options.description
              ? createElement(
                  'div',
                  {
                    style: {
                      marginTop: 4,
                      color: 'var(--color-text-secondary)'
                    }
                  },
                  options.description
                )
              : null,
            fullName
              ? createElement(
                  'div',
                  {
                    style: {
                      marginTop: 4,
                      color: 'var(--color-text-tertiary)',
                      fontSize: 12,
                      wordBreak: 'break-all'
                    }
                  },
                  fullName
                )
              : null
          ),
          createElement(
            'a',
            {
              style: {
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                fontSize: 14,
                lineHeight: 1
              },
              onClick: closeToast
            },
            '×'
          )
        ),
        options.progress !== undefined
          ? createElement(
              'div',
              {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }
              },
              createElement(Progress, {
                percent: Math.max(0, Math.min(options.progress, 100)),
                size: 'small',
                status: options.type === 'error' ? 'exception' : options.type === 'success' ? 'normal' : 'active',
                strokeWidth: 8,
                showInfo: false,
                style: { flex: 1, margin: 0 }
              }),
              createElement(
                'span',
                {
                  style: {
                    minWidth: 42,
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    color: 'var(--color-text)'
                  }
                },
                `${Math.round(Math.max(0, Math.min(options.progress, 100)))}%`
              )
            )
          : null,
        actions.length
          ? createElement(
              'div',
              {
                style: {
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 12
                }
              },
              actions.map((action, index) =>
                createElement(
                  'a',
                  {
                    key: `${action.label}-${index}`,
                    onClick: action.onClick,
                    style: {
                      color: action.danger ? 'var(--color-danger)' : 'var(--color-primary)',
                      fontWeight: 500
                    }
                  },
                  action.label
                )
              )
            )
          : null
      )
    })
  }

  private constructor() {
    // 从 localStorage 加载配置
    this.config = this.loadConfig()
    // 加载文件状态
    this.loadFilesState()
    console.log('[DeviceLogMonitorService] 初始化服务，配置:', this.config)
  }

  static getInstance(): DeviceLogMonitorService {
    if (!DeviceLogMonitorService.instance) {
      DeviceLogMonitorService.instance = new DeviceLogMonitorService()
    }
    return DeviceLogMonitorService.instance
  }

  /**
   * 订阅上传状态变化
   */
  onUploadStatusChange(handler: (payload: UploadStatusPayload) => void): () => void {
    this.eventEmitter.on('upload-status', handler)
    return () => this.eventEmitter.off('upload-status', handler)
  }

  /**
   * 获取当前上传状态（用于初始化界面显示）
   */
  getCurrentUploadStatus(): UploadStatusPayload {
    if (this.currentUploadStage !== 'idle' && this.currentUploadInfo) {
      return {
        state: this.currentUploadStage,
        fileName: this.currentUploadInfo.fileName,
        logType: this.currentUploadInfo.logType,
        progress: this.currentUploadStage === 'uploading' ? this.currentUploadProgress : undefined
      }
    }
    return { state: 'idle' }
  }

  /**
   * 取消当前正在进行的HTTP上传
   */
  cancelCurrentUpload(): void {
    if (this.currentUploadXhr) {
      this.currentUploadXhr.abort()
    } else {
      message.info('当前没有正在上传的日志')
    }
  }

  private emitUploadStatus(payload: UploadStatusPayload): void {
    console.log('[DeviceLogMonitorService] 上传状态变更:', payload)
    if (payload.state !== 'idle' && payload.fileName) {
      const logTypeLabel = this.getLogTypeLabel(payload.logType)
      const fullName = `${payload.fileName}${payload.logType ? ` (${logTypeLabel})` : ''}`
      const stageLabelMap: Record<UploadStage, string> = {
        discovering: '检测到新日志',
        downloading: '日志下载中',
        uploading: '日志上传中'
      }
      const stageText = payload.state === 'idle' ? '' : stageLabelMap[payload.state as UploadStage] || '日志处理中'
      const progressValue = payload.state === 'uploading' ? Math.max(0, Math.min(payload.progress ?? 0, 100)) : undefined

      this.renderUploadToast({
        type: 'loading',
        title: stageText,
        description: fullName,
        fileName: payload.fileName,
        logType: payload.logType,
        progress: progressValue,
        actions: [
          {
            label: '取消',
            onClick: () => this.cancelCurrentUpload()
          }
        ]
      })
    }
    this.eventEmitter.emit('upload-status', payload)
  }

  private setUploadStatus(
    state: UploadStatusPayload['state'],
    info?: { fileName: string; logType: 'protocol' | 'oam_antenna' | 'full' },
    progress?: number
  ): void {
    this.currentUploadStage = state

    if (state === 'idle') {
      this.currentUploadInfo = null
      this.currentUploadXhr = null
      this.currentUploadProgress = 0
      this.emitUploadStatus({ state: 'idle' })
      return
    }

    const targetInfo = info ?? this.currentUploadInfo
    if (!targetInfo) {
      return
    }

    if (info) {
      this.currentUploadInfo = info
    }

    if (state === 'uploading') {
      if (progress !== undefined) {
        this.currentUploadProgress = Math.max(0, Math.min(progress, 100))
      }
    } else {
      this.currentUploadProgress = 0
    }

    this.emitUploadStatus({
      state,
      fileName: targetInfo.fileName,
      logType: targetInfo.logType,
      progress: state === 'uploading' ? this.currentUploadProgress : undefined
    })
  }

  private clearCurrentUpload(): void {
    this.setUploadStatus('idle')
  }

  /**
   * 从 localStorage 加载配置
   */
  private loadConfig(): MonitorConfig {
    try {
      const saved = localStorage.getItem(CONFIG_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        return { ...DEFAULT_CONFIG, ...parsed }
      }
    } catch (error) {
      console.error('[DeviceLogMonitorService] 加载配置失败:', error)
    }
    return { ...DEFAULT_CONFIG }
  }

  /**
   * 保存配置到 localStorage
   */
  private saveConfig(): void {
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(this.config))
      console.log('[DeviceLogMonitorService] 配置已保存:', this.config)
    } catch (error) {
      console.error('[DeviceLogMonitorService] 保存配置失败:', error)
    }
  }

  /**
   * 从 localStorage 加载文件状态
   */
  private loadFilesState(): void {
    try {
      const saved = localStorage.getItem(FILES_STATE_STORAGE_KEY)
      if (saved) {
        const filesData = JSON.parse(saved)
        this.previousFiles.clear()

        // 重建文件映射，注意日期对象的反序列化
        Object.entries(filesData).forEach(([key, fileData]: [string, any]) => {
          const file: DeviceLogFile = {
            ...fileData,
            modifiedTime: new Date(fileData.modifiedTime)
          }
          this.previousFiles.set(key, file)
        })

        console.log(`[DeviceLogMonitorService] 已加载 ${this.previousFiles.size} 个文件状态记录`)
        this.isFirstScan = false // 如果有历史记录，则不是首次扫描
      } else {
        console.log('[DeviceLogMonitorService] 没有找到历史文件状态记录，将进行首次扫描')
        this.isFirstScan = true
      }
    } catch (error) {
      console.error('[DeviceLogMonitorService] 加载文件状态失败:', error)
      this.isFirstScan = true
    }
  }

  /**
   * 保存文件状态到 localStorage
   */
  private saveFilesState(): void {
    try {
      // 将Map转换为普通对象进行序列化
      const filesData: Record<string, DeviceLogFile> = {}
      this.previousFiles.forEach((file, key) => {
        filesData[key] = file
      })

      localStorage.setItem(FILES_STATE_STORAGE_KEY, JSON.stringify(filesData))
      console.log(`[DeviceLogMonitorService] 已保存 ${this.previousFiles.size} 个文件状态记录`)
    } catch (error) {
      console.error('[DeviceLogMonitorService] 保存文件状态失败:', error)
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): MonitorConfig {
    return { ...this.config }
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<MonitorConfig>): void {
    const oldEnabled = this.config.enabled
    const oldInterval = this.config.interval

    this.config = { ...this.config, ...updates }
    this.saveConfig()

    console.log('[DeviceLogMonitorService] 配置已更新:', this.config)

    // 如果启用状态或间隔改变，需要重启监控
    if (this.isMonitoring) {
      if (updates.enabled === false) {
        this.stop()
      } else if (oldEnabled !== this.config.enabled || oldInterval !== this.config.interval) {
        this.restart()
      }
    } else if (this.config.enabled) {
      this.start()
    }
  }

  /**
   * 获取 FTP 配置
   */
  private getFTPConfig(): FtpConfig {
    const dynamicFTPConfig = ipAddressService.getFTPConfig()
    return {
      host: dynamicFTPConfig.host,
      port: 10002,
      username: 'anonymous',
      password: 'anonymous',
      remotePath: '/logs'
    }
  }

  /**
   * 根据文件名判断日志类型
   */
  private getLogType(fileName: string): 'protocol' | 'oam_antenna' | 'full' {
    const lowerName = fileName.toLowerCase()
    const hasStack = lowerName.includes('stack')
    const hasOam = lowerName.includes('om') || lowerName.includes('oam')

    if (hasStack && hasOam) {
      return 'full'
    } else if (hasStack) {
      return 'protocol'
    } else if (hasOam) {
      return 'oam_antenna'
    }

    if (lowerName.includes('protocol') || lowerName.includes('协议栈')) {
      return 'protocol'
    }
    return 'oam_antenna'
  }

  /**
   * 获取文件列表
   */
  private async fetchFileList(): Promise<DeviceLogFile[]> {
    try {
      const ftpConfig = this.getFTPConfig()
      const ftpService = new FtpService(ftpConfig)
      const ftpFiles = await ftpService.listFiles()

      const deviceLogFiles: DeviceLogFile[] = ftpFiles.map((file, index) => ({
        id: `${index + 1}`,
        name: file.name,
        size: file.size,
        modifiedTime: file.modifiedTime,
        type: this.getLogType(file.name),
        path: file.path
      }))

      return deviceLogFiles
    } catch (error) {
      console.error('[DeviceLogMonitorService] 获取文件列表失败:', error)
      return []
    }
  }

  /**
   * 验证日志文件
   */
  private validateLogFile(fileName: string, fileSize: number): void {
    const allowedExtensions = ['.tgz', '.tar.gz']
    const fileExtension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
    if (!allowedExtensions.includes(fileExtension)) {
      throw new Error(`不支持的文件格式: ${fileExtension}`)
    }

    const maxSize = 1024 * 1024 * 1024 // 1GB
    if (fileSize > maxSize) {
      throw new Error(`文件大小超过限制: ${(fileSize / 1024 / 1024).toFixed(2)} MB`)
    }

    if (fileName.includes('/') || fileName.includes('\\')) {
      throw new Error('文件名不能包含路径分隔符')
    }
  }

  /**
   * 上传文件到日志服务器
   */
  private async uploadToLogServer(
    fileBlob: Blob,
    fileName: string,
    logType: 'protocol' | 'oam_antenna' | 'full'
  ): Promise<void> {
    console.log(`[DeviceLogMonitorService] 开始上传: ${fileName}`)

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      let finished = false

      this.currentUploadXhr = xhr
      this.setUploadStatus('uploading', { fileName, logType }, 0)

      const finalize = () => {
        if (finished) return
        finished = true
        this.clearCurrentUpload()
      }

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100)
          console.log(`[DeviceLogMonitorService] 上传进度: ${fileName} - ${progress}%`)
          this.setUploadStatus('uploading', { fileName, logType }, progress)
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status === 201) {
          try {
            const response = JSON.parse(xhr.responseText)
            if (response.success === true) {
              console.log(`[DeviceLogMonitorService] 上传成功: ${fileName}`)
              finalize()
              resolve()
            } else {
              finalize()
              reject(new Error(`上传失败: ${response.message || '未知错误'}`))
            }
          } catch (parseError) {
            finalize()
            reject(new Error(`解析响应失败: ${parseError}`))
          }
        } else {
          finalize()
          reject(new Error(`上传失败: ${xhr.status} ${xhr.statusText}`))
        }
      })

      xhr.addEventListener('error', () => {
        finalize()
        reject(new Error('网络错误'))
      })

      xhr.addEventListener('timeout', () => {
        finalize()
        reject(new Error('上传超时'))
      })

      xhr.addEventListener('abort', () => {
        finalize()
        reject(new Error('上传已取消'))
      })

      xhr.timeout = 30 * 60 * 1000 // 30分钟

      const formData = new FormData()
      formData.append('file', fileBlob, fileName)

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
      formData.append('log_level', 'info')
      formData.append('issue_description', '')

      xhr.open('POST', this.config.logServerUrl)
      xhr.send(formData)
    })
  }

  /**
   * 上传单个文件
   */
  private async uploadFile(file: DeviceLogFile): Promise<void> {
    // 防止重复上传
    const fileKey = `${file.path}_${file.size}_${file.modifiedTime.getTime()}`
    if (this.uploadingFiles.has(fileKey)) {
      console.log(`[DeviceLogMonitorService] 文件正在上传中，跳过: ${file.name}`)
      return
    }

    this.uploadingFiles.add(fileKey)
    let localPath: string | null = null

    try {
      this.setUploadStatus('discovering', { fileName: file.name, logType: file.type })
      const ftpService = new FtpService(this.getFTPConfig())

      // 1. 下载到本地临时目录
      console.log(`[DeviceLogMonitorService] 从FTP下载: ${file.name}`)
      this.setUploadStatus('downloading')
      const tempDir = await window.api.file.createTempFile('device_logs')
      localPath = `${tempDir}/${file.name}`
      await ftpService.downloadFile(file.path, localPath)

      // 2. 读取文件
      const fileBuffer = await window.api.fs.read(localPath)
      const fileBlob = new Blob([fileBuffer])

      // 3. 验证文件
      this.validateLogFile(file.name, fileBlob.size)

      // 4. 上传到日志服务器
      await this.uploadToLogServer(fileBlob, file.name, file.type)

      await window.api.file.delete(localPath)
      localPath = null
      try {
        await ftpService.deleteFile(file.path)
        console.log(`[DeviceLogMonitorService] 已删除FTP源文件: ${file.name}`)
        this.renderUploadToast({
          type: 'success',
          title: '日志上传完成',
          description: `${file.name} 已上传并删除FTP源文件`,
          fileName: file.name,
          logType: file.type,
          progress: 100
        })
      } catch (delErr) {
        const delMessage = delErr instanceof Error ? delErr.message : '未知原因'
        console.error(`[DeviceLogMonitorService] 删除FTP源文件失败: ${file.name}`, delErr)
        this.renderUploadToast({
          type: 'warning',
          title: '上传成功，但删除FTP源文件失败',
          description: `${file.name} 上传成功，但删除源文件失败：${delMessage}`,
          fileName: file.name,
          logType: file.type,
          progress: 100
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      console.error(`[DeviceLogMonitorService] 上传失败: ${file.name}`, error)
      if (errorMessage === '上传已取消') {
        this.renderUploadToast({
          type: 'info',
          title: '上传已取消',
          description: `${file.name} 的上传已被取消`,
          fileName: file.name,
          logType: file.type
        })
      } else {
        this.renderUploadToast({
          type: 'error',
          title: '自动上传失败',
          description: `${file.name} 上传失败：${errorMessage}`,
          fileName: file.name,
          logType: file.type
        })
      }
    } finally {
      this.uploadingFiles.delete(fileKey)
      if (localPath) {
        try {
          await window.api.file.delete(localPath)
          console.log(`[DeviceLogMonitorService] 已清理本地临时文件: ${localPath}`)
        } catch (cleanupError) {
          console.warn(`[DeviceLogMonitorService] 清理本地临时文件失败: ${localPath}`, cleanupError)
        }
      }
      this.setUploadStatus('idle')
    }
  }

  /**
   * 检测新文件并处理
   */
  private async detectAndHandleNewFiles(): Promise<void> {
    if (this.isChecking) {
      console.log('[DeviceLogMonitorService] 上一次检查尚未完成，跳过本次触发')
      return
    }

    // 如果当前有上传任务进行中，避免并发触发导致同一文件重复上传
    if (this.currentUploadStage !== 'idle' || this.uploadingFiles.size > 0) {
      console.log('[DeviceLogMonitorService] 当前有上传任务进行中，跳过本次检查')
      return
    }

    this.isChecking = true
    console.log('[DeviceLogMonitorService] 执行定时检查...')

    try {
      const currentFiles = await this.fetchFileList()

      // 构建当前文件映射
      const currentFileMap = new Map<string, DeviceLogFile>()
      currentFiles.forEach((file) => {
        const fileKey = `${file.path}_${file.size}_${file.modifiedTime.getTime()}`
        currentFileMap.set(fileKey, file)
      })

      // 查找新文件
      const newFiles: DeviceLogFile[] = []
      currentFileMap.forEach((file, key) => {
        if (!this.previousFiles.has(key)) {
          newFiles.push(file)
        }
      })

      if (newFiles.length > 0) {
        console.log(
          `[DeviceLogMonitorService] 发现 ${newFiles.length} 个新文件:`,
          newFiles.map((f) => f.name)
        )

        // 如果是首次扫描，只记录文件状态，不上传
        if (this.isFirstScan) {
          console.log('[DeviceLogMonitorService] 首次扫描，仅记录文件状态，不进行上传')
          message.info(`首次扫描发现 ${newFiles.length} 个文件，已记录状态`)
          this.isFirstScan = false
        } else if (this.config.autoUpload) {
          message.info(`检测到 ${newFiles.length} 个新文件，开始自动上传...`)

          // 串行上传所有新文件
          for (const newFile of newFiles) {
            await this.uploadFile(newFile)
          }
        } else {
          console.log('[DeviceLogMonitorService] 自动上传已关闭，跳过上传')
        }
      } else if (this.isFirstScan) {
        // 首次扫描但没有新文件的情况
        console.log('[DeviceLogMonitorService] 首次扫描完成，没有发现新文件')
        this.isFirstScan = false
      }

      // 更新文件记录
      this.previousFiles = currentFileMap

      // 保存文件状态到本地存储
      this.saveFilesState()
    } catch (error) {
      console.error('[DeviceLogMonitorService] 检查失败:', error)
    } finally {
      this.isChecking = false
    }
  }

  /**
   * 启动监控
   */
  async start(): Promise<void> {
    if (this.isMonitoring) {
      console.log('[DeviceLogMonitorService] 监控已在运行中')
      return
    }

    if (!this.config.enabled) {
      console.log('[DeviceLogMonitorService] 监控已禁用，不启动')
      return
    }

    console.log(`[DeviceLogMonitorService] 启动监控，间隔: ${this.config.interval} 秒`)
    this.isMonitoring = true

    // 初始化 IP 地址服务
    ipAddressService.initialize()

    // 立即执行一次检查（包含首次扫描逻辑）
    await this.detectAndHandleNewFiles()

    // 设置定时器
    this.monitorTimer = setInterval(() => {
      this.detectAndHandleNewFiles()
    }, this.config.interval * 1000)

    message.success(`设备日志自动监控已启动，每 ${this.config.interval} 秒检查一次`)
  }

  /**
   * 停止监控
   */
  stop(): void {
    if (!this.isMonitoring) {
      console.log('[DeviceLogMonitorService] 监控未运行')
      return
    }

    console.log('[DeviceLogMonitorService] 停止监控')
    this.isMonitoring = false

    if (this.monitorTimer) {
      clearInterval(this.monitorTimer)
      this.monitorTimer = null
    }

    // 保存当前文件状态，但不清除内存中的记录
    this.saveFilesState()
    message.info('设备日志自动监控已停止')
  }

  /**
   * 重启监控
   */
  async restart(): Promise<void> {
    console.log('[DeviceLogMonitorService] 重启监控')
    this.stop()
    await this.start()
  }

  /**
   * 获取监控状态
   */
  isRunning(): boolean {
    return this.isMonitoring
  }

  /**
   * 应用启动时初始化
   */
  async initialize(): Promise<void> {
    console.log('[DeviceLogMonitorService] 应用启动初始化')

    // 如果配置为启用，则自动启动监控
    if (this.config.enabled && this.config.autoUpload) {
      await this.start()
    } else {
      console.log('[DeviceLogMonitorService] 自动监控或自动上传未启用，不自动启动')
    }
  }
}

// 导出单例实例
export const deviceLogMonitorService = DeviceLogMonitorService.getInstance()
