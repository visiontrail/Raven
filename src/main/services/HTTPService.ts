// src/main/services/HTTPService.ts

import { loggerService } from '@logger'
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios'
import * as crypto from 'crypto'
import FormData from 'form-data'
import * as fs from 'fs-extra'
import * as path from 'path'

import { HTTPConfig, Package } from '../../renderer/src/types/package'

const logger = loggerService.withContext('HTTPService')

/**
 * Interface for HTTP upload progress callback
 */
export interface HTTPUploadProgress {
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
 * Interface for the HTTP Service
 */
export interface IHTTPService {
  /**
   * Upload a file to HTTP server with complete package information
   * @param filePath Local file path
   * @param packageInfo Complete package information
   * @param httpConfig HTTP configuration
   * @param onProgress Progress callback
   * @returns Promise<boolean> True if successful
   */
  uploadFile(
    filePath: string,
    packageInfo: Package,
    httpConfig: HTTPConfig,
    onProgress?: (progress: HTTPUploadProgress) => void
  ): Promise<boolean>

  /**
   * Test HTTP connection
   * @param httpConfig HTTP configuration
   * @returns Promise<boolean> True if connection successful
   */
  testConnection(httpConfig: HTTPConfig): Promise<boolean>
}

/**
 * Implementation of the HTTP Service
 */
export class HTTPService implements IHTTPService {
  /**
   * Calculate SHA-256 hash of a file
   * @param filePath Path to the file
   * @returns Promise<string> SHA-256 hash in hexadecimal format
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256')
      const stream = fs.createReadStream(filePath)

      stream.on('data', (data) => {
        hash.update(data)
      })

      stream.on('end', () => {
        resolve(hash.digest('hex'))
      })

      stream.on('error', (error) => {
        reject(error)
      })
    })
  }
  /**
   * Upload a file to HTTP server with complete package information
   */
  async uploadFile(
    filePath: string,
    packageInfo: Package,
    httpConfig: HTTPConfig,
    onProgress?: (progress: HTTPUploadProgress) => void
  ): Promise<boolean> {
    try {
      // Check if file exists
      if (!(await fs.pathExists(filePath))) {
        throw new Error(`File not found: ${filePath}`)
      }

      // Get file stats for progress tracking
      const fileStats = await fs.stat(filePath)
      const totalBytes = fileStats.size
      const fileName = path.basename(filePath)

      // Calculate SHA-256 hash of the file
      console.log('正在计算文件SHA-256哈希值...')
      const fileHash = await this.calculateFileHash(filePath)
      console.log('文件SHA-256哈希值:', fileHash)

      // Build package info payload once
      // Send complete package information with SHA-256 hash in metadata
      const packageInfoData = {
        id: packageInfo.id,
        name: packageInfo.name,
        version: packageInfo.version,
        packageType: packageInfo.packageType,
        size: packageInfo.size,
        createdAt: packageInfo.createdAt,
        metadata: {
          ...packageInfo.metadata,
          sha256: fileHash
        }
      }

      console.log('=== HTTP上传请求详细信息 ===')
      console.log('目标URL:', httpConfig.url)
      console.log('请求方法:', httpConfig.method)
      console.log('文件路径:', filePath)
      console.log('文件名:', fileName)
      console.log('文件大小:', totalBytes, 'bytes')
      console.log('包信息 (packageInfo):', JSON.stringify(packageInfoData, null, 2))

      const packageInfoJson = JSON.stringify(packageInfoData)

      // Sanitize user headers to avoid conflicting content-type/content-length
      const userHeaders: Record<string, string> = { ...httpConfig.headers }
      for (const key of Object.keys(userHeaders)) {
        const lower = key.toLowerCase()
        if (lower === 'content-type' || lower === 'content-length' || lower === 'transfer-encoding') {
          delete userHeaders[key]
        }
      }

      // Prefer native fetch with Web FormData/Blob to avoid adapter body length mismatches
      const hasWebFormData =
        typeof (globalThis as any).FormData === 'function' && typeof (globalThis as any).Blob === 'function'
      if (hasWebFormData) {
        const WebFormData = (globalThis as any).FormData
        const WebBlob = (globalThis as any).Blob

        const form = new WebFormData()
        const fileBuffer = await fs.readFile(filePath)
        const blob = new WebBlob([fileBuffer])
        form.append('file', blob, fileName)
        form.append('packageInfo', packageInfoJson)

        const headersForFetch: Record<string, string> = { ...userHeaders }

        // Add authentication to headers
        if (httpConfig.authentication) {
          const dummy: AxiosRequestConfig = { headers: { ...headersForFetch } }
          this.addAuthentication(dummy, httpConfig.authentication)
          Object.assign(headersForFetch, dummy.headers)
        }

        // Do not set Content-Type for fetch with FormData; undici will set with boundary
        delete headersForFetch['Content-Type']
        delete headersForFetch['content-type']

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 300000)

        try {
          const res = await fetch(httpConfig.url, {
            method: httpConfig.method,
            headers: headersForFetch as any,
            body: form as any,
            signal: controller.signal
          } as any)

          clearTimeout(timeoutId)

          if (res.ok) {
            logger.info(`Successfully uploaded ${fileName} to ${httpConfig.url}`)
            return true
          }

          throw new Error(`HTTP upload failed with status ${res.status}: ${res.statusText}`)
        } catch (err: any) {
          // Align error surface with axios branch
          if (err?.name === 'AbortError') {
            throw new Error('Request timeout: The server did not respond within the expected time')
          }
          throw err
        }
      }

      // Fallback to axios with node form-data (ensure no Content-Length mismatch by leaving it unset)
      const formData = new FormData()
      ;(formData as any).maxDataSize = Number.MAX_SAFE_INTEGER
      const fileStream = fs.createReadStream(filePath)
      formData.append('file', fileStream, { filename: fileName, knownLength: totalBytes })
      formData.append('packageInfo', packageInfoJson)

      // Prepare request configuration
      const requestConfig: AxiosRequestConfig = {
        method: httpConfig.method,
        url: httpConfig.url,
        data: formData,
        headers: {
          ...userHeaders,
          ...formData.getHeaders()
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 300000 // 5 minutes timeout
      }

      // Force Node http adapter (avoid fetch/undici content-length mismatch with node FormData)
      ;(requestConfig as any).adapter = 'http'
      ;(requestConfig as any).env = {}

      // Add authentication if provided
      if (httpConfig.authentication) {
        this.addAuthentication(requestConfig, httpConfig.authentication)
      }

      // Add progress tracking if callback provided
      if (onProgress) {
        requestConfig.onUploadProgress = (progressEvent) => {
          const bytesTransferred = progressEvent.loaded || 0
          const percentage = totalBytes > 0 ? Math.round((bytesTransferred / totalBytes) * 100) : 0

          onProgress({
            bytesTransferred,
            totalBytes,
            percentage
          })
        }
      }

      logger.debug(`请求头信息: ${JSON.stringify(requestConfig.headers, null, 2)}`)
      logger.debug('=== 开始发送HTTP请求 ===')

      // Make the HTTP request
      const response: AxiosResponse = await axios(requestConfig)

      logger.debug('=== HTTP响应信息 ===')
      logger.debug(`响应状态码: ${response.status}`)
      logger.debug(`响应状态文本: ${response.statusText}`)
      logger.debug(`响应头: ${JSON.stringify(response.headers, null, 2)}`)
      logger.debug(`响应数据: ${JSON.stringify(response.data, null, 2)}`)
      logger.debug('=== HTTP上传完成 ===')

      // Check if response indicates success
      if (response.status >= 200 && response.status < 300) {
        logger.info(`Successfully uploaded ${fileName} to ${httpConfig.url}`)
        return true
      } else {
        throw new Error(`HTTP upload failed with status ${response.status}: ${response.statusText}`)
      }
    } catch (error) {
      logger.error('HTTP upload failed:', error as Error)

      // Provide more specific error messages
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error('Connection refused: Unable to connect to the server')
        } else if (error.code === 'ETIMEDOUT') {
          throw new Error('Request timeout: The server did not respond within the expected time')
        } else if (error.response) {
          throw new Error(`Server responded with error ${error.response.status}: ${error.response.statusText}`)
        } else if (error.request) {
          throw new Error('No response received from server')
        }
      }

      throw error
    }
  }

  /**
   * Test HTTP connection
   */
  async testConnection(httpConfig: HTTPConfig): Promise<boolean> {
    try {
      // Prepare a simple test request (HEAD or GET to the same endpoint)
      const requestConfig: AxiosRequestConfig = {
        method: 'HEAD', // Use HEAD to avoid downloading content
        url: httpConfig.url,
        headers: httpConfig.headers,
        timeout: 10000 // 10 seconds timeout for connection test
      }

      // Add authentication if provided
      if (httpConfig.authentication) {
        this.addAuthentication(requestConfig, httpConfig.authentication)
      }

      // Make the test request
      const response: AxiosResponse = await axios(requestConfig)

      // Check if response indicates the endpoint is accessible
      if (response.status >= 200 && response.status < 500) {
        logger.info(`HTTP connection test successful for ${httpConfig.url}`)
        return true
      } else {
        logger.warn(`HTTP connection test returned status ${response.status} for ${httpConfig.url}`)
        return false
      }
    } catch (error) {
      logger.error('HTTP connection test failed:', error as Error)

      // Some endpoints might not support HEAD, try with OPTIONS
      if (axios.isAxiosError(error) && error.response?.status === 405) {
        try {
          const optionsConfig: AxiosRequestConfig = {
            method: 'OPTIONS',
            url: httpConfig.url,
            headers: httpConfig.headers,
            timeout: 10000
          }

          if (httpConfig.authentication) {
            this.addAuthentication(optionsConfig, httpConfig.authentication)
          }

          const optionsResponse = await axios(optionsConfig)
          if (optionsResponse.status >= 200 && optionsResponse.status < 500) {
            logger.info(`HTTP connection test successful (via OPTIONS) for ${httpConfig.url}`)
            return true
          }
        } catch (optionsError) {
          logger.error('HTTP connection test with OPTIONS also failed:', optionsError as Error)
        }
      }

      return false
    }
  }

  /**
   * Add authentication to request configuration
   */
  private addAuthentication(
    requestConfig: AxiosRequestConfig,
    authentication: NonNullable<HTTPConfig['authentication']>
  ): void {
    switch (authentication.type) {
      case 'Basic':
        if (authentication.username && authentication.password) {
          const credentials = Buffer.from(`${authentication.username}:${authentication.password}`).toString('base64')
          requestConfig.headers = {
            ...requestConfig.headers,
            Authorization: `Basic ${credentials}`
          }
        }
        break

      case 'Bearer':
        if (authentication.token) {
          requestConfig.headers = {
            ...requestConfig.headers,
            Authorization: `Bearer ${authentication.token}`
          }
        }
        break

      case 'OAuth':
        if (authentication.token) {
          requestConfig.headers = {
            ...requestConfig.headers,
            Authorization: `OAuth ${authentication.token}`
          }
        }
        break

      default:
        console.warn(`Unsupported authentication type: ${authentication.type}`)
    }
  }
}

// Export singleton instance
export const httpService = new HTTPService()
