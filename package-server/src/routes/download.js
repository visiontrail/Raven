const express = require('express')
const path = require('path')
const fs = require('fs-extra')
const archiver = require('archiver')
const PackageService = require('../services/PackageService')

const router = express.Router()
const packageService = new PackageService()

// Download single package by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const packageInfo = await packageService.getPackageById(id)
    
    if (!packageInfo) {
      return res.status(404).json({ error: 'Package not found' })
    }
    
    const filePath = packageInfo.path
    
    // Check if file exists
    if (!(await fs.pathExists(filePath))) {
      return res.status(404).json({ error: 'Package file not found on disk' })
    }
    
    // Set appropriate headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${packageInfo.name}"`)
    res.setHeader('Content-Type', 'application/gzip')
    res.setHeader('Content-Length', packageInfo.size)
    
    // Stream the file to the response
    const fileStream = fs.createReadStream(filePath)
    fileStream.pipe(res)
    
    fileStream.on('error', (error) => {
      console.error('Error streaming file:', error)
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error downloading file' })
      }
    })
    
  } catch (error) {
    console.error('Download error:', error)
    res.status(500).json({ error: 'Failed to download package' })
  }
})

// Download multiple packages as a ZIP archive
router.post('/batch', async (req, res) => {
  try {
    const { packageIds } = req.body
    
    if (!packageIds || !Array.isArray(packageIds) || packageIds.length === 0) {
      return res.status(400).json({ error: 'Package IDs array is required' })
    }
    
    // Validate all packages exist
    const packages = []
    for (const id of packageIds) {
      const packageInfo = await packageService.getPackageById(id)
      if (!packageInfo) {
        return res.status(404).json({ error: `Package with ID ${id} not found` })
      }
      
      if (!(await fs.pathExists(packageInfo.path))) {
        return res.status(404).json({ 
          error: `Package file for ${packageInfo.name} not found on disk` 
        })
      }
      
      packages.push(packageInfo)
    }
    
    // Set headers for ZIP download
    const zipFilename = `packages-${Date.now()}.zip`
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`)
    res.setHeader('Content-Type', 'application/zip')
    
    // Create ZIP archive
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    })
    
    // Pipe archive to response
    archive.pipe(res)
    
    // Add each package to the archive
    for (const packageInfo of packages) {
      archive.file(packageInfo.path, { name: packageInfo.name })
    }
    
    // Finalize the archive
    await archive.finalize()
    
  } catch (error) {
    console.error('Batch download error:', error)
    res.status(500).json({ error: 'Failed to create batch download' })
  }
})

// Get download statistics
router.get('/stats/:id', async (req, res) => {
  try {
    const { id } = req.params
    const packageInfo = await packageService.getPackageById(id)
    
    if (!packageInfo) {
      return res.status(404).json({ error: 'Package not found' })
    }
    
    // For now, return basic file information
    // In a real implementation, you might track download counts, etc.
    res.json({
      packageId: id,
      name: packageInfo.name,
      size: packageInfo.size,
      downloadUrl: `/api/download/${id}`,
      lastModified: packageInfo.createdAt
    })
    
  } catch (error) {
    console.error('Error fetching download stats:', error)
    res.status(500).json({ error: 'Failed to fetch download statistics' })
  }
})

module.exports = router