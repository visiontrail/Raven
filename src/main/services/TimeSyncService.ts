import { exec } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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

  /** one-shot sync with basic de-duplication per run. returns true on success */
  public async syncHostTime(credentials: SSHCredentials): Promise<boolean> {
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
      return true
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
      let tempScriptPath: string | null = null

      try {
        if (credentials.password) {
          if (process.platform === 'win32') {
            // On Windows, prefer PuTTY plink with -pw to support password auth
            try {
              await execAsync('plink -V', { timeout: 5_000 })
            } catch {
              logger.warn(
                '[TimeSync] plink.exe not found on Windows. Please install PuTTY and ensure plink is in PATH, or switch to key-based auth.'
              )
              console.warn(
                '[TimeSync] plink.exe not found on Windows. Please install PuTTY and ensure plink is in PATH, or switch to key-based auth.'
              )
              return false
            }

            // Write remote script to a temp file to avoid complex cmd quoting
            tempScriptPath = join(tmpdir(), `raven-timesync-${Date.now()}.sh`)
            await fs.writeFile(tempScriptPath, `${remoteScript}\n`, { encoding: 'utf8' })

            const port = credentials.port || 22
            const username = credentials.username || 'root'
            const host = credentials.host
            const password = credentials.password

            // Accept unknown host key automatically (similar to StrictHostKeyChecking=no)
            // Pipe a single 'y' to plink if host key not cached; -batch keeps it non-interactive otherwise
            command = `echo y | plink -ssh -batch -P ${port} -l ${username} -pw "${password.replace(/"/g, '\\"')}" ${host} -m "${tempScriptPath}"`

            // Ensure UTF-8 code page to avoid garbled Chinese output
            command = `chcp 65001>nul & ${command}`
          } else {
            // Non-Windows: use sshpass if available
            try {
              await execAsync('sshpass -V', { timeout: 5_000 })
            } catch {
              logger.warn('[TimeSync] sshpass not found. Install sshpass or use key-based auth.')
              console.warn('[TimeSync] sshpass not found. Install sshpass or use key-based auth.')
              return false
            }
            command = `sshpass -p '${credentials.password.replace(/'/g, "'\\''")}' ssh ${sshArgs.join(' ')} ${targetUser} '${remoteScript.replace(/'/g, "'\\''")}'`
          }
        } else {
          // Key/agent based auth
          command = `ssh ${sshArgs.join(' ')} ${targetUser} '${remoteScript.replace(/'/g, "'\\''")}'`
          if (process.platform === 'win32') {
            command = `chcp 65001>nul & ${command}`
          }
        }

        logger.info(`Sync time via SSH to ${targetUser}`)
        console.log(`[TimeSync] Sync time via SSH to ${targetUser}`)

        const { stdout, stderr } = await execAsync(command, {
          timeout: 20_000,
          maxBuffer: 10 * 1024 * 1024
        })
        if (stdout) {
          logger.debug(`[SSH][stdout] ${stdout}`)
          console.log(`[TimeSync][SSH][stdout] ${stdout}`)
        }
        if (stderr) {
          logger.debug(`[SSH][stderr] ${stderr}`)
          console.log(`[TimeSync][SSH][stderr] ${stderr}`)
        }
      } finally {
        if (tempScriptPath) {
          try {
            await fs.unlink(tempScriptPath)
          } catch {
            // ignore
          }
        }
      }
      this.syncedHosts.add(hostKey)
      logger.info(`Time sync success for ${targetUser}`)
      console.log(`[TimeSync] Time sync success for ${targetUser}`)
      return true
    } catch (error) {
      logger.warn('Time sync failed:', error as Error)
      console.error('[TimeSync] Time sync failed:', error)
      return false
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

      const sshSuccess = await this.syncHostTime({ host, port, username, password, privateKeyPath, useSudo })
      if (!sshSuccess) {
        // Fallback: POST /sync_time to MCP HTTP server if available
        if (!server.baseUrl) {
          logger.warn('[TimeSync] SSH failed and no baseUrl available for HTTP fallback; skip')
          console.warn('[TimeSync] SSH failed and no baseUrl available for HTTP fallback; skip')
          return
        }
        const base = server.baseUrl.replace(/\/$/, '')
        const endpoint = `${base}/sync_time`
        const now = new Date()
        const epochSeconds = Math.floor(now.getTime() / 1000)
        const payload = {
          timestamp: epochSeconds,
          format: 'unix',
          timezone: 'UTC'
        }
        logger.info('[TimeSync] Attempt HTTP fallback to /sync_time', { endpoint, payload })
        console.log('[TimeSync] Attempt HTTP fallback to /sync_time', { endpoint, payload })

        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        }
        if ((server as any).headers) {
          Object.assign(headers, (server as any).headers)
        }

        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 10_000)
        try {
          const resp = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: controller.signal
          })
          clearTimeout(timer)
          const text = await resp.text()
          let json: any = null
          try {
            json = JSON.parse(text)
          } catch {
            // response not JSON; keep raw text
          }
          if (resp.ok) {
            logger.info('[TimeSync] HTTP fallback success', { status: resp.status, body: json ?? text })
            console.log('[TimeSync] HTTP fallback success', { status: resp.status, body: json ?? text })
            const hostKey = `${username}@${host}:${port}`
            this.syncedHosts.add(hostKey)
          } else {
            logger.warn('[TimeSync] HTTP fallback failed', { status: resp.status, body: json ?? text })
            console.warn('[TimeSync] HTTP fallback failed', { status: resp.status, body: json ?? text })
          }
        } catch (err) {
          logger.warn('[TimeSync] HTTP fallback error', err as Error)
          console.warn('[TimeSync] HTTP fallback error', err)
        }
      }
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
