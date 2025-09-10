// src/main/utils/packageUtils.ts

import * as fs from 'fs-extra'
import * as path from 'path'
import { v4 as uuidv4 } from 'uuid'

import { Package, PackageType } from '../../renderer/src/types/package'
import { VersionParser } from '../services/packaging/VersionParser'

/**
 * Extract metadata from a TGZ package filename and path
 * @param filePath Path to the TGZ file
 * @returns Package metadata object
 */
export async function extractMetadataFromTGZ(filePath: string): Promise<Package> {
  const stats = await fs.stat(filePath)
  const fileName = path.basename(filePath)

  // Extract package type from filename
  const packageType = determinePackageType(fileName)

  // Extract version from filename
  const version = VersionParser.parseVersionFromFilename(fileName) || '0.0.0.0'

  // Extract components from filename
  const components = extractComponentsFromFilename(fileName)

  // Determine if it's a patch
  const isPatch = fileName.toLowerCase().includes('patch')

  return {
    id: uuidv4(),
    name: fileName,
    path: filePath,
    size: stats.size,
    createdAt: stats.birthtime || stats.ctime,
    packageType,
    version,
    metadata: {
      isPatch,
      // Attach version info to each component while keeping backward compatibility with union type
      components: components.map((name) => ({ name, version })),
      description: '',
      tags: [],
      customFields: {}
    }
  }
}

/**
 * Determine the package type based on the filename
 * @param fileName Name of the TGZ file
 * @returns Package type enum value
 */
function determinePackageType(fileName: string): PackageType {
  const lowerFileName = fileName.toLowerCase()

  if (lowerFileName.includes('lingxi-10') || lowerFileName.includes('lx10')) {
    return PackageType.LINGXI_10
  } else if (lowerFileName.includes('lingxi-07a') || lowerFileName.includes('lx07a')) {
    return PackageType.LINGXI_07A
  } else if (lowerFileName.includes('config')) {
    return PackageType.CONFIG
  } else if (lowerFileName.includes('lingxi-06-thrid') || lowerFileName.includes('trd')) {
    return PackageType.LINGXI_06TRD
  }

  // Default to LINGXI_10 if can't determine
  return PackageType.LINGXI_10
}

/**
 * Extract components from the filename
 * @param fileName Name of the TGZ file
 * @returns Array of component names
 */
function extractComponentsFromFilename(fileName: string): string[] {
  const components: string[] = []

  // Extract components based on known patterns
  if (fileName.toLowerCase().includes('galaxy_core')) {
    components.push('galaxy_core_network')
  }

  if (fileName.toLowerCase().includes('satellite')) {
    components.push('satellite_app_server')
  }

  if (fileName.toLowerCase().includes('oam')) {
    components.push('oam')
  }

  if (fileName.toLowerCase().includes('cucp')) {
    components.push('cucp')
  }

  if (fileName.toLowerCase().includes('cuup')) {
    components.push('cuup')
  }

  if (fileName.toLowerCase().includes('du')) {
    components.push('du')
  }

  return components
}

/**
 * Parse the si.ini file inside a TGZ package to extract additional metadata
 * Note: This would require extracting the TGZ file first, which might be expensive
 * Consider implementing this as an async operation or on-demand
 */
export async function parseSiIniFromTGZ(): Promise<Record<string, any> | null> {
  // This would be implemented if we want to extract metadata from the si.ini file
  // For now, return null as this would require extracting the TGZ file
  return null
}
