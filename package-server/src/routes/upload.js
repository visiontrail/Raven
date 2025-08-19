const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs-extra')
const PackageServiceSingleton = require('../services/PackageServiceSingleton')

const router = express.Router()
const packageService = new PackageServiceSingleton()

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
    const isValidExtension = allowedExtensions.some((ext) => file.originalname.toLowerCase().endsWith(ext))

    if (isValidExtension) {
      cb(null, true)
    } else {
      cb(new Error('Only .tgz and .tar.gz files are allowed'), false)
    }
  }
})

// Upload single package
router.post('/', upload.single('file'), async (req, res) => {
  console.log('POST /api/upload - 收到上传请求')

  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' })
    }

    console.log('上传文件信息:', req.file)

    // Extract package metadata
    console.log('开始提取包元数据...')
    const packageInfo = await packageService.extractPackageMetadata(req.file.path)
    console.log('提取的包信息:', packageInfo)

    // Merge with any additional metadata from request body
    const metadata = {
      ...packageInfo.metadata,
      ...req.body
    }

    const finalPackageInfo = {
      ...packageInfo,
      metadata
    }

    // Add package to service
    console.log('开始添加包到服务...')
    const result = await packageService.addPackage(finalPackageInfo)
    console.log('添加包结果:', result)

    res.json({
      success: true,
      message: '包上传成功',
      package: finalPackageInfo
    })
  } catch (error) {
    console.error('Upload error:', error)

    // Clean up uploaded file on error
    if (req.file && req.file.path) {
      try {
        await fs.remove(req.file.path)
      } catch (cleanupError) {
        console.error('Failed to cleanup file:', cleanupError)
      }
    }

    res.status(500).json({
      success: false,
      error: error.message || '上传失败'
    })
  }
})

// Upload multiple packages
router.post('/batch', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: '没有上传文件' })
    }

    const results = []
    const errors = []

    for (const file of req.files) {
      try {
        // Extract package metadata
        const packageInfo = await packageService.extractPackageMetadata(file.path)

        // Merge with any additional metadata from request body
        const metadata = {
          ...packageInfo.metadata,
          ...req.body
        }

        const finalPackageInfo = {
          ...packageInfo,
          metadata
        }

        // Add package to service
        await packageService.addPackage(finalPackageInfo)
        results.push(finalPackageInfo)
      } catch (error) {
        console.error(`Error processing file ${file.originalname}:`, error)
        errors.push({
          filename: file.originalname,
          error: error.message
        })

        // Clean up file on error
        try {
          await fs.remove(file.path)
        } catch (cleanupError) {
          console.error('Failed to cleanup file:', cleanupError)
        }
      }
    }

    res.json({
      success: true,
      message: `成功上传 ${results.length} 个包`,
      packages: results,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    console.error('Batch upload error:', error)
    res.status(500).json({
      success: false,
      error: error.message || '批量上传失败'
    })
  }
})

// Get upload progress (for future implementation with WebSocket or SSE)
router.get('/progress/:uploadId', (req, res) => {
  // This would be implemented with a proper upload progress tracking system
  // For now, return a simple response
  res.json({
    uploadId: req.params.uploadId,
    progress: 100,
    status: 'completed'
  })
})

module.exports = router