// src/main/services/HTTPService.ts

import * as fs from 'fs-extra'
import * as path from 'path'
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios'
import FormData from 'form-data'

import { HTTPConfig, Package } from '../../renderer/src/types/package'

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

      // Create form data with file and complete package information
      const formData = new FormData()
      const fileStream = fs.createReadStream(filePath)

      formData.append('file', fileStream, fileName)
      // Send complete package information
      const packageInfoData = {
        id: packageInfo.id,
        name: packageInfo.name,
        version: packageInfo.version,
        packageType: packageInfo.packageType,
        size: packageInfo.size,
        createdAt: packageInfo.createdAt,
        metadata: packageInfo.metadata
      }
      
      console.log('=== HTTP上传请求详细信息 ===')
      console.log('目标URL:', httpConfig.url)
      console.log('请求方法:', httpConfig.method)
      console.log('文件路径:', filePath)
      console.log('文件名:', fileName)
      console.log('文件大小:', totalBytes, 'bytes')
      console.log('包信息 (packageInfo):', JSON.stringify(packageInfoData, null, 2))
      
      formData.append('packageInfo', JSON.stringify(packageInfoData))

      // Prepare request configuration
      const requestConfig: AxiosRequestConfig = {
        method: httpConfig.method,
        url: httpConfig.url,
        data: formData,
        headers: {
          ...httpConfig.headers,
          ...formData.getHeaders()
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 300000 // 5 minutes timeout
      }

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

      console.log('请求头信息:', JSON.stringify(requestConfig.headers, null, 2))
      console.log('=== 开始发送HTTP请求 ===')
      
      // Make the HTTP request
      const response: AxiosResponse = await axios(requestConfig)
      
      console.log('=== HTTP响应信息 ===')
      console.log('响应状态码:', response.status)
      console.log('响应状态文本:', response.statusText)
      console.log('响应头:', JSON.stringify(response.headers, null, 2))
      console.log('响应数据:', JSON.stringify(response.data, null, 2))
      console.log('=== HTTP上传完成 ===')

      // Check if response indicates success
      if (response.status >= 200 && response.status < 300) {
        console.log(`Successfully uploaded ${fileName} to ${httpConfig.url}`)
        return true
      } else {
        throw new Error(`HTTP upload failed with status ${response.status}: ${response.statusText}`)
      }

    } catch (error) {
      console.error('HTTP upload failed:', error)
      
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
        console.log(`HTTP connection test successful for ${httpConfig.url}`)
        return true
      } else {
        console.warn(`HTTP connection test returned status ${response.status} for ${httpConfig.url}`)
        return false
      }

    } catch (error) {
      console.error('HTTP connection test failed:', error)
      
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
            console.log(`HTTP connection test successful (via OPTIONS) for ${httpConfig.url}`)
            return true
          }
        } catch (optionsError) {
          console.error('HTTP connection test with OPTIONS also failed:', optionsError)
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