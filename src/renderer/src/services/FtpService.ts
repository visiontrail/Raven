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
   * @returns Promise<void>
   */
  async downloadFile(remotePath: string, localPath: string): Promise<void> {
    try {
      await window.api.ftp.downloadFile(this.config, remotePath, localPath)
    } catch (error) {
      console.error('FTP download file failed:', error)
      throw new Error(`Failed to download file: ${remotePath}`)
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
