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
      console.log('[FtpService] 开始调用主进程FTP服务，配置:', this.config)
      // 调用主进程的FTP服务
      const files = await window.api.ftp.listFiles(this.config)
      console.log('[FtpService] 主进程返回的原始文件列表:', files)

      // 过滤只显示.tar.gz和.tgz文件
      const filteredFiles = files.filter((file) => {
        const lowerName = file.name.toLowerCase()
        return !file.isDirectory && (lowerName.endsWith('.tar.gz') || lowerName.endsWith('.tgz'))
      })
      console.log('[FtpService] 过滤后的文件列表:', filteredFiles)

      return filteredFiles
    } catch (error) {
      console.error('[FtpService] FTP列表文件失败:', error)
      throw new Error(`获取FTP文件列表失败: ${error instanceof Error ? error.message : String(error)}`)
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
      console.error('FTP下载文件失败:', error)
      throw new Error(`下载文件失败: ${remotePath}`)
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
      console.error('FTP删除文件失败:', error)
      throw new Error(`删除文件失败: ${remotePath}`)
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
      console.error('FTP批量删除文件失败:', error)
      throw new Error('批量删除文件失败')
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
      console.error('FTP连接测试失败:', error)
      return false
    }
  }
}

export default FtpService
