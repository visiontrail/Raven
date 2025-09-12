/**
 * FTP服务类
 * 用于处理设备日志的FTP操作
 */

export interface FtpConfig {
  host: string
  port: number
  username: string
  password: string
  remotePath: string
}

export interface FtpFileInfo {
  name: string
  size: number
  modifiedTime: Date
  isDirectory: boolean
  path: string
}

export interface FtpDownloadProgress {
  bytesTransferred: number
  totalBytes: number
  percentage: number
}

class FtpService {
  private config: FtpConfig

  constructor(config: FtpConfig) {
    this.config = config
  }

  /**
   * 连接到FTP服务器并获取文件列表
   * @returns Promise<FtpFileInfo[]>
   */
  async listFiles(): Promise<FtpFileInfo[]> {
    try {
      console.log('[FtpService] Starting to call main process FTP service, config:', this.config)
      // 调用主进程的FTP服务
      const files = await window.api.ftp.listFiles(this.config)
      console.log('[FtpService] Raw file list returned from main process:', files)

      // 过滤只显示.tar.gz和.tgz文件
      const filteredFiles = files.filter((file) => {
        const lowerName = file.name.toLowerCase()
        return !file.isDirectory && (lowerName.endsWith('.tar.gz') || lowerName.endsWith('.tgz'))
      })
      console.log('[FtpService] Filtered file list:', filteredFiles)

      return filteredFiles
    } catch (error) {
      console.error('[FtpService] FTP list files failed:', error)
      throw new Error(`Failed to get FTP file list: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 从FTP服务器下载文件
   * @param remotePath 远程文件路径
   * @param localPath 本地保存路径
   * @param onProgress 进度回调函数
   * @returns Promise<void>
   */
  async downloadFile(
    remotePath: string,
    localPath: string,
    onProgress?: (progress: FtpDownloadProgress) => void
  ): Promise<void> {
    console.log('[FtpService] Starting download:', { remotePath, localPath, config: this.config })
    
    try {
      // 如果有进度回调，设置事件监听器
      let progressListener: ((event: any, data: any) => void) | null = null
      
      if (onProgress) {
        progressListener = (_event: any, data: any) => {
          if (data.remotePath === remotePath && data.localPath === localPath) {
            onProgress(data.progress)
          }
        }
        
        // 监听进度事件
        window.electron.ipcRenderer.on('ftp-download-progress', progressListener)
      }
      
      try {
        // 调用主进程下载，启用进度回调
        await window.api.ftp.downloadFile(this.config, remotePath, localPath, !!onProgress)
        console.log('[FtpService] Download completed successfully:', remotePath)
      } finally {
        // 清理事件监听器
        if (progressListener) {
          window.electron.ipcRenderer.removeListener('ftp-download-progress', progressListener)
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('[FtpService] FTP download file failed:', {
        error: errorMessage,
        remotePath,
        localPath,
        config: this.config,
        originalError: error
      })
      
      // 保留原始错误信息
      throw error instanceof Error ? error : new Error(`Failed to download file: ${remotePath} - ${errorMessage}`)
    }
  }

  /**
   * 删除FTP服务器上的文件
   * @param remotePath 远程文件路径
   * @returns Promise<void>
   */
  async deleteFile(remotePath: string): Promise<void> {
    try {
      await window.api.ftp.deleteFile(this.config, remotePath)
    } catch (error) {
      console.error('FTP delete file failed:', error)
      throw new Error(`Failed to delete file: ${remotePath}`)
    }
  }

  /**
   * 批量删除FTP服务器上的文件
   * @param remotePaths 远程文件路径数组
   * @returns Promise<void>
   */
  async deleteFiles(remotePaths: string[]): Promise<void> {
    try {
      await window.api.ftp.deleteFiles(this.config, remotePaths)
    } catch (error) {
      console.error('FTP batch delete files failed:', error)
      throw new Error('Failed to batch delete files')
    }
  }

  /**
   * 测试FTP连接
   * @returns Promise<boolean>
   */
  async testConnection(): Promise<boolean> {
    try {
      return await window.api.ftp.testConnection(this.config)
    } catch (error) {
      console.error('FTP connection test failed:', error)
      return false
    }
  }
}

export default FtpService
