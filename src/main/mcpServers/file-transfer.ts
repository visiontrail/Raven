/**
 * File Transfer MCP Server
 *
 * 提供文件传输功能的 MCP 服务器，包括：
 * 1. HTTP GET 下载文件到本地固定路径
 * 2. FTP 上传文件到指定远程路径
 */

import { loggerService } from '@logger'
import { ftpService } from '@main/services/FTPService'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js'
import { app, net } from 'electron'
import * as fs from 'fs-extra'
import * as path from 'path'

const logger = loggerService.withContext('MCPServer:FileTransfer')

/**
 * FTP 上传路径类型枚举
 */
enum FTPUploadPathType {
  /** 升级包路径 */
  UPGRADE_PACKAGE = 'upgrade_package'
}

/**
 * FTP 配置（固化在代码中）
 */
const FTP_CONFIG = {
  host: '10.60.11.3', // temp for test
  port: 10002,
  username: 'anonymous',
  password: 'anonymous'
}

/**
 * FTP 上传路径映射
 */
const FTP_UPLOAD_PATHS: Record<FTPUploadPathType, string> = {
  [FTPUploadPathType.UPGRADE_PACKAGE]: '/firmware'
}

/**
 * 获取本地下载目录
 */
function getDownloadDirectory(): string {
  const userDataPath = app.getPath('userData')
  const downloadPath = path.join(userDataPath, 'downloads')
  fs.ensureDirSync(downloadPath)
  return downloadPath
}

/**
 * 从 URL 中提取文件名
 */
function extractFileNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const fileName = path.basename(pathname)
    return fileName || `download_${Date.now()}`
  } catch {
    return `download_${Date.now()}`
  }
}

/**
 * 从 Content-Disposition header 中提取文件名
 */
function extractFileNameFromContentDisposition(contentDisposition: string): string | null {
  try {
    // 匹配 filename="xxx" 或 filename='xxx' 或 filename=xxx
    const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i
    const matches = filenameRegex.exec(contentDisposition)

    if (matches && matches[1]) {
      let filename = matches[1].trim()
      // 移除引号
      filename = filename.replace(/^["']|["']$/g, '')
      // 处理 filename*=UTF-8''encoded_filename 格式
      if (filename.startsWith("UTF-8''")) {
        filename = decodeURIComponent(filename.substring(7))
      } else {
        // 尝试解码 URL 编码
        filename = decodeURIComponent(filename)
      }
      return filename
    }

    // 尝试匹配 filename*=UTF-8''xxx 格式
    const filenameStarRegex = /filename\*=UTF-8''([^;\n]*)/i
    const starMatches = filenameStarRegex.exec(contentDisposition)
    if (starMatches && starMatches[1]) {
      return decodeURIComponent(starMatches[1].trim())
    }

    return null
  } catch (error) {
    logger.warn(`解析 Content-Disposition 失败: ${error}`)
    return null
  }
}

/**
 * HTTP 下载文件
 */
async function httpDownloadFile(url: string, customFileName?: string): Promise<{ filePath: string; fileName: string }> {
  const downloadDir = getDownloadDirectory()

  logger.info(`开始从 ${url} 下载文件`)

  try {
    const response = await net.fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP 下载失败，状态码: ${response.status} ${response.statusText}`)
    }

    // 确定文件名优先级：自定义文件名 > Content-Disposition > URL 提取
    let fileName = customFileName
    if (!fileName) {
      const contentDisposition = response.headers.get('content-disposition')
      if (contentDisposition) {
        const extractedFileName = extractFileNameFromContentDisposition(contentDisposition)
        if (extractedFileName) {
          fileName = extractedFileName
          logger.info(`从 Content-Disposition 提取文件名: ${fileName}`)
        }
      }
    }
    if (!fileName) {
      fileName = extractFileNameFromUrl(url)
      logger.info(`从 URL 提取文件名: ${fileName}`)
    }

    const filePath = path.join(downloadDir, fileName)
    logger.info(`保存文件到: ${filePath}`)

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    await fs.writeFile(filePath, buffer)

    logger.info(`文件下载成功: ${filePath}，大小: ${buffer.length} 字节`)

    return { filePath, fileName }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(`HTTP 下载失败: ${errorMessage}`)
    throw new Error(`HTTP 下载失败: ${errorMessage}`)
  }
}

/**
 * FTP 上传文件
 */
async function ftpUploadFile(
  localFilePath: string,
  pathType: FTPUploadPathType
): Promise<{ success: boolean; remotePath: string }> {
  if (!(await fs.pathExists(localFilePath))) {
    throw new Error(`本地文件不存在: ${localFilePath}`)
  }

  const remoteDir = FTP_UPLOAD_PATHS[pathType]
  if (!remoteDir) {
    throw new Error(`未知的上传路径类型: ${pathType}`)
  }

  const fileName = path.basename(localFilePath)
  const remotePath = path.posix.join(remoteDir, fileName)

  logger.info(`开始上传文件 ${localFilePath} 到 FTP 服务器 ${FTP_CONFIG.host}:${remotePath}`)

  try {
    const success = await ftpService.uploadFile(localFilePath, {
      ...FTP_CONFIG,
      remotePath
    })

    if (success) {
      logger.info(`文件上传成功: ${remotePath}`)
      return { success: true, remotePath }
    } else {
      throw new Error('FTP 上传返回失败')
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(`FTP 上传失败: ${errorMessage}`)
    throw new Error(`FTP 上传失败: ${errorMessage}`)
  }
}

/**
 * File Transfer MCP Server 类
 */
class FileTransferServer {
  public server: Server

  constructor() {
    this.server = new Server(
      {
        name: 'file-transfer-server',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    )

    this.setupRequestHandlers()
  }

  private setupRequestHandlers() {
    // 列出可用工具
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'http_download_file',
            description: '通过 HTTP GET 方法下载文件到本地固定路径。无需用户名密码，返回下载后的本地文件路径和文件名。',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: '要下载的文件的 HTTP URL 地址'
                },
                fileName: {
                  type: 'string',
                  description: '可选的自定义文件名，如不提供则从 URL 中提取'
                }
              },
              required: ['url']
            }
          },
          {
            name: 'ftp_upload_file',
            description:
              '通过 FTP 上传本地文件到远程服务器。用户名密码已固化在代码中。目前支持的路径类型：upgrade_package（升级包路径）。',
            inputSchema: {
              type: 'object',
              properties: {
                localFilePath: {
                  type: 'string',
                  description: '要上传的本地文件的完整路径'
                },
                pathType: {
                  type: 'string',
                  enum: Object.values(FTPUploadPathType),
                  description: '上传路径类型，目前支持: upgrade_package（升级包路径）',
                  default: FTPUploadPathType.UPGRADE_PACKAGE
                }
              },
              required: ['localFilePath']
            }
          },
          {
            name: 'download_and_upload_file',
            description:
              '组合操作：先通过 HTTP 下载文件到本地，然后通过 FTP 上传到远程服务器。适用于需要从 HTTP 源下载文件并上传到 FTP 服务器的场景（如升级包部署）。',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: '要下载的文件的 HTTP URL 地址'
                },
                fileName: {
                  type: 'string',
                  description: '可选的自定义文件名，如不提供则从 URL 中提取'
                },
                pathType: {
                  type: 'string',
                  enum: Object.values(FTPUploadPathType),
                  description: '上传路径类型，目前支持: upgrade_package（升级包路径）',
                  default: FTPUploadPathType.UPGRADE_PACKAGE
                }
              },
              required: ['url']
            }
          }
        ]
      }
    })

    // 处理工具调用
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params

      try {
        switch (name) {
          case 'http_download_file': {
            const { url, fileName } = args as { url: string; fileName?: string }

            if (!url || typeof url !== 'string') {
              throw new McpError(ErrorCode.InvalidParams, 'url 参数必须是有效的字符串')
            }

            const result = await httpDownloadFile(url, fileName)

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    message: '文件下载成功',
                    filePath: result.filePath,
                    fileName: result.fileName
                  })
                }
              ]
            }
          }

          case 'ftp_upload_file': {
            const { localFilePath, pathType = FTPUploadPathType.UPGRADE_PACKAGE } = args as {
              localFilePath: string
              pathType?: FTPUploadPathType
            }

            if (!localFilePath || typeof localFilePath !== 'string') {
              throw new McpError(ErrorCode.InvalidParams, 'localFilePath 参数必须是有效的字符串')
            }

            const result = await ftpUploadFile(localFilePath, pathType as FTPUploadPathType)

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: result.success,
                    message: 'FTP 上传成功',
                    remotePath: result.remotePath,
                    ftpHost: FTP_CONFIG.host
                  })
                }
              ]
            }
          }

          case 'download_and_upload_file': {
            const {
              url,
              fileName,
              pathType = FTPUploadPathType.UPGRADE_PACKAGE
            } = args as {
              url: string
              fileName?: string
              pathType?: FTPUploadPathType
            }

            if (!url || typeof url !== 'string') {
              throw new McpError(ErrorCode.InvalidParams, 'url 参数必须是有效的字符串')
            }

            // 第一步：下载文件
            logger.info('开始执行下载并上传操作...')
            const downloadResult = await httpDownloadFile(url, fileName)

            // 第二步：上传文件
            const uploadResult = await ftpUploadFile(downloadResult.filePath, pathType as FTPUploadPathType)

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    message: '文件下载并上传成功',
                    download: {
                      localFilePath: downloadResult.filePath,
                      fileName: downloadResult.fileName
                    },
                    upload: {
                      remotePath: uploadResult.remotePath,
                      ftpHost: FTP_CONFIG.host
                    }
                  })
                }
              ]
            }
          }

          default:
            throw new McpError(ErrorCode.MethodNotFound, `工具 ${name} 不存在`)
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error
        }

        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error(`工具调用失败: ${errorMessage}`)
        throw new McpError(ErrorCode.InternalError, errorMessage)
      }
    })
  }
}

export default FileTransferServer
