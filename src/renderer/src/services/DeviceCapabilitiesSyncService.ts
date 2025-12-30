import { loggerService } from '@logger'
import type {
  DeviceCapabilities,
  McpPromptCapability,
  McpResourceCapability,
  McpServerCapability,
  McpToolCapability,
  McpToolParameter
} from '@main/services/DeviceLinkContract'
import type { MCPPrompt, MCPResource, MCPServer, MCPTool } from '@renderer/types'
import store from '@renderer/store'

const logger = loggerService.withContext('DeviceCapabilitiesSync')

class DeviceCapabilitiesSyncService {
  private unsubscribe?: () => void
  private syncing = false
  private scheduled = false
  private lastFingerprint = ''

  start() {
    if (!window?.api?.deviceLink?.updateCapabilities) {
      logger.warn('Device capabilities sync skipped: deviceLink API unavailable')
      return
    }

    this.lastFingerprint = this.computeFingerprint()
    this.scheduleSync()
    this.unsubscribe = store.subscribe(() => {
      const nextFingerprint = this.computeFingerprint()
      if (nextFingerprint !== this.lastFingerprint) {
        this.lastFingerprint = nextFingerprint
        this.scheduleSync()
      }
    })
    logger.info('Device capabilities sync service started')
  }

  stop() {
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = undefined
      logger.info('Device capabilities sync service stopped')
    }
  }

  private computeFingerprint(): string {
    const servers = store.getState().mcp?.servers || []
    const activeServers = servers.filter((server) => server.isActive)
    const minimal = activeServers.map((server) => ({
      id: server.id,
      name: server.name,
      baseUrl: server.baseUrl,
      type: server.type,
      disabledTools: server.disabledTools,
      disabledAutoApproveTools: server.disabledAutoApproveTools
    }))
    return JSON.stringify(minimal)
  }

  private scheduleSync() {
    if (this.scheduled) {
      return
    }
    this.scheduled = true
    setTimeout(() => {
      this.scheduled = false
      this.sync().catch((error) => logger.error('Failed to sync device capabilities', error as Error))
    }, 600)
  }

  private async sync() {
    if (this.syncing) return
    this.syncing = true
    try {
      const capabilities = await this.collectCapabilities()
      if (!capabilities) {
        return
      }
      await window.api.deviceLink.updateCapabilities(capabilities)
      logger.info('Device capabilities pushed to main process', {
        mcpServers: capabilities.mcp?.servers?.length || 0
      })
    } catch (error) {
      logger.error('Collecting or sending device capabilities failed', error as Error)
    } finally {
      this.syncing = false
    }
  }

  private async collectCapabilities(): Promise<DeviceCapabilities | null> {
    if (!window?.api?.mcp) {
      logger.warn('Cannot collect MCP capabilities: mcp API not available on window.api')
      return null
    }

    const servers = store.getState().mcp?.servers || []
    const activeServers = servers.filter((server) => server.isActive)
    const payload: McpServerCapability[] = []

    for (const server of activeServers) {
      const serverPayload = await this.collectServerCapabilities(server)
      if (serverPayload) {
        payload.push(serverPayload)
      }
    }

    return {
      mcp: {
        servers: payload,
        collectedAt: new Date().toISOString()
      }
    }
  }

  private async collectServerCapabilities(server: MCPServer): Promise<McpServerCapability | null> {
    try {
      const [tools, prompts, resources] = await Promise.all([
        this.listTools(server),
        this.listPrompts(server),
        this.listResources(server)
      ])

      return {
        id: server.id,
        name: server.name,
        provider: server.provider,
        type: server.type,
        baseUrl: server.baseUrl,
        description: server.description,
        tools,
        prompts,
        resources
      }
    } catch (error) {
      logger.warn('Failed to collect capabilities for server', { server: server.name, error })
      return null
    }
  }

  private async listTools(server: MCPServer): Promise<McpToolCapability[]> {
    const disabledTools = new Set(server.disabledTools || [])
    const tools: MCPTool[] = await window.api.mcp
      .listTools(server)
      .catch((error: Error) => {
        logger.warn(`Failed to list tools for MCP server ${server.name}`, error)
        return []
      })
      .then((result: MCPTool[]) => result || [])

    return tools
      .filter((tool) => !disabledTools.has(tool.name))
      .map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema,
        output_schema: tool.outputSchema,
        parameters: this.extractToolParameters(tool.inputSchema)
      }))
  }

  private extractToolParameters(inputSchema?: MCPTool['inputSchema']): McpToolParameter[] {
    if (!inputSchema || typeof inputSchema !== 'object') {
      return []
    }

    const properties = inputSchema.properties
    if (!properties || typeof properties !== 'object') {
      return []
    }

    const requiredSet = new Set<string>(Array.isArray(inputSchema.required) ? inputSchema.required : [])

    return Object.entries(properties).map(([name, schema]) => {
      const isObject = schema !== null && typeof schema === 'object'
      const schemaObject = isObject ? (schema as Record<string, unknown>) : undefined
      const description = schemaObject
        ? ((schemaObject.description as string | undefined) ?? (schemaObject.title as string | undefined))
        : undefined

      return {
        name,
        description,
        required: requiredSet.has(name),
        schema: schemaObject
      }
    })
  }

  private async listPrompts(server: MCPServer): Promise<McpPromptCapability[]> {
    const prompts: MCPPrompt[] = await window.api.mcp
      .listPrompts(server)
      .catch((error: Error) => {
        logger.warn(`Failed to list prompts for MCP server ${server.name}`, error)
        return []
      })
      .then((result: MCPPrompt[]) => result || [])

    return prompts.map((prompt) => ({
      name: prompt.name,
      description: prompt.description,
      arguments: prompt.arguments
    }))
  }

  private async listResources(server: MCPServer): Promise<McpResourceCapability[]> {
    const resources: MCPResource[] = await window.api.mcp
      .listResources(server)
      .catch((error: Error) => {
        logger.warn(`Failed to list resources for MCP server ${server.name}`, error)
        return []
      })
      .then((result: MCPResource[]) => result || [])

    return resources.map((resource) => ({
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
      mimeType: resource.mimeType
    }))
  }
}

export const deviceCapabilitiesSyncService = new DeviceCapabilitiesSyncService()
