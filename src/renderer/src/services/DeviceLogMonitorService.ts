/**
 * 设备日志自动监控服务
 * 独立于页面生命周期，在应用启动时自动运行
 */

import { message } from 'antd'
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

interface MonitorConfig {
  enabled: boolean // 是否启用监控
  interval: number // 检查间隔（秒）
  autoUpload: boolean // 是否自动上传
  logServerUrl: string // 日志服务器地址
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

class DeviceLogMonitorService {
  private static instance: DeviceLogMonitorService | null = null
  private monitorTimer: NodeJS.Timeout | null = null
  private previousFiles: Map<string, DeviceLogFile> = new Map()
  private config: MonitorConfig
  private isMonitoring = false
  private uploadingFiles: Set<string> = new Set() // 正在上传的文件集合

  private constructor() {
    // 从 localStorage 加载配置
    this.config = this.loadConfig()
    console.log('[DeviceLogMonitorService] 初始化服务，配置:', this.config)
  }

  static getInstance(): DeviceLogMonitorService {
    if (!DeviceLogMonitorService.instance) {
      DeviceLogMonitorService.instance = new DeviceLogMonitorService()
    }
    return DeviceLogMonitorService.instance
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

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100)
          console.log(`[DeviceLogMonitorService] 上传进度: ${fileName} - ${progress}%`)
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status === 201) {
          try {
            const response = JSON.parse(xhr.responseText)
            if (response.success === true) {
              console.log(`[DeviceLogMonitorService] 上传成功: ${fileName}`)
              resolve()
            } else {
              reject(new Error(`上传失败: ${response.message || '未知错误'}`))
            }
          } catch (parseError) {
            reject(new Error(`解析响应失败: ${parseError}`))
          }
        } else {
          reject(new Error(`上传失败: ${xhr.status} ${xhr.statusText}`))
        }
      })

      xhr.addEventListener('error', () => {
        reject(new Error('网络错误'))
      })

      xhr.addEventListener('timeout', () => {
        reject(new Error('上传超时'))
      })

      xhr.timeout = 5 * 60 * 1000 // 5分钟

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

    try {
      const ftpService = new FtpService(this.getFTPConfig())

      // 1. 下载到本地临时目录
      console.log(`[DeviceLogMonitorService] 从FTP下载: ${file.name}`)
      const tempDir = await window.api.file.createTempFile('device_logs')
      const localPath = `${tempDir}/${file.name}`
      await ftpService.downloadFile(file.path, localPath)

      // 2. 读取文件
      const fileBuffer = await window.api.fs.read(localPath)
      const fileBlob = new Blob([fileBuffer])

      // 3. 验证文件
      this.validateLogFile(file.name, fileBlob.size)

      // 4. 上传到日志服务器
      await this.uploadToLogServer(fileBlob, file.name, file.type)

      // 5. 清理临时文件
      await window.api.file.delete(localPath)

      console.log(`[DeviceLogMonitorService] 文件处理完成: ${file.name}`)
      message.success(`${file.name} 自动上传完成`)
    } catch (error) {
      console.error(`[DeviceLogMonitorService] 上传失败: ${file.name}`, error)
      message.error(`${file.name} 自动上传失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      this.uploadingFiles.delete(fileKey)
    }
  }

  /**
   * 检测新文件并处理
   */
  private async detectAndHandleNewFiles(): Promise<void> {
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

        if (this.config.autoUpload) {
          message.info(`检测到 ${newFiles.length} 个新文件，开始自动上传...`)

          // 串行上传所有新文件
          for (const newFile of newFiles) {
            await this.uploadFile(newFile)
          }
        } else {
          console.log('[DeviceLogMonitorService] 自动上传已关闭，跳过上传')
        }
      }

      // 更新文件记录
      this.previousFiles = currentFileMap
    } catch (error) {
      console.error('[DeviceLogMonitorService] 检查失败:', error)
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

    // 立即执行一次，初始化文件列表
    try {
      const files = await this.fetchFileList()
      files.forEach((file) => {
        const fileKey = `${file.path}_${file.size}_${file.modifiedTime.getTime()}`
        this.previousFiles.set(fileKey, file)
      })
      console.log(`[DeviceLogMonitorService] 初始化文件列表，共 ${files.length} 个文件`)
    } catch (error) {
      console.error('[DeviceLogMonitorService] 初始化文件列表失败:', error)
    }

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

    this.previousFiles.clear()
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
