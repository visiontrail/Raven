// src/main/services/PackagingService.ts

import { loggerService } from '@logger'
import { app, IpcMainInvokeEvent } from 'electron'
import * as fs from 'fs-extra'
import * as path from 'path'

import { Package, PackageMetadata } from '../../renderer/src/types/package'
import { extractMetadataFromTGZ } from '../utils/packageUtils'
import { packageService } from './PackageService'
import { FileProcessor } from './packaging/FileProcessor'
import { PackageScanner } from './packaging/PackageScanner'
import { VersionParser } from './packaging/VersionParser'

const logger = loggerService.withContext('PackagingService')

// This is a TypeScript version of the COMPONENT_CONFIGS from the Python script.
const COMPONENT_CONFIGS = {
  'lingxi-07a': {
    name: '灵犀07A升级包',
    packet_attr: 1001,
    patch_packet_attr: 1002,
    prefix: 'GalaxySpace-Lx07A',
    components: {
      oam: {
        file_name: 'gnb-oam-lx07a',
        file_attr: '301',
        file_types: ['gnb-oam-lx07a'],
        description: 'packager.components.lingxi-07a.oam',
        direct_include: false
      },
      sct_fpga: {
        file_name: 'sct.bin',
        file_attr: '303',
        file_types: ['.bin'],
        description: 'packager.components.lingxi-07a.sct_fpga',
        direct_include: false
      },
      bposc_fpga: {
        file_name: 'bposc.bin',
        file_attr: '310',
        file_types: ['.bin'],
        description: 'packager.components.lingxi-07a.bposc_fpga',
        direct_include: false
      },
      bpoqv_fpga: {
        file_name: 'bpoqv.bin',
        file_attr: '315',
        file_types: ['.bin'],
        description: 'packager.components.lingxi-07a.bpoqv_fpga',
        direct_include: false
      },
      cucp: {
        file_name: 'cucp.deb',
        file_attr: '302',
        file_types: ['.deb'],
        description: 'packager.components.lingxi-07a.cucp',
        direct_include: false
      },
      cuup: {
        file_name: 'cuup.deb',
        file_attr: '307',
        file_types: ['.deb'],
        description: 'packager.components.lingxi-07a.cuup',
        direct_include: false
      },
      du: {
        file_name: 'du.deb',
        file_attr: '308',
        file_types: ['.deb'],
        description: 'packager.components.lingxi-07a.du',
        direct_include: false
      }
    }
  },
  'lingxi-10': {
    name: '灵犀10升级包',
    packet_attr: 1001,
    patch_packet_attr: 1002,
    prefix: 'GalaxySpace-Lx10',
    components: {
      oam: {
        file_name: 'gnb-oam-lx10',
        file_attr: '301',
        file_types: ['gnb-oam-lx10'],
        description: 'packager.components.lingxi-10.oam',
        direct_include: false
      },
      sct_fpga: {
        file_name: 'sct.bin',
        file_attr: '303',
        file_types: ['.bin'],
        description: 'packager.components.lingxi-10.sct_fpga',
        direct_include: false
      },
      bposc_fpga: {
        file_name: 'bposc.bin',
        file_attr: '310',
        file_types: ['.bin'],
        description: 'packager.components.lingxi-10.bposc_fpga',
        direct_include: false
      },
      bpodvb_fpga: {
        file_name: 'bpodvb.bin',
        file_attr: '315',
        file_types: ['.bin'],
        description: 'packager.components.lingxi-10.bpodvb_fpga',
        direct_include: false
      },
      cucp: {
        file_name: 'cucp.deb',
        file_attr: '302',
        file_types: ['.deb'],
        description: 'packager.components.lingxi-10.cucp',
        direct_include: false
      },
      cuup: {
        file_name: 'cuup.deb',
        file_attr: '307',
        file_types: ['.deb'],
        description: 'packager.components.lingxi-10.cuup',
        direct_include: false
      },
      du: {
        file_name: 'du.deb',
        file_attr: '308',
        file_types: ['.deb'],
        description: 'packager.components.lingxi-10.du',
        direct_include: false
      },
      galaxy_core_network: {
        file_name: 'galaxy_core_network.tgz',
        file_attr: '401',
        file_types: ['.tgz', '.tar.gz'],
        description: 'packager.components.lingxi-10.galaxy_core_network',
        direct_include: true
      },
      satellite_app_server: {
        file_name: 'satellite_app_server.tgz',
        file_attr: '403',
        file_types: ['.tgz', '.tar.gz'],
        description: 'packager.components.lingxi-10.satellite_app_server',
        direct_include: true
      }
    }
  },
  config: {
    name: '配置文件包',
    packet_attr: 1300,
    prefix: 'GalaxySpace',
    suffix: 'Config',
    components: {
      cwmp_data: {
        file_name: 'cwmp_data.xml',
        file_attr: '316',
        file_types: ['.xml'],
        description: 'packager.components.config.cwmp_data',
        direct_include: false
      },
      cucp_gnb: {
        file_name: 'conf.gnb_cucp.gnb.json',
        file_attr: '317',
        file_types: ['.json'],
        description: 'packager.components.config.cucp_gnb',
        direct_include: false
      },
      cucp_stack: {
        file_name: 'conf.gnb_cucp.stack.json',
        file_attr: '318',
        file_types: ['.json'],
        description: 'packager.components.config.cucp_stack',
        direct_include: false
      },
      cuup_gnb: {
        file_name: 'conf.gnb_cuup.gnb.json',
        file_attr: '319',
        file_types: ['.json'],
        description: 'packager.components.config.cuup_gnb',
        direct_include: false
      },
      cuup_stack: {
        file_name: 'conf.gnb_cuup.stack.json',
        file_attr: '320',
        file_types: ['.json'],
        description: 'packager.components.config.cuup_stack',
        direct_include: false
      },
      du_gnb: {
        file_name: 'conf.gnb_du.gnb.json',
        file_attr: '321',
        file_types: ['.json'],
        description: 'packager.components.config.du_gnb',
        direct_include: false
      },
      du_stack: {
        file_name: 'conf.gnb_du.stack.json',
        file_attr: '322',
        file_types: ['.json'],
        description: 'packager.components.config.du_stack',
        direct_include: false
      }
    }
  },
  'lingxi-06-thrid': {
    name: '三标段升级包',
    packet_attr: 3001,
    patch_packet_attr: 3002,
    prefix: 'GalaxySpace-TRD',
    components: {
      // TODO: Add components later
    }
  }
}

const MONTH_ABBR = {
  1: 'Jan',
  2: 'Feb',
  3: 'Mar',
  4: 'Apr',
  5: 'May',
  6: 'Jun',
  7: 'Jul',
  8: 'Aug',
  9: 'Sep',
  10: 'Oct',
  11: 'Nov',
  12: 'Dec'
}

export interface Component {
  name: string
  description: string
  selected_file?: string
  version?: string
  auto_version?: string
}

export interface PackageConfig {
  package_type: string
  package_version: string
  is_patch: boolean
  selected_components: Component[]
}

class PackagingService {
  private fileProcessor: FileProcessor
  private packageScanner: PackageScanner
  private packageWatcherStop: (() => void) | null = null

  // In-memory package storage
  private packages: Map<string, Package> = new Map()

  constructor() {
    this.fileProcessor = new FileProcessor()
    this.packageScanner = new PackageScanner()
  }

  /**
   * Initialize the packaging service
   */
  async initialize(): Promise<void> {
    // Scan for existing packages and index them
    await this.indexExistingPackages()

    // Start watching for new packages
    this.startWatchingForPackages()
  }

  /**
   * Scan for existing packages and add them to the in-memory storage
   */
  async indexExistingPackages(): Promise<void> {
    try {
      logger.info('Scanning for existing packages...')
      const packages = await this.packageScanner.scanForPackages()
      logger.info(`Found ${packages.length} packages`)

      // Add each package to the in-memory storage
      for (const pkg of packages) {
        await this.addOrUpdatePackage(pkg)
      }

      logger.info('Package indexing complete')
    } catch (error) {
      logger.error('Error indexing packages:', error as Error)
    }
  }

  /**
   * Start watching for new packages
   */
  startWatchingForPackages(): void {
    // Stop any existing watcher
    if (this.packageWatcherStop) {
      this.packageWatcherStop()
    }

    // Start a new watcher
    this.packageWatcherStop = this.packageScanner.watchForNewPackages(async (packageInfo) => {
      logger.info(`New package detected: ${packageInfo.name}`)
      await this.addOrUpdatePackage(packageInfo)
    })
  }

  /**
   * Stop watching for new packages
   */
  stopWatchingForPackages(): void {
    if (this.packageWatcherStop) {
      this.packageWatcherStop()
      this.packageWatcherStop = null
    }
  }

  /**
   * Add a package to the in-memory storage or update if it already exists
   * @param packageInfo Package information
   */
  async addOrUpdatePackage(packageInfo: Package): Promise<void> {
    try {
      // Check if the package already exists by path
      const existingPackage = Array.from(this.packages.values()).find((pkg) => pkg.path === packageInfo.path)

      if (existingPackage) {
        // Update the existing package
        this.packages.set(existingPackage.id, {
          ...existingPackage,
          name: packageInfo.name,
          size: packageInfo.size,
          createdAt: packageInfo.createdAt,
          packageType: packageInfo.packageType,
          version: packageInfo.version,
          metadata: packageInfo.metadata
        })
        logger.debug(`Updated package in memory: ${packageInfo.name}`)
      } else {
        // Add the new package
        this.packages.set(packageInfo.id, packageInfo)
        logger.debug(`Added package to memory: ${packageInfo.name}`)
      }
    } catch (error) {
      logger.error(`Error adding/updating package ${packageInfo.name}:`, error as Error)
    }
  }

  /**
   * Get all packages from the in-memory storage
   * @returns Array of packages
   */
  async getAllPackages(): Promise<Package[]> {
    return Array.from(this.packages.values())
  }

  /**
   * Get a package by ID
   * @param id Package ID
   * @returns Package information or null if not found
   */
  async getPackageById(id: string): Promise<Package | null> {
    return this.packages.get(id) || null
  }

  /**
   * Update package metadata
   * @param id Package ID
   * @param metadata New metadata
   * @returns True if successful, false otherwise
   */
  async updatePackageMetadata(id: string, metadata: PackageMetadata): Promise<boolean> {
    try {
      const pkg = this.packages.get(id)
      if (!pkg) return false

      this.packages.set(id, {
        ...pkg,
        metadata
      })
      return true
    } catch (error) {
      console.error(`Error updating package metadata ${id}:`, error)
      return false
    }
  }

  /**
   * Delete a package
   * @param id Package ID
   * @returns True if successful, false otherwise
   */
  async deletePackage(id: string): Promise<boolean> {
    try {
      const pkg = this.packages.get(id)
      if (!pkg) return false

      // Delete the file from the file system
      if (await fs.pathExists(pkg.path)) {
        await fs.unlink(pkg.path)
      }

      // Delete from the in-memory storage
      this.packages.delete(id)
      return true
    } catch (error) {
      console.error(`Error deleting package ${id}:`, error)
      return false
    }
  }

  async handleGenerateSiIni(_event: IpcMainInvokeEvent, config: PackageConfig): Promise<string> {
    return this.generateSiIni(config)
  }

  async handleCreatePackage(
    _event: IpcMainInvokeEvent,
    config: PackageConfig
  ): Promise<{ success: boolean; message: string; outputPath?: string }> {
    const workDir = path.join(app.getPath('temp'), `package_${Date.now()}`)
    await fs.ensureDir(workDir)

    try {
      // Process each selected component
      for (const component of config.selected_components) {
        if (!component.selected_file) continue
        await this._processComponent(component, workDir, config.package_type)
      }

      // Generate si.ini
      const siIniContent = this.generateSiIni(config)
      await fs.writeFile(path.join(workDir, 'si.ini'), siIniContent)

      // Generate output filename
      const outputFilename = this._generateOutputFilename(config)
      const outputPath = path.join(app.getPath('downloads'), outputFilename) // Save to Downloads folder

      // Create final package
      await this.fileProcessor.createTgzPackage(workDir, outputPath)

      // Derive component names from si.ini FileAttr_ values
      const allComponentsConfig = (COMPONENT_CONFIGS as any)[config.package_type]?.components || {}
      const attrRegex = /^FileAttr_\d+=(\d+);/gm
      const foundAttrIds: string[] = []
      let match
      while ((match = attrRegex.exec(siIniContent)) !== null) {
        foundAttrIds.push(match[1])
      }
      const fileAttrToNameMap: Record<string, string> = {}
      for (const [name, details] of Object.entries(allComponentsConfig)) {
        fileAttrToNameMap[(details as any).file_attr] = name
      }
      let selectedComponentNames = foundAttrIds.map((id) => fileAttrToNameMap[id]).filter(Boolean) as string[]
      if (selectedComponentNames.length === 0) {
        // Fallback to selected component names from config when si.ini parsing yields nothing
        selectedComponentNames = config.selected_components.filter((c) => c.selected_file).map((c) => c.name)
      }

      // Index the newly created package
      const packageInfo = await extractMetadataFromTGZ(outputPath)
      const patchedPackageInfo: Package = {
        ...packageInfo,
        metadata: {
          ...packageInfo.metadata,
          isPatch: config.is_patch,
          components: (() => {
            // Map selected component name -> version (prefer manual version, fallback to auto_version)
            const versionMap: Record<string, string | undefined> = {}
            for (const c of config.selected_components) {
              if (!c.selected_file) continue
              versionMap[c.name] = c.version || c.auto_version
            }
            // Build detailed components using names parsed from si.ini (fallback handled above)
            return selectedComponentNames.map((name) => {
              const ver = versionMap[name]
              return ver ? { name, version: ver } : name
            })
          })()
        }
      }
      await this.addOrUpdatePackage(patchedPackageInfo)

      // Also add to the new PackageService
      await packageService.addPackage(patchedPackageInfo)

      return { success: true, message: `打包成功: ${outputFilename}`, outputPath }
    } catch (error: any) {
      return { success: false, message: `打包失败: ${error.message}` }
    } finally {
      await fs.remove(workDir) // Cleanup
    }
  }

  async getAutoVersion(filePath: string): Promise<string | null> {
    console.log(`[Main] getAutoVersion called with filePath: ${filePath}`)
    const version = VersionParser.parseVersionFromFilename(path.basename(filePath))
    const formattedVersion = version ? VersionParser.formatVersion(version) : null
    console.log(`[Main] Parsed version: ${version}, Formatted version: ${formattedVersion}`)
    return formattedVersion
  }

  async getAutoVersionFromFilename(filename: string): Promise<string | null> {
    console.log(`[Main] getAutoVersionFromFilename called with filename: ${filename}`)
    const version = VersionParser.parseVersionFromFilename(filename)
    const formattedVersion = version ? VersionParser.formatVersion(version) : null
    console.log(`[Main] Parsed version from filename: ${version}, Formatted version: ${formattedVersion}`)
    return formattedVersion
  }

  private async _processComponent(component: Component, workDir: string, packageType: string) {
    const componentConfig = COMPONENT_CONFIGS[packageType]?.components[component.name]
    if (!componentConfig || !component.selected_file) {
      throw new Error(`配置或文件缺失: ${component.name}`)
    }

    let sourceFile = component.selected_file

    if (this.fileProcessor.isArchiveFile(sourceFile) && !componentConfig.direct_include) {
      const extractDir = await this.fileProcessor.extractArchive(sourceFile)
      const foundFiles = await this.fileProcessor.findFilesByType(
        extractDir,
        componentConfig.file_types,
        componentConfig.file_name
      )
      if (foundFiles.length === 0) {
        throw new Error(`在压缩包中未找到组件 ${component.description} 的文件`)
      }
      sourceFile = foundFiles[0]
    }

    // Auto-detect version if not manually provided
    if (!component.version) {
      const autoVersion = VersionParser.parseVersionFromFilename(path.basename(sourceFile), component.name)
      if (autoVersion) {
        component.auto_version = VersionParser.formatVersion(autoVersion)
      }
    }

    await this.fileProcessor.copyAndRenameFile(sourceFile, workDir, componentConfig.file_name)
  }

  private _generateOutputFilename(packageConfig: PackageConfig): string {
    const now = new Date()
    const month = MONTH_ABBR[now.getMonth() + 1]
    const dateStr = `${now.getFullYear()}${month}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`

    const configInfo = COMPONENT_CONFIGS[packageConfig.package_type]
    if (!configInfo) {
      throw new Error(`未知的包类型: ${packageConfig.package_type}`)
    }

    const baseName = configInfo.prefix || 'GalaxySpace-Unknown'
    let suffix = ''
    if (packageConfig.is_patch) {
      suffix = '-Patch'
    } else if (configInfo.suffix) {
      suffix = `-${configInfo.suffix}`
    }

    const version = VersionParser.versionToNumeric(packageConfig.package_version)
    return `${baseName}-${dateStr}-V${version}${suffix}.tgz`
  }

  getComponentTemplate(packageType: string): Component[] {
    const config = COMPONENT_CONFIGS[packageType]
    if (!config) {
      throw new Error(`Unknown package type: ${packageType}`)
    }
    return Object.entries(config.components).map(([name, details]) => ({
      name,
      description: (details as any).description
    }))
  }

  generateSiIni(config: PackageConfig): string {
    console.log('[Main] generateSiIni called with config:', JSON.stringify(config, null, 2))
    const packageTypeConfig = COMPONENT_CONFIGS[config.package_type]
    if (!packageTypeConfig) {
      const errorMsg = `Error: Unknown package type ${config.package_type}`
      console.error(`[Main] ${errorMsg}`)
      return errorMsg
    }

    const { packet_attr, patch_packet_attr, components: allComponentsConfig } = packageTypeConfig
    const final_packet_attr = config.is_patch ? patch_packet_attr : packet_attr
    const selectedComponents = config.selected_components.filter((c) => c.selected_file)

    let content = ''
    content += `Packet_Ver=V${config.package_version};\n`
    content += `PacketAttr=${final_packet_attr};\n`
    content += `Publisher=yinhe;\n`
    content += `FileNumInPacket=${selectedComponents.length};\n\n`

    selectedComponents.forEach((component, index) => {
      const componentConfig = allComponentsConfig[component.name]
      if (!componentConfig) return

      const fileVersion = component.version || component.auto_version || 'V0.0.0.0'

      content += `FileName_${index + 1}=${componentConfig.file_name};\n`
      content += `FileAttr_${index + 1}=${componentConfig.file_attr};\n`
      content += `FileVer_${index + 1}=${fileVersion};\n\n`
    })

    console.log('[Main] Generated si.ini content:\n', content)
    return content
  }

  cleanup() {
    this.stopWatchingForPackages()
    this.fileProcessor.cleanupTempFiles()
  }
}

export const packagingService = new PackagingService()
