// src/main/services/PackageService.ts

import * as fs from 'fs-extra'
import * as path from 'path'

import { FTPConfig, HTTPConfig, Package, PackageMetadata } from '../../renderer/src/types/package'
import { extractMetadataFromTGZ } from '../utils/packageUtils'
import { ftpService, FTPUploadProgress } from './FTPService'
import { httpService, HTTPUploadProgress } from './HTTPService'

/**
 * Interface for the Package Service
 */
export interface IPackageService {
  /**
   * Get all packages
   * @returns Promise<Package[]> Array of all packages
   */
  getPackages(): Promise<Package[]>

  /**
   * Get a package by ID
   * @param id Package ID
   * @returns Promise<Package | null> Package or null if not found
   */
  getPackageById(id: string): Promise<Package | null>

  /**
   * Update package metadata
   * @param id Package ID
   * @param metadata New metadata
   * @returns Promise<boolean> True if successful
   */
  updatePackageMetadata(id: string, metadata: PackageMetadata): Promise<boolean>

  /**
   * Delete a package
   * @param id Package ID
   * @returns Promise<boolean> True if successful
   */
  deletePackage(id: string): Promise<boolean>

  /**
   * Upload package to FTP server
   * @param id Package ID
   * @param ftpConfig FTP configuration
   * @param onProgress Progress callback
   * @returns Promise<boolean> True if successful
   */
  uploadPackageToFTP(id: string, ftpConfig: FTPConfig, onProgress?: (progress: FTPUploadProgress) => void): Promise<boolean>

  /**
   * Upload package to HTTP server
   * @param id Package ID
   * @param httpConfig HTTP configuration
   * @param onProgress Progress callback
   * @returns Promise<boolean> True if successful
   */
  uploadPackageToHTTP(id: string, httpConfig: HTTPConfig, onProgress?: (progress: HTTPUploadProgress) => void): Promise<boolean>

  /**
   * Add a package to the service
   * @param packageInfo Package information
   * @returns Promise<boolean> True if successful
   */
  addPackage(packageInfo: Package): Promise<boolean>

  /**
   * Scan for packages in a directory
   * @param directoryPath Directory to scan
   * @returns Promise<Package[]> Array of found packages
   */
  scanPackagesInDirectory(directoryPath: string): Promise<Package[]>

  /**
   * Extract metadata from a TGZ file
   * @param filePath Path to TGZ file
   * @returns Promise<Package> Package metadata
   */
  extractPackageMetadata(filePath: string): Promise<Package>
}

/**
 * Implementation of the Package Service
 */
export class PackageService implements IPackageService {
  private packages: Map<string, Package> = new Map()
  private metadataFilePath: string

  constructor() {
    // Store metadata in a JSON file in the user data directory
    try {
      const { app } = require('electron')
      const userDataPath = app.getPath('userData')
      this.metadataFilePath = path.join(userDataPath, 'package-metadata.json')
    } catch (error) {
      // Fallback for tests or when electron is not available
      this.metadataFilePath = path.join('/tmp', 'package-metadata.json')
    }
    this.loadPackageMetadata()
  }

  /**
   * Load package metadata from file
   */
  private async loadPackageMetadata(): Promise<void> {
    try {
      if (await fs.pathExists(this.metadataFilePath)) {
        const data = await fs.readJSON(this.metadataFilePath)
        if (Array.isArray(data)) {
          for (const pkg of data) {
            // Convert createdAt string back to Date object
            if (typeof pkg.createdAt === 'string') {
              pkg.createdAt = new Date(pkg.createdAt)
            }
            this.packages.set(pkg.id, pkg)
          }
        }
      }
    } catch (error) {
      console.error('Error loading package metadata:', error)
    }
  }

  /**
   * Save package metadata to file
   */
  private async savePackageMetadata(): Promise<void> {
    try {
      const packagesArray = Array.from(this.packages.values())
      await fs.writeJSON(this.metadataFilePath, packagesArray, { spaces: 2 })
    } catch (error) {
      console.error('Error saving package metadata:', error)
    }
  }

  /**
   * Get all packages
   */
  async getPackages(): Promise<Package[]> {
    // Filter out packages that no longer exist on the file system
    const existingPackages: Package[] = []

    for (const pkg of this.packages.values()) {
      if (await fs.pathExists(pkg.path)) {
        existingPackages.push(pkg)
      } else {
        // Remove from memory if file doesn't exist
        this.packages.delete(pkg.id)
      }
    }

    // Save updated metadata
    await this.savePackageMetadata()

    return existingPackages
  }

  /**
   * Get a package by ID
   */
  async getPackageById(id: string): Promise<Package | null> {
    const pkg = this.packages.get(id)

    if (!pkg) {
      return null
    }

    // Check if file still exists
    if (!(await fs.pathExists(pkg.path))) {
      this.packages.delete(id)
      await this.savePackageMetadata()
      return null
    }

    return pkg
  }

  /**
   * Update package metadata
   */
  async updatePackageMetadata(id: string, metadata: PackageMetadata): Promise<boolean> {
    try {
      const pkg = this.packages.get(id)
      if (!pkg) {
        return false
      }

      // Update the package metadata
      const updatedPackage: Package = {
        ...pkg,
        metadata
      }

      this.packages.set(id, updatedPackage)
      await this.savePackageMetadata()

      return true
    } catch (error) {
      console.error(`Error updating package metadata for ${id}:`, error)
      return false
    }
  }

  /**
   * Delete a package
   */
  async deletePackage(id: string): Promise<boolean> {
    try {
      const pkg = this.packages.get(id)
      if (!pkg) {
        return false
      }

      // Delete the file from the file system
      if (await fs.pathExists(pkg.path)) {
        await fs.unlink(pkg.path)
      }

      // Remove from memory
      this.packages.delete(id)
      await this.savePackageMetadata()

      return true
    } catch (error) {
      console.error(`Error deleting package ${id}:`, error)
      return false
    }
  }

  /**
   * Upload package to FTP server
   */
  async uploadPackageToFTP(id: string, ftpConfig: FTPConfig, onProgress?: (progress: FTPUploadProgress) => void): Promise<boolean> {
    try {
      const pkg = this.packages.get(id)
      if (!pkg) {
        throw new Error(`Package with id ${id} not found`)
      }

      if (!(await fs.pathExists(pkg.path))) {
        throw new Error(`Package file not found: ${pkg.path}`)
      }

      // Create remote path with package filename if not specified
      let remotePath = ftpConfig.remotePath
      if (!remotePath.endsWith(pkg.name)) {
        remotePath = path.posix.join(remotePath, pkg.name)
      }

      // Create updated FTP config with the full remote path
      const updatedFtpConfig: FTPConfig = {
        ...ftpConfig,
        remotePath
      }

      console.log(`Starting FTP upload for package ${pkg.name} to ${ftpConfig.host}:${ftpConfig.port}${remotePath}`)

      // Use FTP service to upload the file
      const success = await ftpService.uploadFile(pkg.path, updatedFtpConfig, onProgress)

      if (success) {
        console.log(`Successfully uploaded package ${pkg.name} to FTP server`)
      }

      return success
    } catch (error) {
      console.error(`Error uploading package ${id} to FTP:`, error)
      return false
    }
  }

  /**
   * Upload package to HTTP server
   */
  async uploadPackageToHTTP(id: string, httpConfig: HTTPConfig, onProgress?: (progress: HTTPUploadProgress) => void): Promise<boolean> {
    try {
      const pkg = this.packages.get(id)
      if (!pkg) {
        throw new Error(`Package with id ${id} not found`)
      }

      if (!(await fs.pathExists(pkg.path))) {
        throw new Error(`Package file not found: ${pkg.path}`)
      }

      console.log(`Starting HTTP upload for package ${pkg.name} to ${httpConfig.url}`)

      // Use HTTP service to upload the file with metadata
      const success = await httpService.uploadFile(pkg.path, pkg.metadata, httpConfig, onProgress)

      if (success) {
        console.log(`Successfully uploaded package ${pkg.name} to HTTP server`)
      }

      return success
    } catch (error) {
      console.error(`Error uploading package ${id} to HTTP:`, error)
      return false
    }
  }

  /**
   * Add a package to the service
   */
  async addPackage(packageInfo: Package): Promise<boolean> {
    try {
      // Check if package already exists by path
      const existingPackage = Array.from(this.packages.values()).find((pkg) => pkg.path === packageInfo.path)

      if (existingPackage) {
        // Update existing package
        this.packages.set(existingPackage.id, {
          ...existingPackage,
          ...packageInfo,
          id: existingPackage.id // Keep the original ID
        })
      } else {
        // Add new package
        this.packages.set(packageInfo.id, packageInfo)
      }

      await this.savePackageMetadata()
      return true
    } catch (error) {
      console.error('Error adding package:', error)
      return false
    }
  }

  /**
   * Scan for packages in a directory
   */
  async scanPackagesInDirectory(directoryPath: string): Promise<Package[]> {
    const packages: Package[] = []

    try {
      if (!(await fs.pathExists(directoryPath))) {
        return packages
      }

      const files = await fs.readdir(directoryPath)

      for (const file of files) {
        const filePath = path.join(directoryPath, file)
        const stats = await fs.stat(filePath)

        // Check if it's a TGZ file
        if (stats.isFile() && (file.endsWith('.tgz') || file.endsWith('.tar.gz'))) {
          try {
            const packageInfo = await this.extractPackageMetadata(filePath)
            packages.push(packageInfo)
          } catch (error) {
            console.error(`Error extracting metadata from ${filePath}:`, error)
          }
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${directoryPath}:`, error)
    }

    return packages
  }

  /**
   * Extract metadata from a TGZ file
   */
  async extractPackageMetadata(filePath: string): Promise<Package> {
    return await extractMetadataFromTGZ(filePath)
  }
}

// Export singleton instance
export const packageService = new PackageService()
