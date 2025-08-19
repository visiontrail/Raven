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
    console.log('🔧 创建新的PackageService实例')
    this.packages = new Map()
    this.metadataFilePath = path.join(__dirname, '../../data/package-metadata.json')
    this.uploadsDir = path.join(__dirname, '../../uploads')
    console.log(`📁 元数据文件路径: ${this.metadataFilePath}`)
    console.log('📁 上传目录路径:', this.uploadsDir)
    this.loadPackageMetadata()
  }

  // Load package metadata from file
  async loadPackageMetadata() {
    console.log('📖 开始加载包元数据...')
    try {
      // Ensure data directory exists
      await fs.ensureDir(path.dirname(this.metadataFilePath))
      if (await fs.pathExists(this.metadataFilePath)) {
        console.log('📄 找到元数据文件，开始读取...')
        const data = await fs.readJSON(this.metadataFilePath)
        if (Array.isArray(data)) {
          console.log(`📦 从元数据文件中读取到 ${data.length} 个包记录`)
          for (const pkg of data) {
            // Convert createdAt string back to Date object
            if (typeof pkg.createdAt === 'string') {
              pkg.createdAt = new Date(pkg.createdAt)
            }
            this.packages.set(pkg.id, pkg)
            console.log(`✅ 加载包: ${pkg.name} (ID: ${pkg.id})`)
          }
        } else {
          console.log('⚠️ 元数据文件格式不正确，应该是数组格式')
        }
      } else {
        console.log('📄 元数据文件不存在，将创建新文件')
      }
      console.log(`🎯 总共加载了 ${this.packages.size} 个包到内存中`)
      
      // 自动扫描uploads目录中的文件
      await this.scanUploadsDirectory()
    } catch (error) {
      console.error('❌ 加载包元数据时出错:', error)
    }
  }

  // Save package metadata to file
  async savePackageMetadata() {
    try {
      const packagesArray = Array.from(this.packages.values())
      await fs.writeJSON(this.metadataFilePath, packagesArray, { spaces: 2 })
      console.log(`💾 已保存 ${packagesArray.length} 个包的元数据到文件`)
    } catch (error) {
      console.error('❌ 保存包元数据时出错:', error)
    }
  }

  // Get all packages
  async getAllPackages() {
    console.log(`🔍 开始获取所有包，当前内存中有 ${this.packages.size} 个包`)
    // Filter out packages that no longer exist on the file system
    const existingPackages = []
    const removedPackages = []

    for (const pkg of this.packages.values()) {
      if (await fs.pathExists(pkg.path)) {
        existingPackages.push(pkg)
        console.log(`✅ 包文件存在: ${pkg.name} -> ${pkg.path}`)
      } else {
        // Remove from memory if file doesn't exist
        this.packages.delete(pkg.id)
        removedPackages.push(pkg.name)
        console.log(`❌ 包文件不存在，已从内存中移除: ${pkg.name} -> ${pkg.path}`)
      }
    }

    if (removedPackages.length > 0) {
      console.log(`🗑️ 移除了 ${removedPackages.length} 个不存在的包: ${removedPackages.join(', ')}`)
      // Save updated metadata
      await this.savePackageMetadata()
    }

    console.log(`📊 返回 ${existingPackages.length} 个有效包`)
    return existingPackages
  }

  // Get a package by ID
  async getPackageById(id) {
    const pkg = this.packages.get(id)

    if (!pkg) {
      console.log(`❌ 未找到ID为 ${id} 的包`)
      return null
    }

    // Check if file still exists
    if (!(await fs.pathExists(pkg.path))) {
      console.log(`❌ 包文件不存在，移除包: ${pkg.name} -> ${pkg.path}`)
      this.packages.delete(id)
      await this.savePackageMetadata()
      return null
    }

    console.log(`✅ 找到包: ${pkg.name} (ID: ${id})`)
    return pkg
  }

  // Update package metadata
  async updatePackageMetadata(id, metadata) {
    try {
      const pkg = this.packages.get(id)
      if (!pkg) {
        console.log(`❌ 更新元数据失败，未找到ID为 ${id} 的包`)
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
      console.log(`✅ 成功更新包元数据: ${pkg.name} (ID: ${id})`)

      return true
    } catch (error) {
      console.error(`❌ 更新包元数据时出错 ${id}:`, error)
      return false
    }
  }

  // Delete a package
  async deletePackage(id) {
    try {
      const pkg = this.packages.get(id)
      if (!pkg) {
        console.log(`❌ 删除失败，未找到ID为 ${id} 的包`)
        return false
      }

      // Delete the file from the file system
      if (await fs.pathExists(pkg.path)) {
        await fs.unlink(pkg.path)
        console.log(`🗑️ 已删除文件: ${pkg.path}`)
      }

      // Remove from memory
      this.packages.delete(id)
      await this.savePackageMetadata()
      console.log(`✅ 成功删除包: ${pkg.name} (ID: ${id})`)

      return true
    } catch (error) {
      console.error(`❌ 删除包时出错 ${id}:`, error)
      return false
    }
  }

  // Add a package to the service
  async addPackage(packageInfo) {
    try {
      console.log(`📦 尝试添加包: ${packageInfo.name}`)
      // Check if package already exists by path
      const existingPackage = Array.from(this.packages.values()).find((pkg) => pkg.path === packageInfo.path)

      if (existingPackage) {
        // Update existing package
        console.log(`🔄 更新现有包: ${packageInfo.name}`)
        this.packages.set(existingPackage.id, {
          ...existingPackage,
          ...packageInfo,
          id: existingPackage.id // Keep the original ID
        })
      } else {
        // Add new package
        console.log(`🆕 添加新包: ${packageInfo.name} (ID: ${packageInfo.id})`)
        this.packages.set(packageInfo.id, packageInfo)
      }

      await this.savePackageMetadata()
      console.log(`✅ 成功添加包: ${packageInfo.name}`)
      return true
    } catch (error) {
      console.error('❌ 添加包时出错:', error)
      return false
    }
  }

  // Extract metadata from a TGZ file
  async extractPackageMetadata(filePath) {
    console.log(`🔍 开始提取包元数据: ${filePath}`)
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
    
    const packageInfo = {
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
    
    console.log(`✅ 成功提取包元数据: ${fileName}, 类型: ${packageType}, 版本: ${version}`)
    return packageInfo
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
    // Look for version patterns like V1.0.0, v1.0.0, 1.0.0, V1002
    const versionRegex = /[Vv]?(\d+(?:\.\d+)*(?:\.\d+)?)/
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

  // 扫描uploads目录中的文件
  async scanUploadsDirectory() {
    console.log('🔍 开始扫描uploads目录...')
    try {
      // 确保uploads目录存在
      await fs.ensureDir(this.uploadsDir)
      
      // 读取uploads目录中的所有文件
      const files = await fs.readdir(this.uploadsDir)
      console.log(`📁 uploads目录中找到 ${files.length} 个文件`)
      
      let newPackagesCount = 0
      
      for (const fileName of files) {
        const filePath = path.join(this.uploadsDir, fileName)
        const stats = await fs.stat(filePath)
        
        // 只处理文件，跳过目录
        if (!stats.isFile()) {
          console.log(`⏭️ 跳过目录: ${fileName}`)
          continue
        }
        
        // 只处理.tgz和.tar.gz文件
        if (!fileName.toLowerCase().endsWith('.tgz') && !fileName.toLowerCase().endsWith('.tar.gz')) {
          console.log(`⏭️ 跳过非包文件: ${fileName}`)
          continue
        }
        
        // 检查是否已经在包管理系统中
        const existingPackage = Array.from(this.packages.values()).find((pkg) => pkg.path === filePath)
        
        if (existingPackage) {
          console.log(`✅ 文件已在系统中: ${fileName}`)
          continue
        }
        
        // 提取包元数据并添加到系统中
        console.log(`🆕 发现新包文件: ${fileName}`)
        try {
          const packageInfo = await this.extractPackageMetadata(filePath)
          await this.addPackage(packageInfo)
          newPackagesCount++
          console.log(`✅ 成功添加新包: ${fileName} (ID: ${packageInfo.id})`)
        } catch (error) {
          console.error(`❌ 处理文件 ${fileName} 时出错:`, error)
        }
      }
      
      if (newPackagesCount > 0) {
        console.log(`🎉 扫描完成，新添加了 ${newPackagesCount} 个包`)
      } else {
        console.log('✅ 扫描完成，没有发现新包')
      }
    } catch (error) {
      console.error('❌ 扫描uploads目录时出错:', error)
    }
  }
}

module.exports = PackageService