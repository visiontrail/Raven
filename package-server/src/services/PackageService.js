const fs = require('fs-extra')
const path = require('path')
const { v4: uuidv4 } = require('uuid')

// Package types enum
const PackageType = {
  LINGXI_10: 'lingxi-10',
  LINGXI_07A: 'lingxi-07a',
  CONFIG: 'config',
  LINGXI_06TRD: 'lingxi-06-thrid'
}

class PackageService {
  constructor() {
    console.log('创建新的PackageService实例')
    this.packages = new Map()
    this.metadataFilePath = path.join(__dirname, '../../data/package-metadata.json')
    this.loadPackageMetadata()
  }

  // Load package metadata from file
  async loadPackageMetadata() {
    try {
      // Ensure data directory exists
      await fs.ensureDir(path.dirname(this.metadataFilePath))
      
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

  // Save package metadata to file
  async savePackageMetadata() {
    try {
      const packagesArray = Array.from(this.packages.values())
      await fs.writeJSON(this.metadataFilePath, packagesArray, { spaces: 2 })
    } catch (error) {
      console.error('Error saving package metadata:', error)
    }
  }

  // Get all packages
  async getAllPackages() {
    // Filter out packages that no longer exist on the file system
    const existingPackages = []

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

  // Get a package by ID
  async getPackageById(id) {
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

  // Update package metadata
  async updatePackageMetadata(id, metadata) {
    try {
      const pkg = this.packages.get(id)
      if (!pkg) {
        return false
      }

      // Update the package metadata
      const updatedPackage = {
        ...pkg,
        metadata: {
          ...pkg.metadata,
          ...metadata
        }
      }

      this.packages.set(id, updatedPackage)
      await this.savePackageMetadata()

      return true
    } catch (error) {
      console.error(`Error updating package metadata for ${id}:`, error)
      return false
    }
  }

  // Delete a package
  async deletePackage(id) {
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

  // Add a package to the service
  async addPackage(packageInfo) {
    try {
      // Check if package already exists by path
      const existingPackage = Array.from(this.packages.values()).find(
        (pkg) => pkg.path === packageInfo.path
      )

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

  // Extract metadata from a TGZ file
  async extractPackageMetadata(filePath) {
    const stats = await fs.stat(filePath)
    const fileName = path.basename(filePath)
    
    // Extract package type from filename
    const packageType = this.determinePackageType(fileName)
    
    // Extract version from filename
    const version = this.parseVersionFromFilename(fileName) || '0.0.0'
    
    // Extract components from filename
    const components = this.extractComponentsFromFilename(fileName)
    
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
        components,
        description: '',
        tags: [],
        customFields: {}
      }
    }
  }

  // Determine the package type based on the filename
  determinePackageType(fileName) {
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

  // Parse version from filename
  parseVersionFromFilename(fileName) {
    // Look for version patterns like V1.0.0, v1.0.0, 1.0.0
    const versionRegex = /[Vv]?(\d+\.\d+\.\d+)/
    const match = fileName.match(versionRegex)
    return match ? match[1] : null
  }

  // Extract components from the filename
  extractComponentsFromFilename(fileName) {
    const components = []
    const lowerFileName = fileName.toLowerCase()
    
    // Extract components based on known patterns
    if (lowerFileName.includes('galaxy_core')) {
      components.push('galaxy_core_network')
    }
    
    if (lowerFileName.includes('satellite')) {
      components.push('satellite_app_server')
    }
    
    if (lowerFileName.includes('oam')) {
      components.push('oam')
    }
    
    if (lowerFileName.includes('cucp')) {
      components.push('cucp')
    }
    
    if (lowerFileName.includes('cuup')) {
      components.push('cuup')
    }
    
    if (lowerFileName.includes('du')) {
      components.push('du')
    }
    
    return components
  }
}

module.exports = PackageService