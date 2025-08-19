const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs-extra')
const PackageService = require('../services/PackageService')

const router = express.Router()
const packageService = new PackageService()

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads')
    fs.ensureDirSync(uploadDir)
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    // Keep original filename
    cb(null, file.originalname)
  }
})

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow .tgz and .tar.gz files
    const allowedExtensions = ['.tgz', '.tar.gz']
    const fileExtension = path.extname(file.originalname).toLowerCase()
    const isValidExtension = allowedExtensions.some(ext => 
      file.originalname.toLowerCase().endsWith(ext)
    )
    
    if (isValidExtension) {
      cb(null, true)
    } else {
      cb(new Error('Only .tgz and .tar.gz files are allowed'), false)
    }
  }
})

// Upload single package
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }
    
    const filePath = req.file.path
    const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : {}
    
    // Extract package information from the uploaded file
    const packageInfo = await packageService.extractPackageMetadata(filePath)
    
    // Merge with provided metadata
    packageInfo.metadata = {
      ...packageInfo.metadata,
      ...metadata
    }
    
    // Add the package to the service
    const success = await packageService.addPackage(packageInfo)
    
    if (success) {
      res.json({
        message: 'Package uploaded successfully',
        package: packageInfo
      })
    } else {
      // Clean up the uploaded file if adding to service failed
      await fs.remove(filePath)
      res.status(500).json({ error: 'Failed to add package to service' })
    }
  } catch (error) {
    console.error('Upload error:', error)
    
    // Clean up the uploaded file on error
    if (req.file && req.file.path) {
      try {
        await fs.remove(req.file.path)
      } catch (cleanupError) {
        console.error('Error cleaning up file:', cleanupError)
      }
    }
    
    res.status(500).json({ 
      error: error.message || 'Failed to upload package' 
    })
  }
})

// Upload multiple packages
router.post('/batch', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' })
    }
    
    const results = []
    const errors = []
    
    for (const file of req.files) {
      try {
        const filePath = file.path
        const packageInfo = await packageService.extractPackageMetadata(filePath)
        
        const success = await packageService.addPackage(packageInfo)
        
        if (success) {
          results.push({
            filename: file.originalname,
            package: packageInfo,
            status: 'success'
          })
        } else {
          await fs.remove(filePath)
          errors.push({
            filename: file.originalname,
            error: 'Failed to add package to service'
          })
        }
      } catch (error) {
        console.error(`Error processing file ${file.originalname}:`, error)
        
        // Clean up the file
        try {
          await fs.remove(file.path)
        } catch (cleanupError) {
          console.error('Error cleaning up file:', cleanupError)
        }
        
        errors.push({
          filename: file.originalname,
          error: error.message
        })
      }
    }
    
    res.json({
      message: `Processed ${req.files.length} files`,
      successful: results.length,
      failed: errors.length,
      results,
      errors
    })
  } catch (error) {
    console.error('Batch upload error:', error)
    res.status(500).json({ error: 'Failed to process batch upload' })
  }
})

// Get upload progress (for future implementation with WebSocket or SSE)
router.get('/progress/:uploadId', (req, res) => {
  // This would be implemented with a progress tracking system
  // For now, return a placeholder response
  res.json({
    uploadId: req.params.uploadId,
    progress: 100,
    status: 'completed'
  })
})

module.exports = router