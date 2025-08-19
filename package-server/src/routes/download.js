const express = require('express')
const fs = require('fs-extra')
const archiver = require('archiver')
const PackageService = require('../services/PackageService')

const router = express.Router()
const packageService = new PackageService()

// 根据ID下载单个包
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const packageInfo = await packageService.getPackageById(id)
    
    if (!packageInfo) {
      return res.status(404).json({
        success: false,
        message: '包不存在'
      })
    }
    
    const filePath = packageInfo.path
    
    // Check if file exists
    if (!(await fs.pathExists(filePath))) {
      return res.status(404).json({
        success: false,
        message: '文件不存在'
      })
    }
    
    // 设置下载头
    res.setHeader('Content-Disposition', `attachment; filename="${packageInfo.name}-${packageInfo.version}.tgz"`)
    res.setHeader('Content-Type', 'application/gzip')
    res.setHeader('Content-Length', packageInfo.size)
    
    // Stream the file to the response
    const fileStream = fs.createReadStream(filePath)
    fileStream.pipe(res)
    
    fileStream.on('error', (error) => {
      console.error('Error streaming file:', error)
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: '下载失败'
        })
      }
    })
    
  } catch (error) {
    console.error('Download error:', error)
    res.status(500).json({
      success: false,
      message: '下载失败'
    })
  }
})

// 批量下载多个包（打包成ZIP）
router.post('/batch', async (req, res) => {
  try {
    const { packageIds } = req.body
    
    if (!packageIds || !Array.isArray(packageIds) || packageIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供要下载的包ID列表'
      })
    }
    
    // 获取所有包信息
    const packages = []
    const notFound = []
    
    for (const id of packageIds) {
      const packageInfo = await packageService.getPackageById(id)
      if (packageInfo && (await fs.pathExists(packageInfo.path))) {
        packages.push(packageInfo)
      } else {
        notFound.push(id)
      }
    }
    
    if (packages.length === 0) {
      return res.status(404).json({
        success: false,
        message: '没有找到有效的包文件'
      })
    }
    
    // 设置响应头
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    const zipFilename = `packages-${timestamp}.zip`
    
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`)
    res.setHeader('Content-Type', 'application/zip')
    
    // 创建ZIP压缩流
    const archive = archiver('zip', {
      zlib: { level: 9 } // 最高压缩级别
    })
    
    archive.pipe(res)
    
    // 添加文件到压缩包
    for (const pkg of packages) {
      const filename = `${pkg.name}-${pkg.version}.tgz`
      archive.file(pkg.path, { name: filename })
    }
    
    // 完成压缩
    await archive.finalize()
    
    // 如果有未找到的包，在响应头中添加警告
    if (notFound.length > 0) {
      res.setHeader('X-Warning', `以下包未找到: ${notFound.join(', ')}`)
    }
    
  } catch (error) {
    console.error('Batch download error:', error)
    res.status(500).json({
      success: false,
      message: '批量下载失败'
    })
  }
})

// 获取下载统计
router.get('/stats', async (req, res) => {
  try {
    const packages = await packageService.getPackages()
    
    const stats = {
      totalDownloads: 0, // TODO: 实现下载计数
      popularPackages: packages.slice(0, 5), // 前5个包作为热门包
      downloadsByType: {}
    }
    
    // 按类型统计
    packages.forEach(pkg => {
      if (!stats.downloadsByType[pkg.type]) {
        stats.downloadsByType[pkg.type] = 0
      }
      stats.downloadsByType[pkg.type]++
    })
    
    res.json({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('Download stats error:', error)
    res.status(500).json({
      success: false,
      message: '获取下载统计失败'
    })
  }
})

module.exports = router