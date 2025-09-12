// src/main/services/FTPService.ts

import { loggerService } from '@logger'
import { Client as FTPClient } from 'basic-ftp'
import * as fs from 'fs-extra'
import * as path from 'path'

import { FTPConfig } from '../../renderer/src/types/package'

const logger = loggerService.withContext('FTPService')

/**
 * Interface for FTP upload progress callback
 */
export interface FTPUploadProgress {
  /**
   * Number of bytes transferred
   */
  bytesTransferred: number

  /**
   * Total number of bytes to transfer
   */
  totalBytes: number

  /**
   * Progress percentage (0-100)
   */
  percentage: number
}

/**
 * Interface for FTP file information
 */
export interface FTPFileInfo {
  name: string
  size: number
  modifiedTime: Date
  isDirectory: boolean
  path: string
}

/**
 * Interface for the FTP Service
 */
export interface IFTPService {
  /**
   * Upload a file to FTP server
   * @param filePath Local file path
   * @param ftpConfig FTP configuration
   * @param onProgress Progress callback
   * @returns Promise<boolean> True if successful
   */
  uploadFile(
    filePath: string,
    ftpConfig: FTPConfig,
    onProgress?: (progress: FTPUploadProgress) => void
  ): Promise<boolean>

  /**
   * List files in FTP directory
   * @param ftpConfig FTP configuration
   * @returns Promise<FTPFileInfo[]> Array of file information
   */
  listFiles(ftpConfig: FTPConfig): Promise<FTPFileInfo[]>

  /**
   * Download a file from FTP server
   * @param ftpConfig FTP configuration
   * @param remotePath Remote file path
   * @param localPath Local file path
   * @returns Promise<void>
   */
  downloadFile(ftpConfig: FTPConfig, remotePath: string, localPath: string): Promise<void>

  /**
   * Delete a file from FTP server
   * @param ftpConfig FTP configuration
   * @param remotePath Remote file path
   * @returns Promise<void>
   */
  deleteFile(ftpConfig: FTPConfig, remotePath: string): Promise<void>

  /**
   * Delete multiple files from FTP server
   * @param ftpConfig FTP configuration
   * @param remotePaths Array of remote file paths
   * @returns Promise<void>
   */
  deleteFiles(ftpConfig: FTPConfig, remotePaths: string[]): Promise<void>

  /**
   * Test FTP connection
   * @param ftpConfig FTP configuration
   * @returns Promise<boolean> True if connection successful
   */
  testConnection(ftpConfig: FTPConfig): Promise<boolean>
}

/**
 * Implementation of the FTP Service
 */
export class FTPService implements IFTPService {
  /**
   * Upload a file to FTP server
   */
  async uploadFile(
    filePath: string,
    ftpConfig: FTPConfig,
    onProgress?: (progress: FTPUploadProgress) => void
  ): Promise<boolean> {
    const client = new FTPClient()

    try {
      // Check if file exists
      if (!(await fs.pathExists(filePath))) {
        throw new Error(`File not found: ${filePath}`)
      }

      // Get file stats for progress tracking
      const fileStats = await fs.stat(filePath)
      const totalBytes = fileStats.size
      let bytesTransferred = 0

      // Set up progress tracking if callback provided
      if (onProgress) {
        // Use the proper progress tracking API for basic-ftp
        client.trackProgress((info) => {
          // info may be undefined in some implementations, add a check
          if (info) {
            // Use transferred as the property name instead of bytesOverall
            bytesTransferred = info.bytes || 0
            const percentage = totalBytes > 0 ? Math.round((bytesTransferred / totalBytes) * 100) : 0

            onProgress({
              bytesTransferred,
              totalBytes,
              percentage
            })
          }
        })
      }

      // Connect to FTP server
      await client.access({
        host: ftpConfig.host,
        port: ftpConfig.port,
        user: ftpConfig.username,
        password: ftpConfig.password,
        secure: false // Use FTPS if needed
      })

      // Ensure remote directory exists
      const remoteDir = path.dirname(ftpConfig.remotePath)
      if (remoteDir && remoteDir !== '.') {
        try {
          await client.ensureDir(remoteDir)
        } catch (error) {
          logger.warn(`Could not create remote directory ${remoteDir}:`, error as Error)
        }
      }

      // Upload the file
      await client.uploadFrom(filePath, ftpConfig.remotePath)

      logger.info(`Successfully uploaded ${path.basename(filePath)} to ${ftpConfig.host}:${ftpConfig.remotePath}`)
      return true
    } catch (error) {
      logger.error('FTP upload failed:', error as Error)
      throw error
    } finally {
      // Always close the connection
      client.close()
    }
  }

  /**
   * List files in FTP directory
   */
  async listFiles(ftpConfig: FTPConfig): Promise<FTPFileInfo[]> {
    const client = new FTPClient()

    try {
      logger.info(`[FTPService] Starting FTP server connection: ${ftpConfig.host}:${ftpConfig.port}`)
      logger.info(`[FTPService] FTP configuration:`, ftpConfig)

      // Connect to FTP server
      await client.access({
        host: ftpConfig.host,
        port: ftpConfig.port,
        user: ftpConfig.username,
        password: ftpConfig.password,
        secure: false
      })
      logger.info(`[FTPService] FTP connection successful`)

      // Change to the specified directory
      if (ftpConfig.remotePath && ftpConfig.remotePath !== '/') {
        logger.info(`[FTPService] Switching to directory: ${ftpConfig.remotePath}`)
        await client.cd(ftpConfig.remotePath)
      }

      // List files in the directory
      logger.info(`[FTPService] Starting to list files...`)
      const fileList = await client.list()
      logger.info(`[FTPService] Raw file list:`, fileList)

      // Convert to our FTPFileInfo format
      const files: FTPFileInfo[] = fileList.map((file) => {
        const ftpFile = {
          name: file.name,
          size: file.size || 0,
          modifiedTime: file.modifiedAt || new Date(),
          isDirectory: file.isDirectory,
          path: path.posix.join(ftpConfig.remotePath || '/', file.name)
        }
        logger.info('[FTPService] Converting file:', { source: file, target: ftpFile })
        return ftpFile
      })

      logger.info(
        `[FTPService] Successfully listed ${files.length} files from ${ftpConfig.host}:${ftpConfig.remotePath}`
      )
      logger.info(`[FTPService] Final file list:`, files)
      return files
    } catch (error) {
      logger.error('[FTPService] FTP list files failed:', error as Error)
      throw error
    } finally {
      client.close()
    }
  }

  /**
   * Download a file from FTP server
   */
  async downloadFile(ftpConfig: FTPConfig, remotePath: string, localPath: string): Promise<void> {
    const client = new FTPClient()
    
    logger.info(`Starting FTP download: ${remotePath} -> ${localPath}`)
    logger.info(`FTP Config: host=${ftpConfig.host}, port=${ftpConfig.port}, user=${ftpConfig.username}`)

    try {
      // Connect to FTP server
      logger.info('Connecting to FTP server...')
      await client.access({
        host: ftpConfig.host,
        port: ftpConfig.port,
        user: ftpConfig.username,
        password: ftpConfig.password,
        secure: false
      })
      logger.info('FTP connection established successfully')

      // Ensure local directory exists
      const localDir = path.dirname(localPath)
      logger.info(`Ensuring local directory exists: ${localDir}`)
      await fs.ensureDir(localDir)

      // Check if remote file exists
      logger.info(`Checking if remote file exists: ${remotePath}`)
      try {
        const fileInfo = await client.size(remotePath)
        logger.info(`Remote file size: ${fileInfo} bytes`)
      } catch (sizeError) {
        logger.warn(`Could not get remote file size: ${sizeError}`)
      }

      // Download the file
      logger.info(`Starting file download: ${remotePath}`)
      await client.downloadTo(localPath, remotePath)
      
      // Verify downloaded file
      const stats = await fs.stat(localPath)
      logger.info(`Download completed. Local file size: ${stats.size} bytes`)
      
      if (stats.size === 0) {
        throw new Error(`Downloaded file is empty (0 bytes). This may indicate the remote file doesn't exist or there was a transfer error.`)
      }

      logger.info(`Successfully downloaded ${remotePath} to ${localPath}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error(`FTP download failed for ${remotePath}:`, {
        error: errorMessage,
        remotePath,
        localPath,
        ftpHost: ftpConfig.host,
        ftpPort: ftpConfig.port
      })
      
      // Clean up empty file if it was created
      try {
        const stats = await fs.stat(localPath)
        if (stats.size === 0) {
          await fs.unlink(localPath)
          logger.info(`Removed empty file: ${localPath}`)
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      
      throw new Error(`FTP download failed: ${errorMessage}. Remote path: ${remotePath}, Local path: ${localPath}`)
    } finally {
      try {
        client.close()
        logger.info('FTP connection closed')
      } catch (closeError) {
        logger.warn('Error closing FTP connection:', closeError as Error)
      }
    }
  }

  /**
   * Delete a file from FTP server
   */
  async deleteFile(ftpConfig: FTPConfig, remotePath: string): Promise<void> {
    const client = new FTPClient()

    try {
      // Connect to FTP server
      await client.access({
        host: ftpConfig.host,
        port: ftpConfig.port,
        user: ftpConfig.username,
        password: ftpConfig.password,
        secure: false
      })

      // Delete the file
      await client.remove(remotePath)

      logger.info(`Successfully deleted ${remotePath} from FTP server`)
    } catch (error) {
      logger.error('FTP delete failed:', error as Error)
      throw error
    } finally {
      client.close()
    }
  }

  /**
   * Delete multiple files from FTP server
   */
  async deleteFiles(ftpConfig: FTPConfig, remotePaths: string[]): Promise<void> {
    const client = new FTPClient()

    try {
      // Connect to FTP server
      await client.access({
        host: ftpConfig.host,
        port: ftpConfig.port,
        user: ftpConfig.username,
        password: ftpConfig.password,
        secure: false
      })

      // Delete files one by one
      for (const remotePath of remotePaths) {
        try {
          await client.remove(remotePath)
          logger.info(`Successfully deleted ${remotePath} from FTP server`)
        } catch (error) {
          logger.error(`Failed to delete ${remotePath}:`, error as Error)
          // Continue with other files even if one fails
        }
      }
    } catch (error) {
      logger.error('FTP batch delete failed:', error as Error)
      throw error
    } finally {
      client.close()
    }
  }

  /**
   * Test FTP connection
   */
  async testConnection(ftpConfig: FTPConfig): Promise<boolean> {
    const client = new FTPClient()

    try {
      // Connect to FTP server
      await client.access({
        host: ftpConfig.host,
        port: ftpConfig.port,
        user: ftpConfig.username,
        password: ftpConfig.password,
        secure: false
      })

      // Test by listing current directory
      await client.list()

      logger.info(`FTP connection test successful for ${ftpConfig.host}:${ftpConfig.port}`)
      return true
    } catch (error) {
      logger.error('FTP connection test failed:', error as Error)
      return false
    } finally {
      // Always close the connection
      client.close()
    }
  }
}

// Export singleton instance
export const ftpService = new FTPService()
