import { loggerService } from '@logger'
import store from '@renderer/store'
import { getSatelliteGnbOamIP } from '@renderer/store/mcp'
import { MCPServer } from '@renderer/types'

const logger = loggerService.withContext('IPAddressService')

/**
 * IP地址获取服务
 * 负责从MCP配置中动态获取IP地址，并提供容错机制和自动更新功能
 */
class IPAddressService {
  private static instance: IPAddressService
  private currentIP: string = '172.77.245.1' // 默认IP地址
  private readonly defaultIP: string = '172.77.245.1'
  private listeners: Set<(ip: string) => void> = new Set()
  private isInitialized: boolean = false

  private constructor() {
    this.initialize()
  }

  /**
   * 获取服务实例（单例模式）
   */
  public static getInstance(): IPAddressService {
    if (!IPAddressService.instance) {
      IPAddressService.instance = new IPAddressService()
    }
    return IPAddressService.instance
  }

  /**
   * 设置IPC监听器，响应main进程的IP请求
   */
  private setupIPCListener(): void {
    if (typeof window !== 'undefined' && window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.on('mcp:request-satellite-ip', () => {
        const currentIP = this.getCurrentIP()
        window.electron.ipcRenderer.send('mcp:satellite-ip-response', currentIP)
      })
    }
  }

  /**
   * 从MCP配置更新IP地址
   */
  private updateIPFromMCPConfig(): void {
    try {
      const state = store.getState()
      const mcpServers: MCPServer[] = state.mcp?.servers || []

      const newIP = getSatelliteGnbOamIP(mcpServers, this.defaultIP)

      if (newIP !== this.currentIP) {
        const oldIP = this.currentIP
        this.currentIP = newIP
        logger.info(`IP地址已更新: ${oldIP} -> ${newIP}`)

        // 通知所有监听器
        this.notifyListeners(newIP)
      }
    } catch (error) {
      logger.error('更新IP地址时发生错误:', error as Error)
      // 发生错误时使用默认IP
      if (this.currentIP !== this.defaultIP) {
        this.currentIP = this.defaultIP
        this.notifyListeners(this.defaultIP)
      }
    }
  }

  /**
   * 公共初始化方法（确保服务已初始化）
   */
  public initialize(): void {
    if (!this.isInitialized) {
      try {
        logger.info('初始化IP地址服务')

        // 初始化时获取IP地址
        this.updateIPFromMCPConfig()

        // 监听Redux store的变化
        store.subscribe(() => {
          this.updateIPFromMCPConfig()
        })

        // 设置IPC监听器
        this.setupIPCListener()

        this.isInitialized = true
        logger.info('IP地址服务初始化完成')
      } catch (error) {
        logger.error('IP地址服务初始化失败:', error as Error)
        this.currentIP = this.defaultIP
        this.isInitialized = true // 即使失败也标记为已初始化，使用默认IP
      }
    }
  }

  /**
   * 获取当前IP地址
   * @returns 当前IP地址
   */
  public getCurrentIP(): string {
    if (!this.isInitialized) {
      this.updateIPFromMCPConfig()
    }
    return this.currentIP
  }

  /**
   * 获取默认IP地址
   * @returns 默认IP地址
   */
  public getDefaultIP(): string {
    return this.defaultIP
  }

  /**
   * 添加IP地址变更监听器
   * @param listener 监听器函数
   */
  public addIPChangeListener(listener: (ip: string) => void): void {
    this.listeners.add(listener)
    logger.debug(`添加IP变更监听器，当前监听器数量: ${this.listeners.size}`)
  }

  /**
   * 移除IP地址变更监听器
   * @param listener 监听器函数
   */
  public removeIPChangeListener(listener: (ip: string) => void): void {
    this.listeners.delete(listener)
    logger.debug(`移除IP变更监听器，当前监听器数量: ${this.listeners.size}`)
  }

  /**
   * 通知所有监听器IP地址已变更
   * @param newIP 新的IP地址
   */
  private notifyListeners(newIP: string): void {
    this.listeners.forEach((listener) => {
      try {
        listener(newIP)
      } catch (error) {
        logger.error('通知IP变更监听器时发生错误:', error as Error)
      }
    })
  }

  /**
   * 手动刷新IP地址
   * 强制从MCP配置重新获取IP地址
   */
  public refreshIP(): void {
    logger.info('手动刷新IP地址')
    this.updateIPFromMCPConfig()
  }

  /**
   * 获取FTP配置对象
   * @param port FTP端口，默认为10002
   * @param username FTP用户名，默认为'anonymous'
   * @param password FTP密码，默认为'anonymous'
   * @param remotePath FTP远程路径，默认为'/firmware'
   * @returns FTP配置对象
   */
  public getFTPConfig(
    port: number = 10002,
    username: string = 'anonymous',
    password: string = 'anonymous',
    remotePath: string = '/firmware'
  ) {
    return {
      host: this.getCurrentIP(),
      port,
      username,
      password,
      remotePath
    }
  }

  /**
   * 检查服务是否已初始化
   * @returns 是否已初始化
   */
  public isServiceInitialized(): boolean {
    return this.isInitialized
  }
}

// 导出服务实例
export const ipAddressService = IPAddressService.getInstance()
export default IPAddressService
