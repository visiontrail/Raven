// src/main/services/FTPService.ts

import * as fs from 'fs-extra'
import * as path from 'path'
import { Client as FTPClient } from 'basic-ftp'

import { FTPConfig } from '../../renderer/src/types/package'

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
        client.trackingBytes = (info) => {
          bytesTransferred = info.bytesOverall
          const percentage = totalBytes > 0 ? Math.round((bytesTransferred / totalBytes) * 100) : 0
          
          onProgress({
            bytesTransferred,
            totalBytes,
            percentage
          })
        }
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
          console.warn(`Could not create remote directory ${remoteDir}:`, error)
        }
      }

      // Upload the file
      await client.uploadFrom(filePath, ftpConfig.remotePath)

      console.log(`Successfully uploaded ${path.basename(filePath)} to ${ftpConfig.host}:${ftpConfig.remotePath}`)
      return true

    } catch (error) {
      console.error('FTP upload failed:', error)
      throw error
    } finally {
      // Always close the connection
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
      
      console.log(`FTP connection test successful for ${ftpConfig.host}:${ftpConfig.port}`)
      return true

    } catch (error) {
      console.error('FTP connection test failed:', error)
      return false
    } finally {
      // Always close the connection
      client.close()
    }
  }
}

// Export singleton instance
export const ftpService = new FTPService()