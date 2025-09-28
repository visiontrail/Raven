import { exec } from 'node:child_process'
import { promisify } from 'node:util'

import { loggerService } from '@logger'
import type { MCPServer } from '@types'

const execAsync = promisify(exec)
const logger = loggerService.withContext('TimeSyncService')

export type SSHCredentials = {
  host: string
  port?: number
  username?: string
  password?: string
  privateKeyPath?: string
  useSudo?: boolean
}

/**
 * Simple SSH-based time synchronization utility using system ssh/sshpass.
 * - Supports password (via sshpass) or key/agent auth.
 * - Tries timedatectl first, then falls back to date, then writes hwclock if available.
 */
class TimeSyncService {
  private syncedHosts: Set<string> = new Set()

  /** one-shot sync with basic de-duplication per run */
  public async syncHostTime(credentials: SSHCredentials): Promise<void> {
    const logData = {
      host: credentials.host,
      port: credentials.port || 22,
      username: credentials.username || 'root',
      hasPassword: !!credentials.password,
      hasPrivateKey: !!credentials.privateKeyPath,
      useSudo: credentials.useSudo !== false
    }
    logger.info('[TimeSync] Enter syncHostTime', logData)
    console.log('[TimeSync] Enter syncHostTime', logData)
    const hostKey = `${credentials.username || 'auto'}@${credentials.host}:${credentials.port || 22}`
    if (this.syncedHosts.has(hostKey)) {
      logger.debug(`Skip time sync, already synced in this session: ${hostKey}`)
      console.log(`[TimeSync] Skip time sync, already synced in this session: ${hostKey}`)
      return
    }

    try {
      const local = new Date()
      // Format as YYYY-MM-DD HH:MM:SS (24h)
      const yyyy = local.getFullYear()
      const mm = `${local.getMonth() + 1}`.padStart(2, '0')
      const dd = `${local.getDate()}`.padStart(2, '0')
      const HH = `${local.getHours()}`.padStart(2, '0')
      const MM = `${local.getMinutes()}`.padStart(2, '0')
      const SS = `${local.getSeconds()}`.padStart(2, '0')
      const dateString = `${yyyy}-${mm}-${dd} ${HH}:${MM}:${SS}`

      const useSudo = credentials.useSudo !== false // default true
      const timeData = {
        dateString,
        epochSeconds: Math.floor(local.getTime() / 1000)
      }
      logger.debug('[TimeSync] Computed local time string', timeData)
      console.log('[TimeSync] Computed local time string', timeData)

      // Remote command tries:
      // 1) timedatectl set-ntp false; timedatectl set-time 'YYYY-MM-DD HH:MM:SS'
      // 2) date -s 'YYYY-MM-DD HH:MM:SS'
      // 3) hwclock -w if available
      const remoteScript = [
        'set -e',
        'if command -v timedatectl >/dev/null 2>&1; then',
        `${useSudo ? 'sudo -n ' : ''}timedatectl set-ntp false || true`,
        `${useSudo ? 'sudo -n ' : ''}timedatectl set-time '${dateString}' || true`,
        'else',
        `${useSudo ? 'sudo -n ' : ''}date -s '${dateString}'`,
        'fi',
        'if command -v hwclock >/dev/null 2>&1; then',
        `${useSudo ? 'sudo -n ' : ''}hwclock -w || true`,
        'fi'
      ].join('; ')

      const sshArgs: string[] = ['-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null']
      if (credentials.port) {
        sshArgs.push('-p', String(credentials.port))
      }
      if (credentials.privateKeyPath) {
        sshArgs.push('-i', credentials.privateKeyPath)
      }
      const targetUser = credentials.username ? `${credentials.username}@${credentials.host}` : credentials.host
      const sshData = {
        targetUser,
        sshArgs,
        transport: credentials.password ? 'sshpass+ssh' : 'ssh'
      }
      logger.debug('[TimeSync] SSH invocation prepared', sshData)
      console.log('[TimeSync] SSH invocation prepared', sshData)

      let command = ''
      if (credentials.password) {
        // Requires sshpass installed on host running this app
        command = `sshpass -p '${credentials.password.replace(/'/g, "'\\''")}' ssh ${sshArgs.join(' ')} ${targetUser} '${remoteScript.replace(/'/g, "'\\''")}'`
      } else {
        command = `ssh ${sshArgs.join(' ')} ${targetUser} '${remoteScript.replace(/'/g, "'\\''")}'`
      }

      logger.info(`Sync time via SSH to ${targetUser}`)
      console.log(`[TimeSync] Sync time via SSH to ${targetUser}`)
      const { stdout, stderr } = await execAsync(command, { timeout: 20_000, maxBuffer: 10 * 1024 * 1024 })
      if (stdout) {
        logger.debug(`[SSH][stdout] ${stdout}`)
        console.log(`[TimeSync][SSH][stdout] ${stdout}`)
      }
      if (stderr) {
        logger.debug(`[SSH][stderr] ${stderr}`)
        console.log(`[TimeSync][SSH][stderr] ${stderr}`)
      }
      this.syncedHosts.add(hostKey)
      logger.info(`Time sync success for ${targetUser}`)
      console.log(`[TimeSync] Time sync success for ${targetUser}`)
    } catch (error) {
      logger.warn('Time sync failed:', error as Error)
      console.error('[TimeSync] Time sync failed:', error)
    }
  }

  /** Pull credentials from MCPServer.env/process.env and perform sync when baseUrl host matches */
  public async syncIfTarget(server: MCPServer, targetHost: string) {
    try {
      const syncData = {
        serverName: server.name,
        baseUrl: server.baseUrl,
        targetHost
      }
      logger.info('[TimeSync] Enter syncIfTarget', syncData)
      console.log('[TimeSync] Enter syncIfTarget', syncData)
      const host = this.extractHost(server)
      logger.debug('[TimeSync] Extracted host', { host })
      console.log('[TimeSync] Extracted host', { host })
      if (!host) {
        logger.info('[TimeSync] No host extracted; skip time sync')
        console.log('[TimeSync] No host extracted; skip time sync')
        return
      }
      if (host !== targetHost) {
        logger.info('[TimeSync] Host does not match target; skip time sync', { host, targetHost })
        console.log('[TimeSync] Host does not match target; skip time sync', { host, targetHost })
        return
      }

      const env = server.env || {}
      const username = env.SSH_USERNAME || process.env.SSH_USERNAME || 'root'
      const password = env.SSH_PASSWORD || process.env.SSH_PASSWORD || 'root'
      const privateKeyPath = env.SSH_PRIVATE_KEY || process.env.SSH_PRIVATE_KEY
      const port = env.SSH_PORT ? Number(env.SSH_PORT) : process.env.SSH_PORT ? Number(process.env.SSH_PORT) : 22
      const useSudo = env.SSH_USE_SUDO
        ? env.SSH_USE_SUDO === 'true'
        : process.env.SSH_USE_SUDO
          ? process.env.SSH_USE_SUDO === 'true'
          : true
      const credentialsData = {
        host,
        port,
        username,
        hasPassword: !!password,
        hasPrivateKey: !!privateKeyPath,
        useSudo
      }
      logger.info('[TimeSync] Resolved SSH credentials (sanitized)', credentialsData)
      console.log('[TimeSync] Resolved SSH credentials (sanitized)', credentialsData)

      await this.syncHostTime({ host, port, username, password, privateKeyPath, useSudo })
    } catch (e) {
      logger.warn('syncIfTarget error:', e as Error)
      console.error('[TimeSync] syncIfTarget error:', e)
    }
  }

  private extractHost(server: MCPServer): string | null {
    if (server.baseUrl) {
      try {
        const url = new URL(server.baseUrl)
        return url.hostname
      } catch (_) {
        // Not a valid URL, fallback plain compare
        if (server.baseUrl.includes('172.')) return server.baseUrl
      }
    }
    const fromEnv = server.env?.MCP_HOST || process.env.MCP_HOST
    return fromEnv || null
  }
}

export default new TimeSyncService()
