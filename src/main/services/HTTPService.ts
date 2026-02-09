// src/main/services/HTTPService.ts

import { loggerService } from '@logger'
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios'
import * as crypto from 'crypto'
import { http as followHttp, https as followHttps } from 'follow-redirects'
import FormData from 'form-data'
import * as fs from 'fs-extra'
import * as http from 'http'
import * as https from 'https'
import * as path from 'path'

import { HTTPUploadProgress } from '@shared/PackageUploadEvent'
import { HTTPConfig, Package } from '../../renderer/src/types/package'
import type { ClientRequest } from 'http'

// Dynamic import for axios http adapter with multiple fallback strategies
let axiosHttpAdapter: AxiosRequestConfig['adapter'] | undefined

async function getHttpAdapter(): Promise<AxiosRequestConfig['adapter']> {
  if (axiosHttpAdapter) return axiosHttpAdapter

  const resolveWithGetAdapter = (candidate: unknown): AxiosRequestConfig['adapter'] | undefined => {
    const getAdapter = (axios as any).getAdapter || (axios.defaults as any).getAdapter
    if (typeof getAdapter !== 'function') {
      return undefined
    }

    const adapter = getAdapter(candidate)
    if (adapter && typeof adapter === 'function') {
      return adapter
    }

    return undefined
  }

  // Strategy 1: Try dynamic import of the http adapter using require()
  // This works better in Electron's externalized dependencies environment
  try {
    // Use require() for better compatibility with externalized node_modules
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const httpAdapterPath = require.resolve('axios/lib/adapters/http.js')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const adapterModule = require(httpAdapterPath)
    if (adapterModule?.default || typeof adapterModule === 'function') {
      axiosHttpAdapter = adapterModule.default || adapterModule
      return axiosHttpAdapter
    }
  } catch (e) {
    console.warn('Failed to load axios http adapter via require:', e)
  }

  // Strategy 2: Try dynamic import of the http adapter (ES Module style)
  try {
    const adapterModule = await import('axios/lib/adapters/http.js')
    if (adapterModule?.default) {
      axiosHttpAdapter = adapterModule.default
      return axiosHttpAdapter
    }
  } catch {
    // Continue to next strategy
  }

  // Strategy 3: Try accessing via axios.defaults.adapter when it's http
  try {
    const defaultAdapter = axios.defaults.adapter
    if (defaultAdapter && typeof defaultAdapter === 'function') {
      axiosHttpAdapter = defaultAdapter as AxiosRequestConfig['adapter']
      return axiosHttpAdapter
    }

    // Axios v1 often stores adapter preference as an array like ['xhr', 'http', 'fetch'].
    // Resolve it through axios.getAdapter() so we can still obtain a callable adapter.
    const resolvedAdapter = resolveWithGetAdapter(defaultAdapter)
    if (resolvedAdapter) {
      axiosHttpAdapter = resolvedAdapter
      return axiosHttpAdapter
    }
  } catch {
    // Continue to next strategy
  }

  // Strategy 4: Try accessing internal adapters object
  try {
    const adapters = (axios as any).Axios?.prototype?.adapters || (axios as any).adapters
    if (adapters?.http) {
      axiosHttpAdapter = adapters.http
      return axiosHttpAdapter
    }
  } catch {
    // Continue to next strategy
  }

  // Strategy 5: Use axios's getAdapter function if available
  try {
    const adapter = resolveWithGetAdapter('http')
    if (adapter) {
      axiosHttpAdapter = adapter
      return axiosHttpAdapter
    }
  } catch {
    // Continue to fallback
  }

  throw new Error(
    'Axios HTTP adapter is unavailable. Please ensure the upload runs in the Electron main (Node) process.'
  )
}

// Verify Node.js environment by checking for http/https modules
function isNodeEnvironment(): boolean {
  return typeof http.request === 'function' && typeof https.request === 'function'
}

type HttpLikeTransport = {
  request: (...args: any[]) => ClientRequest
}

/**
 * Track bytes written on the underlying socket to reflect real HTTP upload progress.
 */
function attachSocketProgress(
  req: ClientRequest,
  uploadTotalBytes: number,
  reportProgress: (bytesTransferred: number, force?: boolean) => void,
  onServerResponse?: () => void
): void {
  req.on('socket', (socket) => {
    const initialBytesWritten = socket.bytesWritten
    let headerBytes = 0
    let cleaned = false

    const computeHeaderBytes = () => {
      if (headerBytes === 0 && (req as any)._header) {
        headerBytes = Buffer.byteLength((req as any)._header)
      }
      return headerBytes
    }

    const emitProgress = (force = false) => {
      if (cleaned) return
      const headerSize = computeHeaderBytes()
      const sentBodyBytes = Math.max(0, socket.bytesWritten - initialBytesWritten - headerSize)
      const boundedBytes = Math.min(uploadTotalBytes, sentBodyBytes)
      reportProgress(boundedBytes, force)
    }

    const interval = setInterval(() => emitProgress(false), 200)

    const cleanup = () => {
      if (cleaned) return
      cleaned = true
      clearInterval(interval)
      socket.removeListener('error', cleanup)
      req.removeListener('error', cleanup)
    }

    socket.on('error', cleanup)
    req.on('error', cleanup)

    req.on('finish', () => {
      emitProgress(true)
      cleanup()
    })
    req.on('response', () => {
      onServerResponse?.()
      emitProgress(true)
      cleanup()
    })
    req.on('close', () => {
      emitProgress(true)
      cleanup()
    })
  })
}

function createProgressTransport(
  baseTransport: HttpLikeTransport,
  uploadTotalBytes: number,
  reportProgress: (bytesTransferred: number, force?: boolean) => void,
  onServerResponse?: () => void
): HttpLikeTransport {
  return {
    request: (...args: any[]) => {
      const req = baseTransport.request(...args)
      attachSocketProgress(req, uploadTotalBytes, reportProgress, onServerResponse)
      return req
    }
  }
}

const logger = loggerService.withContext('HTTPService')

interface HTTPUploadOptions {
  onProgress?: (progress: HTTPUploadProgress) => void
  signal?: AbortSignal
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
   * @param options Upload options (progress, cancellation)
   * @returns Promise<boolean> True if successful
   */
  uploadFile(
    filePath: string,
    packageInfo: Package,
    httpConfig: HTTPConfig,
    options?: HTTPUploadOptions
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
    options?: HTTPUploadOptions
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

      // axios with node form-data
      const formData = new FormData()
      ;(formData as any).maxDataSize = Number.MAX_SAFE_INTEGER

      // Append file stream directly; progress will be tracked closer to the socket below
      formData.append('file', fs.createReadStream(filePath, { highWaterMark: 64 * 1024 }), {
        filename: fileName,
        knownLength: totalBytes
      })
      formData.append('packageInfo', packageInfoJson)

      // Pre-compute Content-Length for better proxy compatibility
      let contentLength: number | null = null
      if (typeof (formData as any).getLength === 'function') {
        try {
          contentLength = await new Promise<number>((resolve, reject) => {
            ;(formData as any).getLength((err: Error | null, length: number) =>
              err ? reject(err) : resolve(length)
            )
          })
        } catch (err) {
          console.warn('WARNING: unable to compute Content-Length, falling back to chunked upload:', (err as Error).message || err)
          contentLength = null
        }
      }

      // Total bytes to send (use Content-Length when available so boundary bytes are included)
      const uploadTotalBytes = contentLength ?? totalBytes

      // Progress tracking state - based on bytes written to the underlying socket
      let lastReportedBytes = 0
      let lastReportTime = Date.now()
      let serverResponded = false

      const reportProgress = (bytesTransferred: number, force = false) => {
        if (!options?.onProgress) return
        const now = Date.now()
        const elapsedMs = now - lastReportTime
        // Report at most every 100ms for smoother updates, unless forced or complete
        if (!force && elapsedMs < 100 && bytesTransferred < uploadTotalBytes) {
          return
        }
        const deltaBytes = bytesTransferred - lastReportedBytes
        // Skip redundant logs when nothing has changed unless this is a forced flush
        if (!force && deltaBytes === 0) {
          return
        }
        const speedBytesPerSecond =
          elapsedMs > 0 ? deltaBytes / (elapsedMs / 1000) : deltaBytes === 0 ? 0 : deltaBytes

        const percentage =
          uploadTotalBytes > 0
            ? Math.min(
                100,
                // Hold at 99% until the server actually responds to avoid premature "completion" feedback
                serverResponded
                  ? Math.round((bytesTransferred / uploadTotalBytes) * 100)
                  : Math.min(99, Math.round((bytesTransferred / uploadTotalBytes) * 100))
              )
            : 0

        logger.debug(
          `[UploadProgress] bytesTransferred: ${bytesTransferred}, totalBytes: ${uploadTotalBytes}, percentage: ${percentage}%, deltaBytes: ${deltaBytes}, elapsedMs: ${elapsedMs}, speedBytesPerSecond: ${speedBytesPerSecond}`
        )

        lastReportedBytes = bytesTransferred
        lastReportTime = now

        options.onProgress({
          bytesTransferred,
          totalBytes: uploadTotalBytes,
          percentage,
          speedBytesPerSecond
        })
      }

      // Emit initial progress after tracker is ready
      reportProgress(0, true)

      // Prepare request configuration
      // Force the Node.js HTTP adapter explicitly with a direct reference to avoid
      // axios falling back to the Fetch adapter in Electron environments where
      // process detection can mark the HTTP adapter as "not supported".
      if (!isNodeEnvironment()) {
        throw new Error(
          'HTTP upload must run in the Electron main (Node) process, not in the renderer process.'
        )
      }

      const httpAdapter = await getHttpAdapter()
      const url = new URL(httpConfig.url)
      const isHttps = url.protocol === 'https:'
      const baseTransport = isHttps ? followHttps : followHttp
      const markServerResponse = () => {
        serverResponded = true
      }
      const progressTransport =
        options?.onProgress && uploadTotalBytes > 0
          ? createProgressTransport(
              baseTransport,
              uploadTotalBytes,
              (bytes, force) => reportProgress(bytes, force),
              markServerResponse
            )
          : undefined

      const requestConfig: AxiosRequestConfig = {
        // Use the concrete Node adapter function to bypass axios environment checks.
        adapter: httpAdapter,
        ...(progressTransport ? { transport: progressTransport } : {}),
        method: httpConfig.method,
        url: httpConfig.url,
        data: formData,
        headers: {
          ...userHeaders,
          ...formData.getHeaders(),
          ...(contentLength !== null && Number.isFinite(contentLength) ? { 'Content-Length': contentLength } : {})
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 0, // disable timeout per requirement
        signal: options?.signal
        // Progress is tracked via a custom transport that samples socket.bytesWritten,
        // giving us real HTTP egress progress instead of local file read progress.
      }

      // Add authentication if provided
      if (httpConfig.authentication) {
        this.addAuthentication(requestConfig, httpConfig.authentication)
      }

      logger.debug(`请求头信息: ${JSON.stringify(requestConfig.headers, null, 2)}`)
      logger.debug('=== 开始发送HTTP请求 ===')

      // Make the HTTP request
      const response: AxiosResponse = await axios(requestConfig)

      // Ensure final progress is reported when upload completes
      markServerResponse()
      reportProgress(uploadTotalBytes, true)

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
      const isCanceled =
        (axios as any).isCancel?.(error) ||
        (axios.isAxiosError(error) && error.code === 'ERR_CANCELED') ||
        (error as any)?.code === 'ERR_CANCELED' ||
        (error as any)?.name === 'AbortError' ||
        (error as any)?.canceled === true

      if (isCanceled) {
        logger.info('HTTP upload cancelled by user')
        const abortError = new Error('Upload cancelled by user')
        ;(abortError as any).name = 'AbortError'
        throw abortError
      }

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
